// 云同步入口：编排本地快照、GitHub API 和游戏重载流程。
const save = require('bettersave/core/save');
const control = require('bettersave/core/control');
const cloudConfig = require('bettersave/cloud/cloudConfig');
const localSnapshot = require('bettersave/cloud/localSnapshot');
const github = require('bettersave/cloud/githubGitApi');

exports.init = () => {
    cloudConfig.init();
    save.init();
};

exports.getConfig = () => {
    return cloudConfig.read();
};

exports.setConfig = (obj) => {
    cloudConfig.write(obj);
};

exports.isEnable = () => {
    return cloudConfig.isEnable(cloudConfig.read());
};

exports.test = (obj) => {
    let conf = obj || cloudConfig.read();
    return github.testRepository(conf);
};

exports.uploadSaves = () => {
    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) return;

    save.make('cloudsave').writeToSavePath();
    cloudConfig.updateLastSaveTime();

    let localFiles = localSnapshot.collectUploadFiles();
    github.replaceBranchTree(conf, localFiles, 'Full cloud sync via bettersave');
    print('Upload Sync Complete. Files: ' + localFiles.length);
};

exports.downloadSaves = () => {
    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) return;

    let remoteFiles = github.readBranchFiles(conf);

    control.closeCurrentMap(false);
    localSnapshot.replaceLocalFiles(remoteFiles);
    control.reloadSave();

    print('Download Sync Complete. Files: ' + remoteFiles.length);
};

exports.clearCloud = () => {
    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) return;

    github.replaceBranchTree(conf, [], 'Clear cloud save via bettersave');
    cloudConfig.clearLastSaveTime();
    print('Cloud Clear Complete.');
};

exports.writeSave = exports.uploadSaves;
exports.removeSave = exports.clearCloud;
exports.getSave = () => {
    return {
        readFiles: () => { exports.downloadSaves(); },
        apply: () => { }
    };
};
