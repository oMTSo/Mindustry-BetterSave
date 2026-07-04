// 本地同步快照：收集上传文件，过滤敏感配置，并用远端文件替换本地副本。
const config = require('bettersave/core/config');
const save = require('bettersave/core/save');
const fs = require('bettersave/tools/file');

const cloudConfigFile = 'cloudsave.json';
const archivedCloudConfigPath = '../bettersave/config/cloudsave.json';

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
        if (prefix == 'config' && fn == cloudConfigFile) continue;

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
