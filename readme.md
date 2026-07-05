![7b5ceff2262bc296ac30a751a9cca9dd](https://raw.githubusercontent.com/oMTSo/images/main/img/20260705045622656.png)

# BetterSave

- looking for [English manual](https://github.com/oMTSo/Mindustry-BetterSave/blob/master/README_EN.md) ?

BetterSave 是一个 Mindustry 脚本模组，用于增强本地存档管理，并提供基于 GitHub 或 Gitee 仓库的云存档同步功能。

本模组由 SaveMaster 改造而来，沿用了 SaveMaster 中不少基础函数、存档打包思路和 UI 结构。在此基础上，BetterSave 增加了多玩家档案管理、Git 仓库云同步、同步状态检查和更完整的云端覆盖流程。

当前项目仍在开发中，云存档功能以“覆盖同步”为核心设计，暂不处理复杂的存档合并冲突。传输层会根据文件 hash 复用未变化文件，减少手机等慢设备上的上传和下载耗时。

⚠️ **<font color="red">注意：当前模组正在开发，可能会有恶性 BUG 存在，使用前请备份存档！</font>**

## 主要功能

- 将当前 Mindustry 存档、蓝图和必要的战役设置打包为 `.smsf` 备份。
- 在游戏内创建、恢复、编辑、删除本地备份。
- 管理多个本地玩家档案，并在不同玩家档案之间切换。
- 使用 GitHub 或 Gitee 仓库作为云存档后端。
- 支持上传本地存档到云端，本地内容会覆盖云端内容。
- 支持下载云端存档并替换本地，云端内容会覆盖本地内容。
- 上传和下载会按文件 hash 增量传输，未变化文件会尽量复用或保留。
- 启动时后台检查云端是否比本地更新，只在需要时提示下载。
- 上传和下载前检查本地/云端更新时间，避免无提示覆盖较新的存档。
- 云存档测试界面会显示本地时间、云端时间、本地设备、云端设备和同步结论。

## 安装方式

1. 下载或打包本项目。
2. 将模组放入 Mindustry 的 `mods` 目录。
3. 启动 Mindustry。
4. 在设置菜单中打开 `存档` 分类。

模组入口位于：

```text
设置 -> 存档
```

其中包含：

- `存档管理`
- `多玩家`
- `云存档选项`
- `关于`

## 本地存档管理

打开 `设置 -> 存档 -> 存档管理`。

### 备份当前存档

1. 点击当前存档条目旁边的向下按钮。
2. 输入备份名称。
3. 确认后，BetterSave 会保存当前游戏状态，并生成一个 `.smsf` 备份。

备份内容包括：

- 当前游戏存档文件
- 蓝图文件
- 与战役进度相关的部分设置

### 恢复备份

1. 在备份列表中找到目标备份。
2. 点击向上按钮。
3. 确认覆盖当前存档。

恢复会替换当前本地 Mindustry 存档，请在操作前确认目标备份正确。

### 编辑备份中的地图

1. 在备份列表中点击铅笔按钮。
2. 进入地图编辑流程。
3. 保存后，BetterSave 会把编辑结果写回备份。

### 删除备份

1. 在备份列表中点击删除按钮。
2. 确认后删除该备份。

## 多玩家档案

打开 `设置 -> 存档 -> 多玩家`。

多玩家功能用于在同一台设备上维护多个本地玩家档案。每个玩家档案可以保存自己的当前存档状态。

可用操作：

- 添加玩家
- 重命名玩家
- 切换玩家
- 删除玩家

切换玩家会替换当前本地存档，请先确认当前存档是否需要备份或上传。

## 云存档准备

当前云存档支持 GitHub 和 Gitee。两者都保持覆盖式同步语义，但底层 API 不同：GitHub 使用 Git Data API 的 blob/tree/commit/updateRef 流程，Gitee 使用一次 commits actions 提交来模拟覆盖同步。

### 创建 GitHub 仓库

1. 在 GitHub 创建一个仓库。
2. 建议使用私人仓库。
3. 确认仓库中存在目标分支，例如 `main`。

BetterSave 会把云存档写入该仓库。上传时会用一棵新的 Git tree 覆盖云端同步内容；未变化文件会复用原有 Git blob，避免每次重新上传所有文件。

### 创建 Gitee 仓库

1. 在 Gitee 创建一个仓库。
2. 建议使用私人仓库。
3. 确认仓库中存在目标分支，例如 `master` 或 `main`。

BetterSave 会把云存档写入该仓库。Gitee 不使用 GitHub 的 `updateRef` 流程，而是通过一次多文件 commit 提交新增、更新和删除操作。

Gitee 配置里的 `用户名` 和 `仓库名称` 要按浏览器地址填写，并且都必须使用小写。例如仓库地址是：

```text
https://gitee.com/omtso/mindustry-saves
```

则填写：

```text
用户名：omtso
仓库名称：mindustry-saves
分支：地址中没有显示分支时，通常填仓库默认分支，例如 master 或 main
```

如果仓库在组织或企业空间下，`用户名` 要填写组织/企业的地址 path，而不是你的个人昵称。

### 创建 Gitee Token

需要创建一个可访问目标仓库的 Gitee 私人令牌。令牌至少需要能读取仓库内容、读取 tree/blob，并向目标分支提交文件变更。

#### 具体获取步骤

1. 登录 Gitee 官网。
2. 点击右上角个人头像，在弹出的菜单中选择 `设置`。
3. 在左侧导航栏依次进入 `安全设置` -> `私人令牌`。
4. 点击右上角 `生成新令牌`。
5. 填写令牌描述，例如 `Mindustry-BetterSave`，方便之后识别用途。
6. 选择过期时间，例如 30 天、半年、1 年，或按自己的安全需求设置。
7. 勾选权限：
   - 管理 BetterSave 云存档必须勾选 `repo`，该权限包含读取、写入和操作仓库所需权限。
   - 如果还需要读取个人信息，可以额外勾选 `user_info`，BetterSave 云存档本身不强制需要。
8. 点击 `提交`，并按 Gitee 要求输入账号密码完成安全验证。
9. 复制生成的私人令牌。

> 重要提示：私人令牌只应保存在本地，不要提交到仓库、聊天记录或截图中。如果令牌泄露，应立即在 Gitee 删除旧令牌并重新生成。

### 创建 GitHub Token

需要创建一个可访问目标仓库的 **GitHub Personal Access Token (Classic)**。

Token 至少需要能读取和写入目标仓库内容。对于私人仓库，需要确保 token 对该私人仓库有权限。

#### 💡 具体获取步骤

1. **登录 GitHub**：在浏览器中登录你的 GitHub 账号。
2. **进入设置 (Settings)**：点击页面右上角的个人头像，在下拉菜单中选择 **Settings**。
3. **进入开发者设置**：在左侧导航栏滑到最底部，点击 **Developer settings**。
4. **选择 Token 类型**：在左侧选择 **Personal access tokens** -> 点击 **Tokens (classic)**。
5. **生成新 Token**：点击右上角的 **Generate new token**，选择 **Generate new token (classic)**。
6. **配置 Token 参数**：
   * **Note**：填入一个用途说明（例如：`Mindustry-BetterSave`）。
   * **Expiration**：选择过期时间（建议选择 *No expiration* 永不过期，或根据隐私需求自定义）。
   * **Select scopes (权限勾选)**：
     
     | 仓库类型 | 勾选权限 | 说明 |
     | :--- | :--- | :--- |
     | **私人仓库 (Private)** | 勾选 **`repo`** 全选框 | 会自动包含 `repo:status`、`repo_deployment`、`public_repo` 等所有子项。 |
     | **公开仓库 (Public)** | 只需勾选 **`public_repo`** | 仅赋予公开仓库的读写权限。 |

7. **生成并复制**：滑到页面底部，点击绿色的 **Generate token** 按钮。
8. **保存密钥**：复制生成的 Token 字符串。

> ⚠️ **重要提示**
> Token 只会完整显示 **这一次**，刷新或离开页面后将再也无法查看。请务必先将其复制并安全保存在本地。

### 配置云存档

打开：

```text
设置 -> 存档 -> 云存档选项
```

填写：

- `令牌`：GitHub token 或 Gitee token
- `用户名`：仓库地址里的 owner/namespace；Gitee 必须小写，例如 `https://gitee.com/omtso/mindustry-saves` 中的 `omtso`
- `仓库名称`：仓库地址里的 repo path；Gitee 必须小写，例如 `https://gitee.com/omtso/mindustry-saves` 中的 `mindustry-saves`
- `分支`：GitHub 常见为 `main`，Gitee 可能是 `master` 或 `main`
- `当前仓库`：点击按钮在 GitHub 和 Gitee 之间切换

然后：

1. 启用云存档。
2. 点击 `保存配置`。
3. 点击 `测试`。

配置文件保存在本地：

```text
<Mindustry 存档目录>/../betterSave/config/cloudsave.json
```

该文件包含 token，只保存在本地。BetterSave 上传时会跳过它，不会把它写入云端仓库。

## 云存档上传

上传会用本地同步内容覆盖云端仓库中的云存档。

为了减少耗时，BetterSave 会对同步文件计算 hash。如果某个文件和云端记录一致，会复用云端已有 blob；只有新增或变化的文件才会重新上传。

操作方式：

1. 打开 `云存档选项`，点击 `上传`。
2. 或者在 `存档管理` 底部点击上传按钮。
3. 确认上传。

上传前 BetterSave 会自动保存当前游戏状态，并生成一份名为 `cloudsave` 的本地备份。

上传内容包括：

- `betterSave/config` 中需要同步的配置
- `betterSave/saves` 中的备份
- `betterSave/players` 中的玩家档案
- 云端同步元数据 `meta/sync.json`

不会上传：

- `config/cloudsave.json`
- `config/sync.json`
- `config/editor.json`
- 玩家 `.smsf` 中历史残留的 token 配置文件

如果上传前检测到云端比本地更新，会提示：

```text
云端存档比本地更新。本地可能已过期，是否仍然上传并覆盖云端?
```

如果确认继续，云端内容会被本地内容覆盖。

## 云存档下载

下载会把云端仓库中的云存档同步到本地，并用云端内容覆盖本地同步目录。

如果云端同步元数据中包含文件 hash 清单，BetterSave 只会下载新增或变化的文件；本地已有且 hash 一致的文件会保留，不会重复下载。旧版云端元数据或缺少 hash 清单时，会退回全量下载。

操作方式：

1. 打开 `云存档选项`，点击 `下载`。
2. 或者在 `存档管理` 底部点击下载按钮。
3. 确认下载。

下载会替换：

- 本地同步配置
- 本地备份
- 本地玩家档案

下载不会替换本机的 `config/cloudsave.json`，因此本机云存档 token 配置会保留。

如果下载前检测到本地比云端更新，会提示：

```text
本地存档比云端更新。云端可能已过期，是否仍然下载并覆盖本地?
```

如果确认继续，本地内容会被云端内容覆盖。

## 启动时云端检查

如果启用了云存档，游戏启动后 BetterSave 会在后台检查云端同步元数据。

只有当云端 `updatedAt` 比本地记录更新时，才会弹出下载提示。

如果云端没有更新，不会弹窗。

## 测试按钮说明

`云存档选项` 中的 `测试` 按钮会按当前选择的仓库类型检查 GitHub 或 Gitee API 是否可用，并读取本地和云端同步状态。

测试成功时会显示：

- 本地存档时间
- 云端存档时间
- 本地设备
- 云端设备
- 结论

结论含义：

- `本地过期`：云端存档比本地记录更新，建议先下载。
- `云端过期`：本地存档比云端更新，建议上传。
- `本地和云端都有更新`：两边都可能有未同步内容，需要手动判断保留哪一边。
- `本地和云端一致`：没有检测到任一侧更新。

如果仓库 API 测试失败，会显示 `测试失败`。

## 同步规则

当前云同步是覆盖式同步，不是增量合并。

上传时：

- GitHub：用当前本地同步内容生成新的 Git tree，创建 commit，并将目标分支指向新 commit。
- Gitee：用一次 commits actions 提交新增、更新和删除操作。
- 未变化文件复用云端已有 Git blob 或跳过提交，只有新增或变化文件需要传输。
- 云端 BetterSave 同步路径中没有出现在本地同步内容里的文件会被删除。

下载时：

- 新版云端元数据下，只下载新增或变化的文件。
- 旧版或缺失元数据时，退回全量下载。
- 用云端内容替换本地同步目录，并删除云端不存在的本地同步文件。
- 保留本机 token 配置。

当前不会自动合并冲突。如果多台设备同时修改，用户需要根据提示选择上传覆盖云端，或者下载覆盖本地。

注意：这里的“增量”只表示减少网络传输，不表示自动合并。用户确认上传或下载后，最终结果仍然是其中一边覆盖另一边。

## 云端仓库结构

上传后，云端仓库中通常会出现：

```text
config/
saves/
players/
meta/sync.json
```

其中 `meta/sync.json` 用于记录云端同步状态，例如更新时间、设备信息、文件数量，以及用于增量传输的文件 hash 清单。

新版元数据示例：

```json
{
  "version": 2,
  "updatedAt": "2026-07-05T12:30:00.000Z",
  "localSyncedAt": "2026-07-05T12:30:05.000Z",
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

## 常见问题

### 为什么建议使用私人仓库？

云存档里包含你的游戏存档、备份和玩家档案。虽然 BetterSave 会过滤云存档 token，但存档本身仍然可能包含个人游戏数据，因此建议使用私人仓库。

### Token 会上传到云端仓库吗？

正常不会。

BetterSave 会跳过本地 `config/cloudsave.json`，并清理玩家备份中历史残留的 token 配置文件。如果 GitHub 返回 `422 Secret detected in content`，说明仍有疑似 token 内容进入了上传文件，需要检查本地备份内容。

### 为什么上传或下载前会提示本地过期/云端过期？

BetterSave 会比较本地和云端的同步元数据。

- 云端更新时间更新：提示本地过期。
- 本地更新时间更新、本地文件在上次同步后被修改，或删除/重命名本地备份、修改玩家档案等本地操作发生后：提示云端过期。

这个提示只是防止误覆盖。确认后仍然可以继续覆盖。

### 只打开游戏会不会导致本地变成更新？

正常不会。

BetterSave 会忽略 `config/editor.json` 这类编辑器临时清理状态。单纯启动游戏触发临时文件清理，不应该被当作新的存档内容。

### 支持 Gitee 吗？

支持。云存档选项里点击仓库类型按钮切换到 Gitee，填写 Gitee token、owner、repo 和 branch 后保存并测试即可。Gitee 上传使用单次多文件 commit，进度表示本次准备提交的新增或变化文件数；提交请求本身仍可能需要等待。

### 支持自动合并多设备冲突吗？

暂不支持。

当前策略是检测到可能冲突时弹出提示，由用户决定覆盖哪一边。

### 为什么第一次同步还是比较慢？

第一次上传或下载没有可复用的 hash 清单，需要传输完整同步内容。之后再次上传或下载时，BetterSave 才能根据 `meta/sync.json` 中的文件 hash 判断哪些文件没有变化。

如果你清空云端，下一次上传也会重新全量上传，这是正常现象。

## 注意事项

- 上传和下载都是覆盖操作，请在确认前看清提示。
- 多设备使用时，建议先点击 `测试` 查看本地和云端状态。
- 第一次使用云存档前，建议先手动创建一次本地备份。
- 不要把云存档仓库当作普通代码仓库混用。
- 当前项目仍在开发中，建议重要存档保留额外备份。

## 开发状态

BetterSave 当前版本仍处于开发阶段。核心云同步流程已经支持 GitHub 和 Gitee，并通过文件 hash 做增量传输，但仍有改进空间，例如：

- 更细粒度的冲突处理
- 更清晰的设备名称设置
- 更完整的错误提示
- 对更多 Git 服务的适配



## 致谢与开源许可 (Credits & License)

本模组的整体基于 **MIT License** 开源。

同时，本模组在开发过程中参考并复用了项目 [savemaster](https://github.com/DSFdsfWxp/savemaster/tree/main) 的核心序列化、反序列化以及基础文件读写函数。非常感谢原作者 **Wxp** 的开源贡献！

根据 MIT 开源协议的要求，以下保留原作者的版权声明：

```text
MIT License

Copyright (c) 2024 Wxp

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
