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

function makeCancelError() {
    let e = new Error('Cloud sync cancelled.');
    e.cancelled = true;
    return e;
}

function checkCancelled(cancelToken) {
    if (!cancelToken) return;
    if (typeof cancelToken.throwIfCancelled == 'function') {
        cancelToken.throwIfCancelled();
        return;
    }
    if (cancelToken.cancelled) throw makeCancelError();
}

function isTokenCancelled(cancelToken) {
    if (!cancelToken) return false;
    if (typeof cancelToken.isCancelled == 'function') return cancelToken.isCancelled();
    return cancelToken.cancelled === true;
}

exports.createCancelToken = () => {
    let cancelled = new java.util.concurrent.atomic.AtomicBoolean(false);
    let committed = new java.util.concurrent.atomic.AtomicBoolean(false);
    return {
        cancel: () => {
            cancelled.set(true);
        },
        isCancelled: () => {
            return cancelled.get();
        },
        markCommitted: () => {
            committed.set(true);
        },
        isCommitted: () => {
            return committed.get();
        },
        throwIfCancelled: () => {
            if (cancelled.get() && !committed.get()) throw makeCancelError();
        }
    };
};

exports.isCancelled = (e) => {
    return e && e.cancelled === true;
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
            if (!exports.isCancelled(e)) print(e);
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

function syncState(conf, cancelToken) {
    checkCancelled(cancelToken);
    let localMeta = localSnapshot.readLocalMeta();
    checkCancelled(cancelToken);
    let remoteMeta = github.readRemoteMeta(conf, cancelToken);
    checkCancelled(cancelToken);
    let localBaseTime = metaTime(localMeta);
    let localSyncedTime = metaTime({ updatedAt: localMeta.localSyncedAt });
    let latestLocalModifiedTime = localSnapshot.latestLocalModifiedTime();
    checkCancelled(cancelToken);
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
    let cancelToken = options.cancelToken;

    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) {
        if (onSuccess) onSuccess(0);
        return;
    }

    runBackground(() => {
        checkCancelled(cancelToken);
        if (!options.force) {
            let state = syncState(conf, cancelToken);
            checkCancelled(cancelToken);
            if (state.remoteTime > state.localBaseTime) {
                return {
                    conflict: 'localExpired',
                    state: state
                };
            }
        }
        checkCancelled(cancelToken);
        return { conflict: null };
    }, (check) => {
        if (isTokenCancelled(cancelToken)) {
            if (onError) onError(makeCancelError());
            return;
        }
        if (check.conflict) {
            if (onConflict) onConflict(check);
            return;
        }

        try {
            checkCancelled(cancelToken);
            save.make('cloudsave').writeToSavePath();
            checkCancelled(cancelToken);
        } catch (e) {
            if (!exports.isCancelled(e)) print(e);
            if (onError) onError(e);
            return;
        }

        runBackground(() => {
            checkCancelled(cancelToken);
            let localFiles = localSnapshot.collectUploadFiles();
            checkCancelled(cancelToken);
            let metaFile = localSnapshot.makeMetaFile(localFiles.length);
            localFiles.push({
                path: metaFile.path,
                data: metaFile.data
            });
            checkCancelled(cancelToken);

            github.replaceBranchTree(conf, localFiles, 'Full cloud sync via bettersave', cancelToken);
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
    let cancelToken = options.cancelToken;

    let conf = cloudConfig.read();
    if (!cloudConfig.isEnable(conf)) {
        if (onSuccess) onSuccess(0);
        return;
    }

    runBackground(() => {
        checkCancelled(cancelToken);
        let state = syncState(conf, cancelToken);
        checkCancelled(cancelToken);
        if (!options.force && (state.localChanged || state.localBaseTime > state.remoteTime)) {
            return {
                conflict: 'remoteExpired',
                state: state
            };
        }

        checkCancelled(cancelToken);
        return {
            conflict: null,
            remoteFiles: github.readBranchFiles(conf, cancelToken),
            remoteMeta: state.remote
        };
    }, (result) => {
        if (isTokenCancelled(cancelToken)) {
            if (onError) onError(makeCancelError());
            return;
        }
        if (result.conflict) {
            if (onConflict) onConflict(result);
            return;
        }

        try {
            checkCancelled(cancelToken);
            control.closeCurrentMap(false);
            checkCancelled(cancelToken);
            localSnapshot.replaceLocalFiles(result.remoteFiles);
            if (result.remoteMeta) localSnapshot.writeLocalMeta(result.remoteMeta);
            control.reloadSave();
            print('Download Sync Complete. Files: ' + result.remoteFiles.length);
            if (onSuccess) onSuccess(result.remoteFiles.length);
        } catch (e) {
            if (!exports.isCancelled(e)) print(e);
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
