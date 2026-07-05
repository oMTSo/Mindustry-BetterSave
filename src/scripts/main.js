// 模组入口：注册 UI，并在游戏启动和战役退出时触发云同步。
const save = require('bettersave/core/save');
const cloud = require('bettersave/cloud/index');
const version = require('bettersave/tools/version');
const ui = require('bettersave/ui/ui');
const editor = require('bettersave/core/editor');
const control = require('bettersave/core/control');

print('bettersave v' + version.major.toString() + '.' + version.minor.toString() + '.' + version.bugFix.toString());

function showLoading(key) {
    Vars.ui.loadfrag.show(Core.bundle.get(key));
}

function hideLoading() {
    Vars.ui.loadfrag.hide();
}

function progressText(key, progress) {
    if (!progress || !progress.total || progress.total <= 0) return Core.bundle.get(key);
    return Core.bundle.get(key) + ' ' + progress.current + '/' + progress.total;
}

function showCancelableLoading(key, cancelToken) {
    showLoading(key);
    Vars.ui.loadfrag.setButton(() => {
        cancelToken.cancel();
        hideLoading();
        showLoading('cloudSave.cancelling');
    });
}

function showCancelableProgress(key, cancelToken, progress) {
    Vars.ui.loadfrag.show(progressText(key, progress));
    Vars.ui.loadfrag.setButton(() => {
        cancelToken.cancel();
        hideLoading();
        showLoading('cloudSave.cancelling');
    });
}

function makeProgressHandler(key, cancelToken) {
    return (progress) => {
        if (cancelToken.isCancelled()) return;
        showCancelableProgress(key, cancelToken, progress);
    };
}

function handleCloudError(failKey, e) {
    hideLoading();
    if (cloud.isCancelled(e)) {
        Vars.ui.showInfoFade("@cloudSave.cancelled");
        return;
    }
    print(e);
    Vars.ui.showOkText('@error', Core.bundle.get(failKey) + e.toString(), () => { });
}

function uploadCloud(force) {
    let cancelToken = cloud.createCancelToken();
    showCancelableLoading('cloudSave.syncingTo', cancelToken);
    cloud.uploadSavesAsync({
        force: force,
        cancelToken: cancelToken,
        onProgress: makeProgressHandler('cloudSave.syncingTo', cancelToken)
    }, () => {
        hideLoading();
        Vars.ui.showOkText("@cloudSave.title", "@cloudSave.syncToSuccess", () => { });
    }, (e) => {
        handleCloudError('cloudSave.syncToFail', e);
    }, () => {
        hideLoading();
        Vars.ui.showConfirm("@cloudSave.title", "@cloudSave.localExpired", () => {
            uploadCloud(true);
        });
    });
}

function downloadCloud(force) {
    let cancelToken = cloud.createCancelToken();
    showCancelableLoading('cloudSave.syncingFrom', cancelToken);
    cloud.downloadSavesAsync({
        force: force,
        cancelToken: cancelToken,
        onProgress: makeProgressHandler('cloudSave.syncingFrom', cancelToken)
    }, () => {
        hideLoading();
        Vars.ui.showOkText("@cloudSave.title", "@cloudSave.syncFromSuccess", () => { });
    }, (e) => {
        handleCloudError('cloudSave.syncFromFail', e);
    }, () => {
        hideLoading();
        Vars.ui.showConfirm("@cloudSave.title", "@cloudSave.remoteExpired", () => {
            downloadCloud(true);
        });
    });
}

Events.on(ClientLoadEvent, () => {
    editor.removeFiles();
    Time.run(10, () => {
        ui.register();
        save.init();
        control.onCampaignQuit(() => {
            editor.removeFiles();
            cloud.init();
            if (cloud.isEnable() && !control.isNetClient()) {
                Vars.ui.showConfirm("@cloudSave.title", "@cloudSave.syncToComfirm", () => {
                    uploadCloud(false);
                });
            }
        });
        control.listen();
        cloud.init();
        if (cloud.isEnable() && !control.isNetClient()) {
            cloud.checkRemoteUpdateAsync((state) => {
                if (!state.hasRemoteUpdate) return;
                Vars.ui.showConfirm("@cloudSave.title", "@cloudSave.syncFromComfirm", () => {
                    downloadCloud(false);
                });
            }, (e) => {
                print(e);
            });
        }
    });
});
