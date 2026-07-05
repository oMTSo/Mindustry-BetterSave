# BetterSave Architecture

本文面向项目维护者和后续接手者，说明 BetterSave 的功能范围、模块职责、运行时流程、云同步协议和维护注意事项。

## 项目定位

BetterSave 是一个 Mindustry 脚本模组，运行在 Mindustry 的 JavaScript/Rhino 环境中，通过 Arc/Mindustry API 操作游戏存档、设置、UI、HTTP 和文件系统。

核心目标：

- 在游戏内创建、恢复、编辑和删除本地 `.smsf` 存档备份。
- 管理多个本地玩家档案，并在不同档案间切换。
- 使用 GitHub 或 Gitee 仓库作为云存档后端。
- 云同步保持“覆盖式同步”语义：上传是本地覆盖云端，下载是云端覆盖本地。
- 传输层使用文件 hash 做增量传输，减少手机等慢设备上的重复上传和下载。
- 在 UI 中提供测试、上传、下载、清空云端、取消和进度显示。

当前不做自动合并，也不做逐文件冲突合并。多设备同时修改时，由用户根据提示选择上传覆盖云端或下载覆盖本地。

## 顶层结构

```text
src/
  mod.json
  icon.png
  sprites/
  bundles/
    bundle.properties
    bundle_zh_CN.properties
  scripts/
    main.js
    cloud/
    core/
    tools/
    ui/
```

脚本入口是 `src/scripts/main.js`。Mindustry 加载模组后，`main.js` 注册 UI，初始化存档与云同步配置，并在启动和战役退出时根据配置触发云端检查或上传提示。

## 运行时数据目录

路径集中在 `src/scripts/core/config.js` 中定义。

```text
Vars.saveDirectory                         Mindustry 原始存档目录
Vars.saveDirectory/../maps                 Mindustry 地图目录
Vars.saveDirectory/../schematics           Mindustry 蓝图目录
Vars.saveDirectory/../betterSave           BetterSave 数据根目录
Vars.saveDirectory/../betterSave/config    BetterSave 配置
Vars.saveDirectory/../betterSave/saves     本地 .smsf 备份
Vars.saveDirectory/../betterSave/players   多玩家档案
Vars.saveDirectory/../betterSave/tmp       临时文件
```

重要配置文件：

```text
betterSave/config/cloudsave.json   云同步配置，包含云存档 token，只能保留在本地
betterSave/config/sync.json        本地同步元数据
betterSave/config/editor.json      地图编辑器临时文件清理状态
betterSave/config/player.json      多玩家档案状态
```

`cloudsave.json`、`sync.json`、`editor.json` 不参与云端同步。`cloudsave.json` 包含 token，绝不能上传到云端仓库。

## 启动流程

`main.js` 在 `ClientLoadEvent` 后延迟执行初始化：

1. 调用 `editor.removeFiles()` 清理上次编辑残留临时文件。
2. 注册设置菜单 UI：`ui.register()`。
3. 初始化本地备份模块：`save.init()`。
4. 注册战役退出监听：
   - 退出战役后清理编辑器临时文件。
   - 初始化云配置。
   - 如果云存档启用且不是联机客户端，提示用户是否上传。
5. 启动 `control.listen()`，监听战役退出。
6. 初始化云配置。
7. 如果云存档启用且不是联机客户端，后台检查远端是否比本地更新；只有远端更新时才弹下载提示。

耗时任务不能直接阻塞主线程。云端 HTTP、远端 blob 读取、本地扫描、hash 计算都应在后台线程执行；UI、关闭地图、本地替换后的重载必须回到主线程。

## 模块职责

### `main.js`

模组入口。

职责：

- 打印版本信息。
- 注册 UI。
- 初始化存档和云同步。
- 处理启动时云端更新检查。
- 处理战役退出后的上传提示。
- 为启动/退出触发的上传下载提供加载界面、取消和进度显示。

### `cloud/index.js`

云同步对外入口和编排层。

对外 API：

```js
cloud.uploadSavesAsync({ force, cancelToken, onProgress }, onSuccess, onError, onConflict);
cloud.downloadSavesAsync({ force, cancelToken, onProgress }, onSuccess, onError, onConflict);
cloud.clearCloudAsync(onSuccess, onError);
cloud.testAsync(conf, onSuccess, onError);
cloud.inspectSyncAsync(conf, onSuccess, onError);
cloud.checkRemoteUpdateAsync(onSuccess, onError);
cloud.createCancelToken();
cloud.isCancelled(e);
```

职责：

- 读取云同步配置。
- 执行冲突检查。
- 在线程之间切换：后台执行网络/文件任务，主线程执行 UI 回调和本地替换。
- 编排上传、下载、清空云端、测试和状态检查。
- 生成和传递取消令牌。
- 生成和转发上传/下载进度。

### `cloud/cloudConfig.js`

云同步配置读写。

配置字段：

```js
{
  token: '',
  owner: '',
  repo: '',
  branch: 'main',
  enable: false,
  provider: 'github',
  lastSaveTime: ''
}
```

`provider` 目前支持 `github` 和 `gitee`，由 `cloud/index.js` 分发到对应 Git API provider。

### `cloud/localSnapshot.js`

本地同步快照层。

职责：

- 扫描本地同步目录：`config/`、`saves/`、`players/`。
- 跳过敏感和本地状态文件：`config/cloudsave.json`、`config/sync.json`、`config/editor.json`。
- 上传玩家 `.smsf` 前清洗历史残留的 `../bettersave/config/cloudsave.json`。
- 计算文件 SHA-256。
- 生成 `meta/sync.json` 的 version 2 manifest。
- 读取本地实际文件 manifest，用于增量下载判断。
- 下载替换本地时保留 `config/cloudsave.json`。
- 按远端 manifest 删除本地已经不在云端的同步文件。

上传 hash 和下载判断 hash 的语义不同：

- 上传 hash 基于“即将上传的数据”，玩家档案会先清洗 token。
- 下载判断 hash 基于“本地实际文件”，用于避免强制下载时误保留已经被本地修改的文件。

### `cloud/githubGitApi.js`

GitHub Git Data API 封装层。

使用的 GitHub API：

```text
GET  /repos/{owner}/{repo}
GET  /repos/{owner}/{repo}/git/ref/heads/{branch}
GET  /repos/{owner}/{repo}/git/commits/{sha}
POST /repos/{owner}/{repo}/git/blobs
POST /repos/{owner}/{repo}/git/trees
POST /repos/{owner}/{repo}/git/commits
POST https://api.github.com/graphql      updateRef
GET  /repos/{owner}/{repo}/git/trees/{sha}?recursive=1
GET  /repos/{owner}/{repo}/git/blobs/{sha}
```

职责：

- 获取分支 HEAD、commit 和 tree。
- 创建 blob、tree、commit。
- 用 GraphQL `updateRef` 将分支切到新 commit。
- 读取远端 `meta/sync.json`。
- 读取远端 tree 和按路径下载 blob。
- 上传时复用已有 `blobSha`，避免未变化文件重新 `createBlob`。
- 下载时只读取需要的 blob，并跳过 `meta/sync.json`。
- 处理 Git 空 tree：`4b825dc642cb6eb9a060e54bf8d69288fbee4904`。

不要引入 `DELETE` 或 `PATCH` 作为核心同步依赖。Mindustry/Arc/Rhino 环境对这些请求方法兼容性较差。

### `cloud/giteeGitApi.js`

Gitee API 封装层。

使用的 Gitee API：

```text
GET  /v5/repos/{owner}/{repo}
GET  /v5/repos/{owner}/{repo}/branches/{branch}
GET  /v5/repos/{owner}/{repo}/commits/{sha}
GET  /v5/repos/{owner}/{repo}/git/trees/{sha}?recursive=1
GET  /v5/repos/{owner}/{repo}/git/blobs/{sha}
POST /v5/repos/{owner}/{repo}/commits
```

职责：

- 测试仓库和分支是否可访问。
- 读取远端 tree、blob 和 `meta/sync.json`。
- 下载时按路径读取需要的 blob，并跳过 `meta/sync.json`。
- 上传时读取远端 tree，对同步路径生成 `create`、`update`、`delete` actions。
- 用一次 `POST /commits` 提交多文件变更，模拟覆盖式同步。
- 按 Git blob SHA 规则为本地上传数据计算 `blobSha`，写入 `meta/sync.json`，供后续增量复用。
- 清空云端时只删除 `config/`、`saves/`、`players/` 和 `meta/sync.json`，不会处理仓库中的其他文件。

Gitee 没有使用 GitHub 的 `createBlob/createTree/updateRef` 流程，因此上传进度表示“准备提交的新增或变化数据文件数”。真正提交 commit 是一个整体 POST 请求，无法继续提供逐文件网络进度。

### `core/config.js`

路径和 JSON 配置存储。

职责：

- 定义 BetterSave 和 Mindustry 相关目录。
- 初始化目录。
- 读写 `betterSave/config/*.json`。

### `core/save.js`

`.smsf` 存档归档层。

职责：

- 创建当前游戏状态备份。
- 读取、写入、应用、删除 `.smsf`。
- 恢复备份时关闭当前地图、清空原始存档和蓝图目录、写入归档内文件、恢复战役设置、重载 Mindustry 状态。

备份内容包括：

- `Vars.saveDirectory` 中的游戏存档文件。
- `schematics/` 中的蓝图文件，归档路径为 `../schematics/...`。
- `$setting` 特殊块，用于保存战役相关设置。

### `core/smsf.js`

SMSF 二进制格式读写。

格式概要：

```text
magic: SMSF
version: 100
name
time: year/month/day/hour/minute/second
fileNum
files:
  name
  length
  data
```

`readMeta()` 只读取元数据，不读取所有文件内容；`read()` 读取完整归档。

### `core/setting.js`

战役相关 `Core.settings` 打包和恢复。

职责：

- 过滤与战役进度、科技树、区块信息、发射配置相关的 setting key。
- 将 boolean、int、long、float、string、binary 类型序列化。
- 恢复备份时先清理相关 key，再写入归档内 setting。

### `core/player.js`

多玩家档案管理。

职责：

- 保存当前玩家状态。
- 添加、重命名、切换、删除玩家档案。
- 切换玩家时：
  - 将当前游戏状态打包为 `.smsf` 并保存到 `betterSave/players`。
  - 将 `betterSave/saves` 中的备份也打包进玩家档案。
  - 清空当前 `betterSave/saves`。
  - 应用目标玩家档案或重置为空状态。
  - 更新 `player.json` 和 UI 中的当前玩家显示。

### `core/control.js`

Mindustry 运行状态控制工具。

职责：

- 判断是否在地图内。
- 判断是否为联机客户端。
- 保存当前地图。
- 关闭当前地图。
- 监听战役退出。
- 重载存档、蓝图、科技树、星球区块信息和研究 UI。

### `core/editor.js`

地图编辑器桥接。

职责：

- 将当前存档或备份中的地图临时写入文件。
- 调用 Mindustry 地图编辑器编辑。
- 编辑完成后回收地图数据。
- 记录需要清理的临时文件到 `config/editor.json`。
- 启动时或编辑前清理残留文件。

`config/editor.json` 是临时清理状态，不应参与云同步，也不应作为本地同步更新判断依据。

### `core/map.js`

地图文件名解析。

职责：

- 将 Mindustry 存档文件名解析成 UI 展示信息。
- 支持战役区块、自定义地图和 backup 文件名。
- 使用 `setting.read()` 读取自定义地图显示名。

### `tools/file.js`

文件读写工具。

职责：

- 读取 byte[]。
- 写入 byte[]。
- 建目录。
- 删除文件。
- 删除目录下文件。
- 判断路径是否存在和是否目录。

### `tools/http.js`

HTTP GET/POST 工具。

职责：

- 封装 Arc HTTP GET/POST。
- POST 先尝试 Arc HTTP。
- 如果 Arc POST 返回状态码 `0` 或抛错，使用 Java `URLConnection` fallback。
- fallback 通过公开父类反射调用方法，避免 Rhino 访问 JDK 内部 HTTPS 实现类导致模块访问错误。

不要随意改回 `contentStream`。之前 GitHub POST 曾出现 `status 0`。

### `tools/type.js`

UTF-8 字符串与 Java byte[] 转换工具。

### `tools/version.js`

读取模组版本信息。

### `ui/ui.js`

UI 注册入口。

职责：

- 向 Mindustry 设置菜单添加 `存档` 分类。
- 注册四个入口：
  - 存档管理
  - 多玩家
  - 云存档选项
  - 关于
- 提供通用 `button()` 和 `table()` 辅助函数。
- 在星球 UI 打开时显示当前玩家提示。

### `ui/mainDialog.js`

存档管理对话框。

功能：

- 显示当前存档入口。
- 备份当前存档。
- 恢复备份。
- 编辑当前存档或备份中的地图。
- 删除备份。
- 云存档启用时显示上传和下载按钮。

### `ui/cloudSettingDialog.js`

云存档设置对话框。

功能：

- 编辑 token、owner、repo、branch。
- 启用/禁用云存档。
- 保存配置。
- 按当前 provider 测试 GitHub/Gitee 连接并显示同步状态。
- 上传、下载、清空云端。
- 测试、上传、下载使用原生 `loadfrag` 取消按钮。
- 上传和下载加载界面显示传输进度，例如 `正在上传到云存档 1/3`。

### `ui/playerDialog.js`

多玩家档案管理对话框。

功能：

- 添加玩家。
- 重命名当前或其他玩家。
- 切换玩家。
- 删除非当前玩家。

### `ui/aboutDialog.js`

关于对话框。

功能：

- 显示图标、名称、版本和描述。

### `ui/tools/*`

通用 UI 组件：

```text
input.js      文本输入对话框
icons.js      自定义图标加载
listView.js   带图标和操作按钮的列表对话框
saveEdit.js   存档地图编辑对话框
```

## 云同步语义

云同步是覆盖式同步。

上传：

- 本地当前同步内容是最终结果。
- 云端 BetterSave 同步路径中没有出现在本地同步内容里的文件会被删除。
- 未变化文件会复用远端 Git blob，减少上传请求。

下载：

- 云端当前同步内容是最终结果。
- 本地没有出现在云端 manifest 中的同步文件会被删除。
- 未变化文件保留在本地，不重复下载。
- 本地 `config/cloudsave.json` 始终保留。

不做自动合并。冲突只通过时间和本地修改检测提示给用户。

## 云同步元数据

同步状态由两份文件维护：

```text
本地：betterSave/config/sync.json
远端：meta/sync.json
```

`version` 是同步元数据格式版本，不是模组版本。

当前格式为 `version: 2`：

```json
{
  "version": 2,
  "updatedAt": "2026-07-05T12:30:00.000Z",
  "localSyncedAt": "2026-07-05T12:30:05.000Z",
  "localDirtyAt": "",
  "deviceId": "device-id",
  "deviceName": "Mindustry",
  "fileCount": 8,
  "files": {
    "saves/example.smsf": {
      "hash": "sha256",
      "size": 123456,
      "blobSha": "git-blob-sha"
    }
  }
}
```

字段说明：

- `version`：同步元数据格式版本。
- `updatedAt`：云端同步内容更新时间，用于判断远端是否比本地同步基准新。
- `localSyncedAt`：本地写入同步状态的时间，用于判断本地文件是否在上次同步后被修改。
- `localDirtyAt`：本地专用变更标记，用于记录删除、重命名、清空目录等文件 mtime 扫描无法发现的本地变化；上传或下载成功后清空。
- `deviceId`：本地设备 ID。
- `deviceName`：设备名称，目前默认 `Mindustry`。
- `fileCount`：同步数据文件数量，不包含 `meta/sync.json` 自身。
- `files`：同步文件 manifest，只包含 `config/`、`saves/`、`players/` 下真正参与同步的文件。
- `hash`：文件 SHA-256。
- `size`：文件大小。
- `blobSha`：Git blob SHA，用于上传时复用未变化文件。

兼容规则：

- 远端没有 `meta/sync.json`：按空云端处理。
- 远端是旧版 `version: 1` 或没有 `files`：下载走全量 fallback；上传成功后写入新版 `version: 2`。
- 清空云端后，`meta/sync.json` 和同步数据路径会被删除；下一次上传无法复用 manifest，会全量上传同步数据。
- `meta/sync.json` 自身不写入 `files` manifest，避免元数据描述自己导致 hash 不稳定。

## 冲突判断

上传前：

- 如果远端 `updatedAt` 大于本地 `updatedAt`，提示“本地过期”。
- 用户确认后可以强制上传，云端会被本地覆盖。

下载前：

- 如果本地 `updatedAt` 大于远端 `updatedAt`，提示“云端过期”。
- 如果本地同步文件在 `localSyncedAt` 后被修改，或 `localDirtyAt` 晚于 `localSyncedAt`，也提示“云端过期”。
- 用户确认后可以强制下载，本地会被云端覆盖。

启动时：

- 后台只读取远端 `meta/sync.json`。
- 只有远端 `updatedAt` 大于本地 `updatedAt` 时才弹下载提示。

测试按钮结论：

- `localExpired`：云端比本地同步基准新。
- `remoteExpired`：本地比云端新，或本地检测到未上传修改。
- `bothChanged`：云端比本地同步基准新，同时本地也检测到未上传修改。
- `synced`：没有检测到任一侧更新。

## 上传流程

1. UI 显示上传确认。
2. 主线程显示 `loadfrag`，创建取消令牌。
3. 后台线程执行冲突检查。
4. 如果远端更新，回主线程提示“本地过期”。
5. 用户确认后继续，主线程调用 `save.make('cloudsave').writeToSavePath()` 保存当前状态。
6. 后台线程扫描本地同步目录。
7. 上传前过滤：
   - 跳过 `config/cloudsave.json`。
   - 跳过 `config/sync.json`。
   - 跳过 `config/editor.json`。
   - 清洗玩家 `.smsf` 中历史残留的 token 配置文件。
8. 对清洗后的数据计算 SHA-256。
9. 读取远端 `meta/sync.json`。
10. 同路径 hash 一致且远端有 `blobSha` 时复用 blob。
11. GitHub 只有新增或变化文件调用 `createBlob`；Gitee 只有新增或变化文件进入 commit actions。
12. GitHub 每成功创建一个实际数据 blob 后回调上传进度；Gitee 在准备好本次 commit actions 后按变化数据文件回调上传进度。
13. 生成新版 `meta/sync.json`。
14. GitHub 创建完整 tree 和 commit，并用 GraphQL `updateRef` 将分支切到新 commit。
15. Gitee 通过一次 `POST /commits` 提交 create/update/delete actions。
17. 写入本地 `config/sync.json`。
18. 更新云配置中的 `lastSaveTime`。
19. 回主线程显示上传成功。

上传进度规则：

- 总数只统计本次需要传输或提交变化的同步数据文件。
- 复用 blob 的文件不计入总数。
- `meta/sync.json` 不计入用户可见进度。
- 如果总数为 0，加载文字不显示 `0/0`，只显示上传状态；tree/commit/updateRef 或 Gitee 提交阶段仍可能执行。

## 下载流程

1. UI 显示下载确认。
2. 主线程显示 `loadfrag`，创建取消令牌。
3. 后台线程读取远端 meta 并检查本地状态。
4. 如果本地更新，回主线程提示“云端过期”。
5. 用户确认后继续，后台线程读取远端 tree 和 `meta/sync.json`。
6. 重新计算本地实际同步文件 manifest。
7. 如果远端是新版 manifest：
   - 只下载远端新增或 hash 不同的文件。
   - hash 相同的本地文件保留。
8. 如果远端是旧版或缺失 manifest：
   - 退回全量下载。
9. 每成功下载一个实际数据 blob，回调下载进度。
10. 主线程关闭当前地图。
11. 主线程替换下载到的文件。
12. 主线程删除远端 manifest 中不存在的本地同步文件。
13. 保留本地 `config/cloudsave.json`。
14. 写入本地 `config/sync.json`。
15. 调用 `control.reloadSave()` 重载游戏状态。
16. 回主线程显示下载成功。

下载进度规则：

- 新版 manifest 下，总数是 changed paths 数。
- 旧版 fallback 下，总数是远端 tree 中同步数据文件数。
- `meta/sync.json` 不下载为普通文件，也不计入进度。
- 如果没有需要下载的文件，加载文字不显示 `0/0`，只执行本地删除/元数据写入/重载。

## 清空云端流程

清空云端会删除 BetterSave 管理的云端路径：`config/`、`saves/`、`players/` 和 `meta/sync.json`。仓库中的其他文件会保留。

注意：

- 清空云端不会删除本地配置。
- 清空后远端没有 `meta/sync.json`。
- 下一次上传会全量上传，因为没有可复用的 manifest。

## 取消模型

测试、上传、下载都使用 Mindustry 原生 `Vars.ui.loadfrag`。

通用规则：

- 必须先 `Vars.ui.loadfrag.show(text)`，再 `Vars.ui.loadfrag.setButton(...)`。
- `show(text)` 会重置加载层并隐藏内置按钮。
- 如果更新进度时再次调用 `show(text)`，必须马上重新 `setButton(...)`。
- 不要创建额外 `BaseDialog` 叠在加载层上。

测试取消：

- 只取消当前 UI 等待，不中断已发出的 HTTP 请求。
- `cloudSettingDialog.js` 使用 `testLoadingId` 和 `cancelled` 忽略过期回调。

上传/下载取消：

- 使用 `cloud.createCancelToken()`。
- UI 点击取消后设置 token，并显示“正在取消云同步”。
- 后台线程在安全边界调用 `throwIfCancelled()`。
- 取消检查边界包括：
  - 保存本地 `cloudsave` 前后。
  - 扫描本地文件前后。
  - 每次创建 blob 前后。
  - 创建 tree/commit 前。
  - GitHub `updateRef` 前。
  - Gitee `POST /commits` 前。
  - 读取远端 tree 前。
  - 每次下载 blob 前后。
  - 关闭地图前。
  - 替换本地文件前。
- 上传一旦 GitHub `updateRef` 成功或 Gitee `POST /commits` 成功，云端已经切到新 commit，之后不再把取消视为失败。

## 进度模型

上传和下载通过 `options.onProgress` 回调报告进度。

`cloud/index.js` 负责：

- 计算总数。
- 将后台线程进度通过 `Core.app.post` 投递到主线程。
- 忽略取消后的过期进度。

`cloud/githubGitApi.js` 负责：

- 上传时在实际 `createBlob` 成功后递增。
- 下载时在实际 blob 下载完成后递增。

`cloud/giteeGitApi.js` 负责：

- 上传时在准备本次 commit actions 后按新增或变化数据文件递增。
- 下载时在实际 blob 下载完成后递增。

UI 负责：

- 将进度显示到 `loadfrag` 文本。
- 每次刷新进度后重新设置取消按钮。

显示示例：

```text
正在上传到云存档 1/3
正在从云存档下载 1/3
Uploading to cloud 1/3
Downloading from cloud 1/3
```

## 敏感配置和安全边界

云存档 token 存在：

```text
betterSave/config/cloudsave.json
```

必须保证：

- 不上传 `config/cloudsave.json`。
- 不上传 `config/sync.json`。
- 不上传 `config/editor.json`。
- 玩家 `.smsf` 上传前必须清理历史残留的 `../bettersave/config/cloudsave.json`。
- 下载替换本地配置时必须保留本机 `config/cloudsave.json`。
- 远端路径写入本地前必须检查，拒绝包含 `..` 或绝对路径的远端路径。

如果 GitHub 返回 `422 Secret detected in content`，说明仍有疑似 token 内容进入上传文件，需要优先检查玩家档案和本地快照逻辑。

## UI 入口

Mindustry 设置菜单：

```text
设置 -> 存档
```

包含：

- 存档管理
- 多玩家
- 云存档选项
- 关于

云同步也可能在以下时机被触发：

- 游戏启动后检测到远端更新，提示下载。
- 战役退出后提示上传。

## 线程边界

主线程：

- UI 显示和提示。
- 用户确认窗口。
- `save.make('cloudsave').writeToSavePath()` 的当前状态保存阶段。
- 关闭当前地图。
- 替换本地文件。
- `control.reloadSave()`。

后台线程：

- GitHub/Gitee HTTP 请求。
- 读取远端 tree/blob/meta。
- 创建 blob/tree/commit/updateRef，或 Gitee commit actions。
- 扫描本地同步文件。
- 清洗玩家 `.smsf`。
- 计算 SHA-256。

所有后台回调都必须通过 `Core.app.post` 回主线程后再操作 UI。

## 运行时验证

语法检查：

```powershell
Get-ChildItem -Path src\scripts -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

旧引用检查：

```powershell
rg "bettersave/core/cloud" src\scripts
rg "cloud\.writeSave|cloud\.getSave|cloud\.removeSave|cloud\.test\(" src\scripts
```

预期不应有输出。

提交前建议：

```powershell
git diff --stat
git diff --name-only
git diff --check
```

手动验证建议：

1. 配置 GitHub 或 Gitee token、owner、repo、branch，并确认 provider 选择正确。
2. 点击测试，确认能显示本地/云端时间、设备和结论。
3. 第一次上传，确认仓库出现 `config/`、`saves/`、`players/`、`meta/sync.json`。
4. 确认仓库中没有 `config/cloudsave.json`。
5. 确认 `meta/sync.json` 为 `version: 2`，且包含 `files` manifest。
6. 第二次不修改文件直接上传，确认不会逐个重新上传所有数据文件。
7. 修改一个备份后上传，确认只显示少量上传进度。
8. 在另一个环境首次下载，确认可以恢复本地状态。
9. 第二次不修改文件下载，确认不会重复下载全部 blob。
10. 清空云端后再次上传，确认能全量上传，不再出现空 tree 读取失败，且仓库非同步文件不会被删除。
11. 上传和下载过程中点击取消，确认加载层关闭或显示取消中，并且旧回调不会再弹成功/失败。

## 已知约束

- 云同步支持 GitHub 和 Gitee，但两者底层写入方式不同，Gitee 提交阶段不能提供真实逐文件网络进度。
- 同步是覆盖式，不做自动合并。
- 第一次同步、清空云端后的下一次上传、旧版 meta fallback 都需要全量传输。
- 上传和下载进度只统计实际传输文件，不统计 tree/commit/updateRef 阶段。
- 手机端由于网络、HTTPS、Base64、JSON、Rhino 和文件 IO 开销，仍可能比电脑慢。
- Windows 工作区可能出现 `LF will be replaced by CRLF` 提示，提交前以实际 diff 为准。

## 后续演进建议

优先级从高到低：

1. 将 `core/config.js` 拆成 `core/paths.js` 和 `core/configStore.js`。
2. 将 `tools/file.js`、`tools/http.js`、`tools/type.js` 迁到 `platform/`。
3. 将 `core/save.js` 改名为 `core/saveArchive.js`。
4. 将 `core/setting.js` 改名为 `core/settingsArchive.js`。
5. 将 `core/player.js` 改名为 `core/playerProfiles.js`。
6. 给同步状态增加更清晰的设备名称设置。
7. 增加更细粒度的错误提示和 GitHub/Gitee API 错误解释。
8. 如果未来支持其他 Git 服务，先抽象 Git 后端接口，再适配服务差异。

重构建议小步提交。涉及云同步、存档替换、token 过滤的改动，每一步都应进游戏验证上传和下载。
