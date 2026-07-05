# BetterSave 维护交接说明

## 项目概览

BetterSave 是 Mindustry 的脚本模组，主要功能是：

- 将当前游戏存档、蓝图和必要的战役设置打包成 `.smsf` 备份。
- 管理多个本地玩家档案。
- 使用 GitHub 仓库作为云存档后端，实现全量上传、全量下载和清空云端。

代码入口是 `src/scripts/main.js`。模组加载后会注册 UI，并在启动和战役退出时根据配置询问是否执行云同步。

## 当前文件结构

```text
src/scripts/
  main.js                    模组入口

  cloud/
    index.js                 云同步对外入口，编排上传、下载、清空和测试
    cloudConfig.js           云同步配置读写
    localSnapshot.js         本地同步快照收集、敏感配置过滤、本地替换
    githubGitApi.js          GitHub blob/tree/commit/updateRef/download API

  core/
    config.js                BetterSave 路径和 JSON 配置读写
    control.js               保存当前地图、关闭地图、监听退出、重载存档
    editor.js                地图编辑器桥接
    map.js                   地图文件名解析
    player.js                多玩家档案切换
    save.js                  SMSF 备份创建、读取、应用、删除
    setting.js               战役相关 Core.settings 打包和恢复
    smsf.js                  SMSF 二进制格式读写

  tools/
    file.js                  文件读写工具
    http.js                  HTTP GET/POST 工具，POST 有 Java URLConnection fallback
    type.js                  UTF-8 字符串和 byte[] 转换
    version.js               版本信息读取

  ui/
    ui.js                    UI 注册入口
    mainDialog.js            存档管理
    cloudSettingDialog.js    云同步设置
    playerDialog.js          玩家档案管理
    aboutDialog.js           关于
    tools/                   通用 UI 组件
```

`src/scripts/core/cloud.js` 已删除。所有云同步调用应直接引用：

```js
const cloud = require('bettersave/cloud/index');
```

## 云同步设计

当前云同步是全量覆盖，不是增量同步。

上传流程：

1. 主线程保存当前游戏状态并生成一份 `cloudsave` 本地 `.smsf` 备份。
2. 后台线程读取远端 `meta/sync.json`，如果远端比本地上次同步更新，则回主线程提示“本地过期”。
3. 用户确认覆盖后，后台线程扫描本地 `betterSave/config`、`betterSave/saves`、`betterSave/players`。
4. 过滤 `config/cloudsave.json`、`config/sync.json` 和 `config/editor.json`，避免上传本地 token、本地状态文件和编辑器临时清理状态。
5. 清洗玩家 `.smsf` 中历史残留的 `../bettersave/config/cloudsave.json`。
6. 生成远端 `meta/sync.json`。
7. 逐个创建 GitHub blob。
8. 创建一棵只包含当前本地同步文件的新 tree。
9. 创建 commit。
10. 用 GraphQL `updateRef` 将分支指向新 commit。

下载流程：

1. 后台线程读取远端分支 tree。
2. 读取远端 `meta/sync.json`，并检查本地同步文件是否在上次同步后发生修改。
3. 如果本地更新，则回主线程提示“云端过期”。
4. 用户确认覆盖后，后台线程下载远端所有 blob 到内存。
5. 主线程关闭当前地图。
6. 替换本地 `config`、`saves`、`players`。
7. 保留本地 `config/cloudsave.json`，避免下载覆盖或删除 token 配置。
8. 将远端 `meta/sync.json` 写入本地 `config/sync.json`。
9. 重载 Mindustry 存档状态。

清空云端：

- 创建一棵空 tree，并将分支指向对应 commit。

## 同步元数据

同步状态由两份文件维护：

```text
本地：betterSave/config/sync.json
远端：meta/sync.json
```

字段示例：

```json
{
  "version": 1,
  "updatedAt": "2026-07-05T12:30:00.000Z",
  "localSyncedAt": "2026-07-05T12:30:05.000Z",
  "deviceId": "device-id",
  "deviceName": "Mindustry",
  "fileCount": 8
}
```

判断规则：

- 上传前：如果远端 `updatedAt` 大于本地 `updatedAt`，提示“本地过期”。
- 下载前：如果本地 `updatedAt` 大于远端 `updatedAt`，或本地同步文件在 `localSyncedAt` 后被修改，提示“云端过期”。
- 启动时：后台只读取远端 `meta/sync.json`，只有远端 `updatedAt` 大于本地 `updatedAt` 时才弹下载提示。
- `config/editor.json` 是地图编辑器临时文件清理状态，启动时可能被 `editor.removeFiles()` 重写，不应参与上传或本地更新时间判断。

测试按钮调用 `cloud.inspectSyncAsync`。GitHub API 连通时显示“测试成功”，并展示本地存档时间、云端存档时间、本地设备、云端设备和结论；API 失败时仍显示“测试失败”。

测试结论：

- `本地过期`：云端 `updatedAt` 比本地 `updatedAt` 新。
- `云端过期`：本地 `updatedAt` 比云端新，或本地同步文件在 `localSyncedAt` 后修改。
- `本地和云端都有更新`：云端比本地同步基准新，同时本地也检测到未上传修改。
- `本地和云端一致`：没有检测到任一侧更新。

## 加载界面和取消按钮

Mindustry 自带的 `Vars.ui.loadfrag` 有加载动画、遮罩和内置按钮能力。云同步相关加载状态应优先使用它，不要用新的 `BaseDialog` 替代。

当前通用加载函数在 `main.js` 和 `ui/cloudSettingDialog.js` 中都是：

```js
function showLoading(key) {
    Vars.ui.loadfrag.show(Core.bundle.get(key));
}

function hideLoading() {
    Vars.ui.loadfrag.hide();
}
```

注意事项：

- `Vars.ui.loadfrag.show(text)` 每次都会重置加载层状态，并隐藏内置按钮。
- 如果需要取消按钮，必须先 `showLoading(...)`，再调用 `Vars.ui.loadfrag.setButton(...)`。
- `setButton` 显示的是 `loadfrag` 自带的 `@cancel` 按钮，按钮位于加载内容下方，不需要自己创建新 Dialog。
- 不要再创建单独的半透明 `BaseDialog` 覆盖加载层；之前这样会叠两层遮罩，并且取消按钮容易被挡住。
- 不要调用 `BaseDialog.setTitle(...)`；Mindustry 的 `BaseDialog` 没有这个函数，之前已经导致过 `Cannot find function setTitle in object BaseDialog` 崩溃。
- 如果需要把加载文字改成“正在取消”等状态，按当前约定先 `hideLoading()`，再 `showLoading(newKey)`，最后任务结束时仍然必须 `hideLoading()`。

目前只有云存档设置里的“测试”按钮实现了取消：

```js
function showCancelableTestLoading(onCancel) {
    showLoading('cloudConfig.test');
    Vars.ui.loadfrag.setButton(() => {
        hideLoading();
        onCancel();
    });
}
```

测试取消的性质：

- 取消按钮只取消当前 UI 等待，不会真正中断已经发出的 HTTP 请求。
- 后台线程结束后会回调到主线程，但 `cloudSettingDialog.js` 用 `testLoadingId` 和 `cancelled` 标记忽略过期回调，因此不会再弹“测试成功/测试失败”。
- 连续点击测试时，旧请求返回也会被 `testLoadingId` 忽略，避免旧结果覆盖新结果。
- 这个实现目前只用于测试按钮，不影响上传、下载、清空云端。

如果以后给上传或下载也加取消，不能只隐藏 UI。上传/下载会修改本地或云端状态，必须同时设计后台取消标记，并在以下边界检查：

- 上传：保存本地 `cloudsave` 前、扫描本地文件前、每次创建 blob 前后、创建 tree/commit 前、updateRef 前。
- 下载：读取远端 tree 前、每次下载 blob 前后、关闭地图前、替换本地文件前。
- 一旦进入本地替换阶段，取消策略要非常谨慎，避免只替换了一半导致本地状态损坏。
- 上传一旦执行到 `updateRef` 成功，云端已经整体切换到新 commit，之后只能视为上传成功或提示用户重新同步。

## GitHub API 注意事项

当前只支持 GitHub。Gitee 配置入口还保留在 UI 上，但 Git Tree 全量同步暂不支持 Gitee。

使用到的 GitHub API：

- `GET /repos/{owner}/{repo}`
- `GET /repos/{owner}/{repo}/git/ref/heads/{branch}`
- `GET /repos/{owner}/{repo}/git/commits/{sha}`
- `POST /repos/{owner}/{repo}/git/blobs`
- `POST /repos/{owner}/{repo}/git/trees`
- `POST /repos/{owner}/{repo}/git/commits`
- `POST https://api.github.com/graphql`，用于 `updateRef`
- `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`
- `GET /repos/{owner}/{repo}/git/blobs/{sha}`

不要再引入 `DELETE` 或 `PATCH` 作为核心同步依赖。Mindustry/Arc/Rhino 环境对这些请求方法兼容性较差。

## 线程模型

耗时操作必须避免阻塞 Mindustry 主线程，否则窗口会显示未响应。

当前云同步线程边界：

- 主线程：
  - UI 显示和提示
  - 保存当前游戏状态
  - 关闭当前地图
  - 替换本地后调用 `control.reloadSave()`
- 后台线程：
  - GitHub HTTP 请求
  - 读取远端 blob
  - 创建 blob/tree/commit
  - 扫描本地同步文件

`cloud/index.js` 中通过 `Packages.arc.util.Threads.thread` 执行后台任务，并用 `Core.app.post` 回到主线程调用 UI 回调。

UI 调用应使用异步 API：

```js
cloud.uploadSavesAsync({ force: false }, onSuccess, onError, onConflict);
cloud.downloadSavesAsync({ force: false }, onSuccess, onError, onConflict);
cloud.clearCloudAsync(onSuccess, onError);
cloud.testAsync(conf, onSuccess, onError);
cloud.inspectSyncAsync(conf, onSuccess, onError);
cloud.checkRemoteUpdateAsync(onSuccess, onError);
```

不要在 UI 中直接调用旧同步接口，也不要在 `Vars.ui.loadAnd(...)` 回调中执行网络请求。

## 敏感配置处理

用户输入的 GitHub token 存在本地：

```text
<Vars.saveDirectory>/../betterSave/config/cloudsave.json
```

这个文件必须保留在本地，不能上传到 GitHub。

已实现的防护：

- `cloud/localSnapshot.js` 上传时跳过 `config/cloudsave.json`。
- `cloud/localSnapshot.js` 上传和本地更新时间判断时跳过 `config/sync.json` 和 `config/editor.json`。
- 上传玩家 `.smsf` 前会过滤历史残留的 `../bettersave/config/cloudsave.json`。
- 下载替换本地配置时会保留本机的 `config/cloudsave.json`。

如果之后修改玩家档案或本地快照逻辑，必须继续保证 token 不进入远端 blob，否则 GitHub Secret Scanning 会返回 `422 Secret detected in content`。

## HTTP 层注意事项

`tools/http.js` 当前只保留 GET 和 POST。

POST 逻辑：

1. 先尝试 Arc HTTP。
2. 如果 Arc 返回状态码 `0` 或抛错，使用 Java `URLConnection` fallback。
3. fallback 通过公开父类反射调用方法，避免 Rhino 访问 `sun.net.www.protocol.https.HttpsURLConnectionImpl` 触发 Java 模块访问错误。

不要随意改回 `contentStream`，之前 GitHub POST 会出现 `status 0`。

## 已删除的旧文件

以下重复或旧版 UI 文件已删除：

```text
src/scripts/ui/main.js
src/scripts/ui/cloudSetting.js
src/scripts/ui/player.js
src/scripts/ui/about.js
```

以下兼容门面已删除：

```text
src/scripts/core/cloud.js
```

如果之后看到旧文档提到这些文件，应以当前结构为准。

## 验证方式

语法检查：

```powershell
Get-ChildItem -Path src\scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

引用检查：

```powershell
rg "bettersave/core/cloud" src\scripts
rg "cloud\.writeSave|cloud\.getSave|cloud\.removeSave|cloud\.test\(" src\scripts
```

预期不应有输出。

运行时手动验证建议：

1. 打开 Mindustry，进入 BetterSave 云存档设置。
2. 填入 GitHub token、owner、repo、branch。
3. 点击测试。
4. 点击上传，确认窗口不再长时间未响应。
5. 查看 GitHub 仓库是否出现 `config/`、`saves/`、`players/`。
6. 确认仓库中没有 `config/cloudsave.json`。
7. 在另一个本地环境或清空本地同步目录后测试下载。

测试按钮取消的手动验证建议：

1. 打开云存档设置并点击“测试”。
2. 加载界面应继续显示 Mindustry 原生 `loadfrag` 动画。
3. 加载内容下方应出现原生 `取消` 按钮。
4. 点击取消后加载界面应关闭。
5. 如果后台测试稍后返回，不应再弹出“测试成功”或“测试失败”。

Git 状态注意事项：

- 这个仓库在 Windows 下可能出现 `LF will be replaced by CRLF` 或工作区 `mixed` 换行提示。
- 如果 `git status` 显示多个文件被修改，但 `git diff --stat` 只显示少数文件，应以实际 diff 为准，不要因为状态噪声直接重置文件。
- 提交前建议同时看：

```powershell
git diff --stat
git diff --name-only
git diff --check
```

## 后续重构建议

优先级从高到低：

1. 将 `core/config.js` 拆成 `core/paths.js` 和 `core/configStore.js`。
2. 将 `tools/file.js`、`tools/http.js`、`tools/type.js` 迁到 `platform/`。
3. 将 `core/save.js` 改名为 `core/saveArchive.js`。
4. 将 `core/setting.js` 改名为 `core/settingsArchive.js`。
5. 将 `core/player.js` 改名为 `core/playerProfiles.js`。
6. 给 GitHub 同步增加 hash 对比，避免每次重新上传所有 blob。

不要一次性大改全部 require。建议保留小步提交，每步都进游戏测试上传和下载。
