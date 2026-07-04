// 本地同步快照：收集上传文件，过滤敏感配置，并用远端文件替换本地副本。
const config = require('bettersave/core/config');
const save = require('bettersave/core/save');
const fs = require('bettersave/tools/file');

const cloudConfigFile = 'cloudsave.json';
const syncConfigName = 'sync';
const syncConfigFile = 'sync.json';
const remoteSyncPath = 'meta/sync.json';
const archivedCloudConfigPath = '../bettersave/config/cloudsave.json';
const ignoredConfigFiles = [cloudConfigFile, syncConfigFile, 'editor.json'];

function isSyncedPath(path) {
    return path.startsWith('config/') || path.startsWith('saves/') || path.startsWith('players/');
}

function checkSafeRemotePath(path) {
    if (path.includes('..') || path.startsWith('/') || path.startsWith('\\')) {
        throw new Error('Unsafe remote path: ' + path);
    }
}

function readPreservedCloudConfig() {
    let path = config.configDir + '/' + cloudConfigFile;
    if (!fs.pathExist(path)) return null;
    return fs.readFile(path);
}

// 只有真正属于云存档的数据才参与上传和本地更新时间判断。
function shouldSyncLocalFile(prefix, fn) {
    if (prefix == 'config' && ignoredConfigFiles.includes(fn)) return false;
    return true;
}

function makeDeviceId() {
    return new Date().getTime().toString() + '-' + Math.floor(Math.random() * 1000000000).toString();
}

function readLocalMeta() {
    if (!config.isInited()) config.init();
    return Object.assign({
        version: 1,
        updatedAt: '',
        localSyncedAt: '',
        deviceId: makeDeviceId(),
        deviceName: 'Mindustry',
        fileCount: 0
    }, config.readConfig(syncConfigName));
}

function writeLocalMeta(meta) {
    if (!config.isInited()) config.init();
    meta.localSyncedAt = new Date().toISOString();
    config.writeConfig(syncConfigName, meta);
}

function makeUploadMeta(fileCount) {
    let old = readLocalMeta();
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        localSyncedAt: new Date().toISOString(),
        deviceId: old.deviceId || makeDeviceId(),
        deviceName: old.deviceName || 'Mindustry',
        fileCount: fileCount
    };
}

function restorePreservedCloudConfig(data) {
    if (data == null) return;
    fs.writeFile(config.configDir + '/' + cloudConfigFile, data);
}

function sanitizePlayerData(path) {
    try {
        let obj = save.readFile(path);
        obj.readFiles();
        let files = [];
        for (let f of obj.files) {
            if (f.name == archivedCloudConfigPath) continue;
            files.push(f);
        }
        obj.files = files;
        return obj.makeData();
    } catch (e) {
        print(e);
        return fs.readFile(path);
    }
}

function readLocalFilesInDir(dir, prefix) {
    let ret = [];
    if (!fs.pathExist(dir)) return ret;

    let lst = fs.readDir(dir);
    for (let fn of lst) {
        if (!shouldSyncLocalFile(prefix, fn)) continue;

        let abs = dir + '/' + fn;
        if (fs.isDir(abs)) continue;

        ret.push({
            path: prefix + '/' + fn,
            data: prefix == 'players' ? sanitizePlayerData(abs) : fs.readFile(abs)
        });
    }
    return ret;
}

function writeDownloadedFile(remotePath, data) {
    checkSafeRemotePath(remotePath);
    if (!isSyncedPath(remotePath)) return;
    if (remotePath == 'config/' + cloudConfigFile) return;

    if (remotePath.startsWith('config/')) {
        fs.writeFile(config.configDir + '/' + remotePath.substring(7), data);
    } else if (remotePath.startsWith('saves/')) {
        fs.writeFile(config.saveDir + '/' + remotePath.substring(6), data);
    } else if (remotePath.startsWith('players/')) {
        fs.writeFile(config.playerDir + '/' + remotePath.substring(8), data);
    }
}

function latestModifiedInDir(dir, prefix) {
    if (!fs.pathExist(dir)) return 0;
    let latest = 0;
    let lst = fs.readDir(dir);
    for (let fn of lst) {
        if (!shouldSyncLocalFile(prefix, fn)) continue;

        let abs = dir + '/' + fn;
        if (fs.isDir(abs)) continue;

        let m = new java.io.File(abs).lastModified();
        if (m > latest) latest = m;
    }
    return latest;
}

exports.collectUploadFiles = () => {
    if (!config.isInited()) config.init();
    save.init();

    let files = [];
    files = files.concat(readLocalFilesInDir(config.configDir, 'config'));
    files = files.concat(readLocalFilesInDir(config.saveDir, 'saves'));
    files = files.concat(readLocalFilesInDir(config.playerDir, 'players'));
    return files;
};

exports.replaceLocalFiles = (remoteFiles) => {
    if (!config.isInited()) config.init();

    let preservedCloudConfig = readPreservedCloudConfig();

    fs.removeFilesInDir(config.configDir);
    fs.removeFilesInDir(config.saveDir);
    fs.removeFilesInDir(config.playerDir);

    for (let f of remoteFiles) {
        writeDownloadedFile(f.path, f.data);
        if (isSyncedPath(f.path) && f.path != 'config/' + cloudConfigFile) {
            print('Downloaded: ' + f.path);
        }
    }

    restorePreservedCloudConfig(preservedCloudConfig);
};

exports.makeMetaFile = (fileCount) => {
    let meta = makeUploadMeta(fileCount);
    return {
        path: remoteSyncPath,
        data: new java.lang.String(JSON.stringify(meta)).getBytes('UTF-8'),
        meta: meta
    };
};

exports.readLocalMeta = readLocalMeta;
exports.writeLocalMeta = writeLocalMeta;
exports.remoteSyncPath = remoteSyncPath;

exports.latestLocalModifiedTime = () => {
    if (!config.isInited()) config.init();
    return Math.max(
        latestModifiedInDir(config.configDir, 'config'),
        latestModifiedInDir(config.saveDir, 'saves'),
        latestModifiedInDir(config.playerDir, 'players')
    );
};
