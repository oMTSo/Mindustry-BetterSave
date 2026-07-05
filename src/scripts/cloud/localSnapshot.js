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

function checkCancelled(cancelToken) {
    if (!cancelToken) return;
    if (typeof cancelToken.throwIfCancelled == 'function') {
        cancelToken.throwIfCancelled();
        return;
    }
    if (cancelToken.cancelled) {
        let e = new Error('Cloud sync cancelled.');
        e.cancelled = true;
        throw e;
    }
}

function sha256(data) {
    let digest = java.security.MessageDigest.getInstance('SHA-256').digest(data);
    let ret = '';
    for (let i = 0; i < digest.length; i++) {
        let v = digest[i];
        if (v < 0) v += 256;
        let s = v.toString(16);
        if (s.length < 2) s = '0' + s;
        ret += s;
    }
    return ret;
}

function fileEntry(path, data, includeData) {
    let ret = {
        path: path,
        hash: sha256(data),
        size: data.length
    };
    if (includeData) ret.data = data;
    return ret;
}

function makeManifest(files) {
    let ret = {};
    for (let f of files) {
        ret[f.path] = {
            hash: f.hash || '',
            size: f.size || 0,
            blobSha: f.blobSha || ''
        };
    }
    return ret;
}

function hasFileManifest(meta) {
    return meta && meta.version >= 2 && meta.files;
}

function readLocalMeta() {
    if (!config.isInited()) config.init();
    return Object.assign({
        version: 2,
        updatedAt: '',
        localSyncedAt: '',
        deviceId: makeDeviceId(),
        deviceName: 'Mindustry',
        fileCount: 0,
        files: {}
    }, config.readConfig(syncConfigName));
}

function writeLocalMeta(meta) {
    if (!config.isInited()) config.init();
    meta.localSyncedAt = new Date().toISOString();
    config.writeConfig(syncConfigName, meta);
}

function makeUploadMeta(files) {
    let old = readLocalMeta();
    let fileCount = files.length;
    return {
        version: 2,
        updatedAt: new Date().toISOString(),
        localSyncedAt: new Date().toISOString(),
        deviceId: old.deviceId || makeDeviceId(),
        deviceName: old.deviceName || 'Mindustry',
        fileCount: fileCount,
        files: makeManifest(files)
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

function readLocalFilesInDir(dir, prefix, options, cancelToken) {
    let ret = [];
    if (!fs.pathExist(dir)) return ret;

    options = Object.assign({
        includeData: true,
        sanitizePlayers: true
    }, options || {});

    let lst = fs.readDir(dir);
    for (let fn of lst) {
        checkCancelled(cancelToken);
        if (!shouldSyncLocalFile(prefix, fn)) continue;

        let abs = dir + '/' + fn;
        if (fs.isDir(abs)) continue;

        let data = prefix == 'players' && options.sanitizePlayers ? sanitizePlayerData(abs) : fs.readFile(abs);
        ret.push(fileEntry(prefix + '/' + fn, data, options.includeData));
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

function removeLocalFilesNotInManifest(dir, prefix, manifest) {
    if (!fs.pathExist(dir)) return;
    let lst = fs.readDir(dir);
    for (let fn of lst) {
        if (!shouldSyncLocalFile(prefix, fn)) continue;

        let abs = dir + '/' + fn;
        if (fs.isDir(abs)) continue;

        let remotePath = prefix + '/' + fn;
        if (typeof manifest[remotePath] == 'undefined') fs.removeFile(abs);
    }
}

exports.collectUploadFiles = (cancelToken) => {
    if (!config.isInited()) config.init();
    save.init();

    let files = [];
    files = files.concat(readLocalFilesInDir(config.configDir, 'config', { includeData: true, sanitizePlayers: true }, cancelToken));
    files = files.concat(readLocalFilesInDir(config.saveDir, 'saves', { includeData: true, sanitizePlayers: true }, cancelToken));
    files = files.concat(readLocalFilesInDir(config.playerDir, 'players', { includeData: true, sanitizePlayers: true }, cancelToken));
    return files;
};

exports.collectLocalFileManifest = (cancelToken) => {
    if (!config.isInited()) config.init();

    let files = [];
    files = files.concat(readLocalFilesInDir(config.configDir, 'config', { includeData: false, sanitizePlayers: false }, cancelToken));
    files = files.concat(readLocalFilesInDir(config.saveDir, 'saves', { includeData: false, sanitizePlayers: false }, cancelToken));
    files = files.concat(readLocalFilesInDir(config.playerDir, 'players', { includeData: false, sanitizePlayers: false }, cancelToken));
    return makeManifest(files);
};

exports.replaceLocalFiles = (remoteFiles, remoteMeta) => {
    if (!config.isInited()) config.init();

    let preservedCloudConfig = readPreservedCloudConfig();

    if (hasFileManifest(remoteMeta)) {
        removeLocalFilesNotInManifest(config.configDir, 'config', remoteMeta.files);
        removeLocalFilesNotInManifest(config.saveDir, 'saves', remoteMeta.files);
        removeLocalFilesNotInManifest(config.playerDir, 'players', remoteMeta.files);
    } else {
        fs.removeFilesInDir(config.configDir);
        fs.removeFilesInDir(config.saveDir);
        fs.removeFilesInDir(config.playerDir);
    }

    for (let f of remoteFiles) {
        writeDownloadedFile(f.path, f.data);
        if (isSyncedPath(f.path) && f.path != 'config/' + cloudConfigFile) {
            print('Downloaded: ' + f.path);
        }
    }

    restorePreservedCloudConfig(preservedCloudConfig);
};

exports.makeMetaFile = (files) => {
    let manifestFiles = files.slice();
    let meta = makeUploadMeta(files);
    let ret = {
        path: remoteSyncPath,
        meta: meta
    };
    ret.makeData = () => {
        ret.meta.fileCount = manifestFiles.length;
        ret.meta.files = makeManifest(manifestFiles);
        ret.data = new java.lang.String(JSON.stringify(ret.meta)).getBytes('UTF-8');
        ret.hash = sha256(ret.data);
        ret.size = ret.data.length;
        return ret.data;
    };
    ret.makeData();
    return ret;
};

exports.readLocalMeta = readLocalMeta;
exports.writeLocalMeta = writeLocalMeta;
exports.remoteSyncPath = remoteSyncPath;
exports.hasFileManifest = hasFileManifest;
exports.makeManifest = makeManifest;

exports.latestLocalModifiedTime = () => {
    if (!config.isInited()) config.init();
    return Math.max(
        latestModifiedInDir(config.configDir, 'config'),
        latestModifiedInDir(config.saveDir, 'saves'),
        latestModifiedInDir(config.playerDir, 'players')
    );
};
