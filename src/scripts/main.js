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

function uploadCloud(force) {
    showLoading('cloudSave.syncingTo');
    cloud.uploadSavesAsync({ force: force }, () => {
        hideLoading();
        Vars.ui.showOkText("@cloudSave.title", "@cloudSave.syncToSuccess", () => { });
    }, (e) => {
        hideLoading();
        print(e);
        Vars.ui.showOkText('@error', Core.bundle.get('cloudSave.syncToFail') + e.toString(), () => { });
    }, () => {
        hideLoading();
        Vars.ui.showConfirm("@cloudSave.title", "@cloudSave.localExpired", () => {
            uploadCloud(true);
        });
    });
}

function downloadCloud(force) {
    showLoading('cloudSave.syncingFrom');
    cloud.downloadSavesAsync({ force: force }, () => {
        hideLoading();
        Vars.ui.showOkText("@cloudSave.title", "@cloudSave.syncFromSuccess", () => { });
    }, (e) => {
        hideLoading();
        print(e);
        Vars.ui.showOkText('@error', Core.bundle.get('cloudSave.syncFromFail') + e.toString(), () => { });
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
