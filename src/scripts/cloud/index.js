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

function concludeSyncState(state) {
    if (state.remoteTime > state.localBaseTime && state.localChanged) return 'bothChanged';
    if (state.remoteTime > state.localBaseTime) return 'localExpired';
    if (state.localChanged || state.localBaseTime > state.remoteTime) return 'remoteExpired';
    return 'synced';
}

exports.inspectSyncAsync = (obj, onSuccess, onError) => {
    let conf = obj || cloudConfig.read();
    runBackground(() => {
        let ok = github.testRepository(conf);
        if (!ok) return { ok: false };

        let state = syncState(conf);
        return {
            ok: true,
            state: state,
            conclusion: concludeSyncState(state)
        };
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

function metaTime(meta) {
    if (!meta || !meta.updatedAt) return 0;
    let t = new Date(meta.updatedAt).getTime();
    if (isNaN(t)) return 0;
    return t;
}

function syncState(conf) {
    let localMeta = localSnapshot.readLocalMeta();
    let remoteMeta = github.readRemoteMeta(conf);
    let localBaseTime = metaTime(localMeta);
    let localSyncedTime = metaTime({ updatedAt: localMeta.localSyncedAt });
    let latestLocalModifiedTime = localSnapshot.latestLocalModifiedTime();
    let localChanged = latestLocalModifiedTime > localSyncedTime + 2000;

    return {
        local: localMeta,
        remote: remoteMeta,
        localTime: localChanged ? latestLocalModifiedTime : localBaseTime,
        localBaseTime: localBaseTime,
        localChanged: localChanged,
        latestLocalModifiedTime: latestLocalModifiedTime,
        remoteTime: metaTime(remoteMeta)
    };
}

exports.checkRemoteUpdateAsync = (onSuccess, onError) => {
    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) {
        if (onSuccess) onSuccess({ hasRemoteUpdate: false });
        return;
    }

    runBackground(() => {
        let state = syncState(conf);
        state.hasRemoteUpdate = state.remoteTime > state.localBaseTime;
        state.conclusion = concludeSyncState(state);
        return state;
    }, onSuccess, onError);
};

exports.uploadSavesAsync = (options, onSuccess, onError, onConflict) => {
    if (typeof options == 'function') {
        onConflict = onError;
        onError = onSuccess;
        onSuccess = options;
        options = {};
    }
    options = options || {};

    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) {
        if (onSuccess) onSuccess(0);
        return;
    }

    runBackground(() => {
        if (!options.force) {
            let state = syncState(conf);
            if (state.remoteTime > state.localBaseTime) {
                return {
                    conflict: 'localExpired',
                    state: state
                };
            }
        }
        return { conflict: null };
    }, (check) => {
        if (check.conflict) {
            if (onConflict) onConflict(check);
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
            let metaFile = localSnapshot.makeMetaFile(localFiles.length);
            localFiles.push({
                path: metaFile.path,
                data: metaFile.data
            });

            github.replaceBranchTree(conf, localFiles, 'Full cloud sync via bettersave');
            localSnapshot.writeLocalMeta(metaFile.meta);
            cloudConfig.updateLastSaveTime();
            print('Upload Sync Complete. Files: ' + localFiles.length);
            return localFiles.length;
        }, onSuccess, onError);
    }, onError);
};

exports.downloadSavesAsync = (options, onSuccess, onError, onConflict) => {
    if (typeof options == 'function') {
        onConflict = onError;
        onError = onSuccess;
        onSuccess = options;
        options = {};
    }
    options = options || {};

    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) {
        if (onSuccess) onSuccess(0);
        return;
    }

    runBackground(() => {
        let state = syncState(conf);
        if (!options.force && (state.localChanged || state.localBaseTime > state.remoteTime)) {
            return {
                conflict: 'remoteExpired',
                state: state
            };
        }

        return {
            conflict: null,
            remoteFiles: github.readBranchFiles(conf),
            remoteMeta: state.remote
        };
    }, (result) => {
        if (result.conflict) {
            if (onConflict) onConflict(result);
            return;
        }

        try {
            control.closeCurrentMap(false);
            localSnapshot.replaceLocalFiles(result.remoteFiles);
            if (result.remoteMeta) localSnapshot.writeLocalMeta(result.remoteMeta);
            control.reloadSave();
            print('Download Sync Complete. Files: ' + result.remoteFiles.length);
            if (onSuccess) onSuccess(result.remoteFiles.length);
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
