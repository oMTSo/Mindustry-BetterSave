![7b5ceff2262bc296ac30a751a9cca9dd](https://raw.githubusercontent.com/oMTSo/images/main/img/20260705045622656.png)

# BetterSave

- 在寻找 [中文说明](https://github.com/oMTSo/Mindustry-BetterSave/blob/master/README.md) ？

BetterSave is a Mindustry script mod designed to enhance local save management and provide cloud save synchronization based on GitHub or Gitee repositories.

This mod is adapted from SaveMaster, inheriting many of its foundational functions, save packaging logic, and UI structures. Building upon that, BetterSave introduces features such as multi-player profile management, Git repository cloud sync, sync status verification, and a more comprehensive cloud overwrite workflow.

The project is currently under active development. The cloud save feature centers around an "overwrite sync" design philosophy and does not handle complex merge conflicts for now. The transport layer leverages file hashes to reuse unchanged files, effectively minimizing upload and download times on slower devices, such as mobile phones.

⚠️ **<font color="red">Warning: This mod is still under development. Critical bugs may exist. Please back up your saves before use!</font>**

## Main Features

- Package current Mindustry saves, blueprints, and essential campaign settings into a `.smsf` backup.
- Create, restore, edit, and delete local backups directly in-game.
- Manage multiple local player profiles and seamlessly switch between them.
- Utilize GitHub or Gitee repositories as backends for cloud saves.
- Support uploading local saves to the cloud (local content overwrites cloud content).
- Support downloading cloud saves to local storage (cloud content overwrites local content).
- Incremental transmission based on file hashes for uploads and downloads, reusing or preserving unchanged files whenever possible.
- Background checks at startup to determine if the cloud is newer than the local save, prompting a download only when necessary.
- Timestamp validation before uploading or downloading to prevent overwriting newer saves without warning.
- A cloud sync testing interface that displays local time, cloud time, local device, cloud device, and the sync conclusion.

## Installation

1. Download or package this project.
2. Place the mod into the Mindustry `mods` directory.
3. Launch Mindustry.
4. Open the `Saves` category in the Settings menu.

The mod entry point is located at:

```text
Settings -> Saves

```

It includes the following sections:

* `Save Management`
* `Multi-Player`
* `Cloud Save Options`
* `About`

## Local Save Management

Open `Settings -> Saves -> Save Management`.

### Backing Up the Current Save

1. Click the down arrow button next to the current save entry.
2. Enter a backup name.
3. After confirming, BetterSave will save the current game state and generate a `.smsf` backup.

The backup package includes:

* Current game save files
* Blueprint files
* Certain settings related to campaign progress

### Restoring a Backup

1. Locate the target backup in the backup list.
2. Click the up arrow button.
3. Confirm overwriting the current save.

> **Note:** Restoring will replace your current local Mindustry save. Please make sure the target backup is correct before proceeding.

### Editing Maps Within a Backup

1. Click the pencil icon on a backup entry in the list.
2. Enter the map editing process.
3. After saving, BetterSave will write the modifications back into the backup file.

### Deleting a Backup

1. Click the delete button on a backup entry in the list.
2. Confirm to delete the backup permanently.

## Multi-Player Profiles

Open `Settings -> Saves -> Multi-Player`.

The multi-player feature allows you to maintain multiple local player profiles on the same device. Each profile can retain its own independent game save state.

Available operations:

* Add Player
* Rename Player
* Switch Player
* Delete Player

> **Note:** Switching players will replace the current local save. Please ensure your current save is backed up or uploaded if necessary.

## Cloud Save Preparation

Currently, cloud saving supports GitHub and Gitee. Both share an overwrite-based sync mechanism but utilize different underlying APIs: GitHub relies on the Git Data API workflow (`blob/tree/commit/updateRef`), while Gitee simulates an overwrite sync via a single multi-file commit action.

### Creating a GitHub Repository

1. Create a repository on GitHub.
2. A **private repository** is highly recommended.
3. Ensure the target branch (e.g., `main`) exists in the repository.

BetterSave will write cloud saves to this repository. During upload, it generates a new Git tree to overwrite the synchronized content; unchanged files will reuse existing Git blobs to avoid re-uploading everything.

### Creating a Gitee Repository

1. Create a repository on Gitee.
2. A **private repository** is highly recommended.
3. Ensure the target branch (e.g., `master` or `main`) exists in the repository.

BetterSave will write cloud saves to this repository. Unlike GitHub, Gitee uses a single multi-file commit to perform additions, updates, and deletions simultaneously.

The `Username` and `Repository Name` in the Gitee configuration must match your browser's address bar and **must be entirely in lowercase**. For example, if your repository URL is:

```text
[https://gitee.com/omtso/mindustry-saves](https://gitee.com/omtso/mindustry-saves)

```

You should fill it out as follows:

```text
Username: omtso
Repository Name: mindustry-saves
Branch: If no branch is shown in the URL, enter the default branch, usually master or main

```

If the repository belongs to an organization or enterprise workspace, the `Username` field should be the organization/enterprise URL path string, not your personal nickname.

### Creating a Gitee Token

You need to generate a Personal Access Token that can access the target repository. The token must have permissions to read repository content, read trees/blobs, and commit file changes to the target branch.

#### Step-by-Step Instructions:

1. Log in to the official Gitee website.
2. Click your avatar in the top right corner and select `Settings` from the dropdown menu.
3. In the left navigation bar, go to `Security Settings` -> `Personal Access Tokens`.
4. Click `Generate New Token` in the top right corner.
5. Provide a description for the token (e.g., `Mindustry-BetterSave`) to identify its purpose later.
6. Choose an expiration duration (e.g., 30 days, 6 months, 1 year, or customized per your security preferences).
7. Select permissions:
* Managing BetterSave cloud saves **requires checking `repo**`, which covers reading, writing, and executing repository operations.
* You may optionally check `user_info` if you want it to read basic profile info, though it is not strictly required by the mod.


8. Click `Submit` and complete the security verification by entering your password as prompted.
9. Copy the generated personal access token.

> **Important:** Keep your personal access token secure locally. Never commit it to repositories, share it in chat logs, or include it in screenshots. If a token is compromised, revoke it immediately on Gitee and generate a new one.

### Creating a GitHub Token

You need to create a **GitHub Personal Access Token (Classic)** that has access to your target repository.

The token must be capable of reading and writing to the repository. For private repositories, ensure the token scopes cover private repository management.

#### 💡 Step-by-Step Instructions:

1. **Log in to GitHub**: Access your GitHub account via a web browser.
2. **Go to Settings**: Click your profile icon in the upper-right corner and select **Settings**.
3. **Navigate to Developer Settings**: Scroll to the bottom of the left sidebar and click **Developer settings**.
4. **Select Token Type**: In the left sidebar, click **Personal access tokens** -> **Tokens (classic)**.
5. **Generate New Token**: Click the **Generate new token** button in the top right, then choose **Generate new token (classic)**.
6. **Configure Token Parameters**:
* **Note**: Enter a descriptive note (e.g., `Mindustry-BetterSave`).
* **Expiration**: Select an expiration period (Choosing *No expiration* is convenient, or customize it based on your security policies).
* **Select scopes (Permissions)**:
| Repository Type | Required Scopes | Description |
| --- | --- | --- |
| **Private Repository** | Check the main **`repo`** box | This automatically includes all sub-items like `repo:status`, `repo_deployment`, `public_repo`, etc. |
| **Public Repository** | Check **`public_repo`** only | Grants read/write access restricted to public repositories only. |




7. **Generate and Copy**: Scroll to the bottom of the page and click the green **Generate token** button.
8. **Save Your Token**: Copy the generated token string immediately.

> ⚠️ **CRITICAL WARNING**
> The token will only be displayed **ONCE**. Once you refresh or leave the page, you cannot view it again. Make sure to copy and save it securely on your local device.

### Configuring Cloud Save

Navigate to:

```text
Settings -> Saves -> Cloud Save Options

```

Fill in the required fields:

* `Token`: Your GitHub or Gitee personal access token.
* `Username`: The owner/namespace from your repository URL (Must be lowercase for Gitee, e.g., `omtso` from `https://gitee.com/omtso/mindustry-saves`).
* `Repository Name`: The repo path string from your URL (Must be lowercase for Gitee, e.g., `mindustry-saves` from `https://gitee.com/omtso/mindustry-saves`).
* `Branch`: Typically `main` for GitHub, or `master`/`main` for Gitee.
* `Current Repository`: Toggle this button to switch between GitHub and Gitee backends.

Then follow these steps:

1. Enable Cloud Save.
2. Click `Save Configuration`.
3. Click `Test`.

The configuration file is saved locally at:

```text
<Mindustry Save Directory>/../betterSave/config/cloudsave.json

```

This file contains your token and is kept local. BetterSave automatically excludes it from uploads, ensuring it is never pushed to your remote repository.

## Cloud Save Upload

Uploading will completely overwrite the content in your remote cloud repository with your local sync data.

To optimize transfer speeds, BetterSave computes hashes for all synced files. If a file matches the cloud record, it reuses the existing remote blob; only new or modified files will be uploaded.

How to perform an upload:

1. Open `Cloud Save Options` and click `Upload`.
2. Alternatively, click the Upload button located at the bottom of the `Save Management` screen.
3. Confirm the upload prompt.

Before uploading, BetterSave automatically saves the current game state and creates a local backup named `cloudsave`.

Uploaded content includes:

* Essential configurations under `betterSave/config` that require syncing.
* Backups under `betterSave/saves`.
* Player profiles under `betterSave/players`.
* Cloud sync metadata under `meta/sync.json`.

Excluded from uploads:

* `config/cloudsave.json`
* `config/sync.json`
* `config/editor.json`
* Legacy token configuration files that might reside inside player `.smsf` history.

If the mod detects that the cloud copy is newer than your local state before uploading, it will prompt:

```text
The cloud save is newer than your local save. Your local save may be outdated. Do you still want to upload and overwrite the cloud?

```

If you choose to proceed, the cloud repository will be overwritten by your local files.

## Cloud Save Download

Downloading synchronizes cloud save files from the remote repository to your device, overwriting the local sync directory with the cloud data.

If the cloud metadata contains a valid file hash manifest, BetterSave will only fetch new or modified files. Local files that match the cloud hashes are kept intact, saving bandwidth. It falls back to a full download if it detects an older metadata scheme or missing hash lists.

How to perform a download:

1. Open `Cloud Save Options` and click `Download`.
2. Alternatively, click the Download button at the bottom of the `Save Management` interface.
3. Confirm the download prompt.

Downloading replaces:

* Local sync configuration
* Local backups
* Local player profiles

Downloading **does not** overwrite your device's `config/cloudsave.json`, meaning your cloud token configuration remains untouched.

If the mod detects that your local files are newer than the cloud state before downloading, it will prompt:

```text
The local save is newer than the cloud save. The cloud save may be outdated. Do you still want to download and overwrite your local saves?

```

If you choose to proceed, your local save files will be completely overwritten by the cloud version.

## Startup Cloud Check

When cloud save is enabled, BetterSave runs a background check on the cloud metadata right after the game launches.

A download prompt will appear **only** if the cloud's `updatedAt` timestamp is newer than your local record.

If no newer cloud data is found, the game starts seamlessly without any intrusive pop-ups.

## Test Button Explanation

The `Test` button under `Cloud Save Options` verifies whether the GitHub or Gitee APIs are reachable based on your active settings. It then retrieves and compares local and remote synchronization states.

A successful test displays:

* Local save time
* Cloud save time
* Local device name
* Cloud device name
* Conclusion

Conclusion definitions:

* `Local Outdated`: The cloud save is newer than your local record. Downloading is recommended.
* `Cloud Outdated`: The local save is newer than the cloud record. Uploading is recommended.
* `Both Updated`: Changes exist on both sides, posing a potential sync conflict. Review and manually decide which side to preserve.
* `In Sync`: No changes detected on either side; both are identical.

If the repository API test fails, it displays `Test Failed`.

## Synchronization Rules

The current cloud sync design operates on an overwrite basis rather than incremental delta merging.

During Uploads:

* **GitHub**: Generates a new Git tree from your current local sync data, creates a commit, and moves the target branch head to this new commit.
* **Gitee**: Uses a single multi-file commit action to process additions, updates, and deletions concurrently.
* Unchanged files will reuse remote Git blobs or skip transfer entirely; only modified or new files are transmitted.
* Files present in the cloud's BetterSave path that no longer exist in the local sync directory will be deleted.

During Downloads:

* Under the modern metadata format, only new or modified files are downloaded.
* Legacy or missing metadata triggers a fallback full-download.
* The local sync directory is completely replaced with the cloud structure, and local files that do not exist in the cloud are purged.
* Your local machine token configurations are strictly preserved.

Conflict Resolution: Automatic merging is currently unsupported. If multiple devices modify data simultaneously, users must explicitly decide whether to upload (overwriting the cloud) or download (overwriting the local device) based on the timestamps provided.

*Note: "Incremental" implies reduced network usage during transfer, not automatic gameplay data merging. The final operation remains a unilateral overwrite.*

## Cloud Repository Structure

Following a successful upload, your cloud repository will look like this:

```text
config/
saves/
players/
meta/sync.json

```

The `meta/sync.json` file tracks cloud synchronization states—such as modification times, device metadata, total file counts, and file hash manifests utilized for incremental sync operations.

Example of a modern metadata file:

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

## FAQ

### Why is a private repository recommended?

Your cloud save files bundle game states, backups, and custom player profiles. Although BetterSave intentionally scrubs out cloud tokens, your game files might still contain personalized play data. Keeping the repository private guarantees your privacy.

### Will my token be uploaded to the cloud repository?

No, under normal circumstances.

BetterSave actively skips the local `config/cloudsave.json` file and purges historic, accidental token files out of player backups. If GitHub returns a `422 Secret detected in content` error, it indicates a token-like string was flagged inside your save files. Please verify your local backup files.

### Why do I see "Local Outdated" or "Cloud Outdated" warnings before syncing?

BetterSave cross-references local and remote sync metadata.

* If the cloud modification time is newer: It alerts you that the local save is outdated.
* If the local modification time is newer, if local files were changed since the last sync, or if backups/profiles were renamed or deleted locally: It alerts you that the cloud save is outdated.

These notifications are warning guardrails against accidental loss. You can still force an overwrite if you know what you are doing.

### Does just launching the game turn my local status into "Outdated"?

No, it should not.

BetterSave explicitly ignores temporary editor cleanups like `config/editor.json`. Launching the game and triggering minor internal temp file adjustments will not be flagged as actual save data changes.

### Is Gitee fully supported?

Yes. In the cloud save options, click the repository type button to toggle over to Gitee. Fill in your Gitee token, owner, repo, and branch name, then save and test. Gitee uploads batch files into a single commit action; the progress bar tracks the files prepared for the commit payload, though the transmission request itself may take a brief moment.

### Does it support automatic merging for multi-device conflicts?

Not at this stage.

The current strategy relies on prompting the user when a conflict is suspected, giving you total control over which device's history takes precedence.

### Why is the very first synchronization slow?

Initial synchronization lacks a baseline reference manifest on both ends, requiring a complete full-payload transfer. On subsequent actions, BetterSave reads `meta/sync.json` to skip uploading or downloading identical files.

If you purge your cloud repository manually, the next upload cycle will naturally default back to a full-payload upload.

## Notices & Disclaimers

* Uploading and downloading are irreversible overwrite operations. Please read the prompts carefully before confirming.
* When juggling multiple devices, it is best practice to click `Test` first to inspect current cross-device timestamps.
* Before setting up your cloud configuration for the first time, make a manual local backup of your critical progress.
* Avoid mixing your cloud save repository with general codebase projects.
* As this project is actively being developed, keeping an independent copy of invaluable saves is highly recommended.

## Development Roadmap

BetterSave is currently in its active development phase. While core workflows for GitHub and Gitee increments are fully stable using file hashing, there are several quality-of-life updates on the horizon:

* Finer, granular data conflict mitigation.
* Enhanced, explicit custom device naming settings.
* Richer, detailed error messaging.
* Adaptations for alternative Git hosting providers.

## Credits & License

The framework of this mod is open-sourced under the **MIT License**.

Furthermore, this project references and adapts core serialization, deserialization, and essential file I/O operations from the [savemaster](https://github.com/DSFdsfWxp/savemaster/tree/main) repository. Special thanks to the original author, **Wxp**, for their excellent open-source contributions!

In compliance with the MIT License requirements, the original copyright notice is preserved below:

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

```
