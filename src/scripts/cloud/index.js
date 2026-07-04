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

exports.testAsync = (obj, onSuccess, onError) => {
    let conf = obj || cloudConfig.read();
    runBackground(() => {
        return github.testRepository(conf);
    }, onSuccess, onError);
};

function postMain(f, arg) {
    if (!f) return;
    Core.app.post(() => {
        f(arg);
    });
}

// 后台线程只执行文件和网络任务；所有回调通过 Core.app.post 回到主线程。
function runBackground(task, onSuccess, onError) {
    Packages.arc.util.Threads.thread(() => {
        try {
            let result = task();
            postMain(onSuccess, result);
        } catch (e) {
            print(e);
            postMain(onError, e);
        }
    });
}

exports.uploadSavesAsync = (onSuccess, onError) => {
    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) {
        if (onSuccess) onSuccess(0);
        return;
    }

    try {
        save.make('cloudsave').writeToSavePath();
    } catch (e) {
        print(e);
        if (onError) onError(e);
        return;
    }

    runBackground(() => {
        let localFiles = localSnapshot.collectUploadFiles();
        github.replaceBranchTree(conf, localFiles, 'Full cloud sync via bettersave');
        cloudConfig.updateLastSaveTime();
        print('Upload Sync Complete. Files: ' + localFiles.length);
        return localFiles.length;
    }, onSuccess, onError);
};

exports.downloadSavesAsync = (onSuccess, onError) => {
    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) {
        if (onSuccess) onSuccess(0);
        return;
    }

    runBackground(() => {
        return github.readBranchFiles(conf);
    }, (remoteFiles) => {
        try {
            control.closeCurrentMap(false);
            localSnapshot.replaceLocalFiles(remoteFiles);
            control.reloadSave();
            print('Download Sync Complete. Files: ' + remoteFiles.length);
            if (onSuccess) onSuccess(remoteFiles.length);
        } catch (e) {
            print(e);
            if (onError) onError(e);
        }
    }, onError);
};

exports.clearCloudAsync = (onSuccess, onError) => {
    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) {
        if (onSuccess) onSuccess(0);
        return;
    }

    runBackground(() => {
        github.replaceBranchTree(conf, [], 'Clear cloud save via bettersave');
        cloudConfig.clearLastSaveTime();
        print('Cloud Clear Complete.');
        return 0;
    }, onSuccess, onError);
};
