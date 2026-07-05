// 存档管理对话框：展示本地备份，提供备份、恢复、编辑和云同步入口。
const listView = require("bettersave/ui/tools/listView");
const saveEditDialog = require("bettersave/ui/tools/saveEdit");
const cloudSettingDialog = require("bettersave/ui/cloudSettingDialog");
const inputDialog = require("bettersave/ui/tools/input");
const cloud = require("bettersave/cloud/index");
const save = require("bettersave/core/save");

var mainDialog = null;

function formatNumStr(num, length) {
    const zero = "0";
    let ret = num.toString();
    let i = length - ret.length;
    if (i > 0) ret = zero.repeat(i) + ret;
    return ret;
}

exports.init = () => {
    mainDialog = listView.init();
    mainDialog.setTitle('@saveMgr.title');

    cloud.init();
    save.init();
    saveEditDialog.init([Vars.ui.settings, mainDialog]);
    cloudSettingDialog.init();
    inputDialog.init();

    let rebuildAfterCloudSync = () => {
        cloud.init();
        mainDialog.rebuild();
    };

    let updateButtons = () => {
        mainDialog.dialog.buttons.clearChildren();

        let width = 210;
        if (cloud.isEnable()) {
            let screenW = Core.graphics.getWidth();
            let totalNeeded = 3 * 210 * Packages.arc.scene.ui.layout.Scl.scl(1.0);
            if (screenW < totalNeeded) {
                width = (screenW / Packages.arc.scene.ui.layout.Scl.scl(1.0) - 40) / 3;
            }
        }

        mainDialog.dialog.buttons.button("@back", Icon.left, () => {
            mainDialog.dialog.hide();
        }).size(width, 64);

        if (cloud.isEnable()) {
            cloudSettingDialog.createUploadBtn(mainDialog, rebuildAfterCloudSync).size(width, 64);
            cloudSettingDialog.createDownloadBtn(mainDialog, rebuildAfterCloudSync).size(width, 64);
        }
    };

    updateButtons();

    cloudSettingDialog.dialog.hidden(() => {
        cloud.init();
        updateButtons();
        mainDialog.rebuild();
    });

    saveEditDialog.dialog.hidden(() => {
        if (saveEditDialog.needRebuild() && saveEditDialog.modified()) mainDialog.rebuild();
    });

    mainDialog.shown(() => {
        updateButtons();
        mainDialog.rebuild();
    });

    mainDialog.rebuilt(() => {

        mainDialog.listCase('[accent]' + Core.bundle.get('saveMgr.currentSave'), '[lightgray]' + ((!cloud.isEnable()) ? Core.bundle.get('saveMgr.currentSave.local') : Core.bundle.get('saveMgr.currentSave.cloud')), Icon.save, () => { }, [
            {
                icon: Icon.downOpen,
                clicked: () => {
                    inputDialog.begin(Core.bundle.get('saveMgr.backupSaveName'), "", Core.bundle.get('saveMgr.backupSaveName'), (v) => {
                        Vars.ui.loadAnd("@saveMgr.backuping", () => {
                            save.make(v).writeToSavePath();
                            mainDialog.rebuild();
                            Vars.ui.showInfoFade("@saveMgr.backuped");
                        });
                    });
                }
            },
            {
                icon: Icon.pencil,
                clicked: () => {
                    saveEditDialog.setTargetPath(null);
                    saveEditDialog.show();
                }
            }
        ]);

        mainDialog.listLine();

        let saveLst = save.readAll();

        saveLst.sort((a, b) => {
            for (let i = 0; i < 6; i++) {
                if (a.time[i] !== b.time[i]) {
                    return b.time[i] - a.time[i];
                }
            }
            return 0;
        });

        if (saveLst.length == 0) {
            mainDialog.text("@saveMgr.noAnyBackup").color(Packages.arc.graphics.Color.lightGray).pad(4);
        } else {
            for (let oo of saveLst) {
                let o = oo;
                let saveName = (o.name.length == 0) ? Core.bundle.get('saveMgr.untitled') : o.name;
                let statusTxt = o.time[0].toString() + "/" + o.time[1].toString() + "/" + o.time[2].toString() + " " + formatNumStr(o.time[3], 2) + ":" + formatNumStr(o.time[4], 2) + ":" + formatNumStr(o.time[5], 2);
                statusTxt += ("\n[lightgray]" + Core.bundle.format('saveMgr.fileNum', o.fileNum.toString()));
                mainDialog.listCase('[accent]' + saveName, '[lightgray]' + statusTxt, Icon.save, () => { }, [
                    {
                        icon: Icon.upOpen,
                        clicked: () => {
                            Vars.ui.showConfirm("@saveMgr.restoreBackup", Core.bundle.format('saveMgr.restoreBackupComfirm', saveName), () => {
                                Vars.ui.loadAnd("@saveMgr.restoring", () => {
                                    o.apply();
                                    mainDialog.rebuild();
                                    Vars.ui.showInfoFade("@saveMgr.restored");
                                });
                            });
                        }
                    },
                    {
                        icon: Icon.pencil,
                        clicked: () => {
                            saveEditDialog.setTargetPath(o.save.path);
                            saveEditDialog.show();
                        }
                    },
                    {
                        icon: Icon.trash,
                        clicked: () => {
                            Vars.ui.showConfirm("@saveMgr.deleteBackup", Core.bundle.format('saveMgr.deleteBackupComfirm', saveName), () => {
                                o.remove();
                                mainDialog.rebuild();
                                Vars.ui.showInfoFade("@saveMgr.deleted");
                            });
                        }
                    }
                ]);
            }
        }

    });

    exports.dialog = mainDialog;
};

exports.dialog = mainDialog;
