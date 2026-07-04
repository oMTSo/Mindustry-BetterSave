// 模组入口：注册 UI，并在游戏启动和战役退出时触发云同步。
const save = require('bettersave/core/save');
const cloud = require('bettersave/cloud/index');
const version = require('bettersave/tools/version');
const ui = require('bettersave/ui/ui');
const editor = require('bettersave/core/editor');
const control = require('bettersave/core/control');

print('bettersave v' + version.major.toString() + '.' + version.minor.toString() + '.' + version.bugFix.toString());

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
                    Vars.ui.loadAnd('@cloudSave.syncingTo', () => {
                        try {
                            cloud.init();
                            cloud.writeSave();
                            Vars.ui.showOkText("@cloudSave.title", "@cloudSave.syncToSuccess", () => { });
                        } catch (e) {
                            print(e);
                            Vars.ui.showOkText('@error', Core.bundle.get('cloudSave.syncToFail') + e.toString(), () => { });
                        }
                    });
                });
            }
        });
        control.listen();
        cloud.init();
        if (cloud.isEnable() && !control.isNetClient()) {
            Vars.ui.showConfirm("@cloudSave.title", "@cloudSave.syncFromComfirm", () => {
                Vars.ui.loadAnd('@cloudSave.syncingFrom', () => {
                    try {
                        cloud.init();
                        let obj = cloud.getSave();
                        if (obj != null) obj.readFiles();
                        if (obj != null) obj.apply();
                        Vars.ui.showOkText("@cloudSave.title", "@cloudSave.syncFromSuccess", () => { });
                    } catch (e) {
                        print(e);
                        Vars.ui.showOkText('@error', Core.bundle.get('cloudSave.syncFromFail') + e.toString(), () => { });
                    }
                });
            });
        }
    });
});
