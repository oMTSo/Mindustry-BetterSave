
const cloud = require('bettersave/core/cloud');
const save = require('bettersave/core/save');
const myIcons = require('bettersave/ui/tools/icons');

var cloudSaveDialog = null;
var conf = {};
var confModified = false;

exports.dialog = cloudSaveDialog;

function rebuild() {
    cloud.init(false);
    conf = cloud.getConfig();
    cloudSaveDialog.cont.clear();
    cloudSaveDialog.cont.pane((pane) => {
        pane.add("@cloudConfig.token").padRight(8).left();
        pane.field(conf.token || "", {
            get: (v) => {
                conf.token = v;
                confModified = true;
            }
        }).size(400, 55).maxTextLength(2048).get();
        pane.row();
        pane.add("@cloudConfig.owner").padRight(8).left();
        pane.field(conf.owner || "", {
            get: (v) => {
                conf.owner = v;
                confModified = true;
            }
        }).size(400, 55).maxTextLength(2048).get();
        pane.row();
        pane.add("@cloudConfig.repo").padRight(8).left();
        pane.field(conf.repo || "", {
            get: (v) => {
                conf.repo = v;
                confModified = true;
            }
        }).size(400, 55).maxTextLength(2048).get();
        pane.row();
        pane.add("@cloudConfig.branch").padRight(8).left();
        pane.field(conf.branch || "main", {
            get: (v) => {
                conf.branch = v;
                confModified = true;
            }
        }).size(400, 55).maxTextLength(2048).get();
    });

    cloudSaveDialog.cont.row();
    let b = cloudSaveDialog.cont.button('enableCloudSave', Icon.cancel, () => {
        conf.enable = !conf.enable;
        bUpdate();
    }).margin(14).width(240).height(64).pad(24).center().get();

    let bUpdate = () => {
        let icon = conf.enable ? Icon.ok : Icon.cancel;
        b.getChildren().each(e => {
            if (e instanceof Packages.arc.scene.ui.Image) {
                e.setDrawable(icon);
            }
        });

        if (conf.enable) {
            b.setText('@cloudConfig.cloudSaveEnabled');
        } else {
            b.setText('@cloudConfig.cloudSaveDisabled');
        }
    };
    let checkConf = () => {
        if (!cloud.isEnable()) {
            Vars.ui.showOkText('@error', '@cloudConfig.warn.cloudSaveIsDisabled', () => { });
            return false;
        }
        if (confModified) {
            Vars.ui.showOkText('@error', '@cloudConfig.warn.saveConfigFirst', () => { });
            return false;
        }
        if (!conf.token || conf.token.trim() === '') {
            Vars.ui.showOkText('@error', '@cloudConfig.warn.missingToken', () => { });
            return false;
        }
        if (!conf.owner || conf.owner.trim() === '') {
            Vars.ui.showOkText('@error', '@cloudConfig.warn.missingOwner', () => { });
            return false;
        }
        if (!conf.repo || conf.repo.trim() === '') {
            Vars.ui.showOkText('@error', '@cloudConfig.warn.missingRepo', () => { });
            return false;
        }
        return true;
    };

    cloudSaveDialog.cont.row();
    cloudSaveDialog.cont.button("@cloudConfig.upload", Icon.upload, () => {
        if (!checkConf()) return;
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
    }).margin(14).width(240).height(64).pad(4).center().get();

    cloudSaveDialog.cont.row();

    cloudSaveDialog.cont.button("@cloudConfig.download", Icon.download, () => {
        if (!checkConf()) return;
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
    }).margin(14).width(240).height(64).pad(4).center().get();

    cloudSaveDialog.cont.row();

    cloudSaveDialog.cont.button("@cloudConfig.test", Icon.play, () => {
        if (cloud.test(conf)) {
            Vars.ui.showOkText('@cloudConfig.test', '@cloudConfig.test.success', () => { });
        } else {
            Vars.ui.showOkText('@cloudConfig.test', '@cloudConfig.test.fail', () => { });
        }
    }).margin(14).width(240).height(64).pad(4).center().get();

    cloudSaveDialog.cont.row();

    cloudSaveDialog.cont.button("@cloudConfig.clear", Icon.trash, () => {
        if (!checkConf()) return;
        Vars.ui.showConfirm('@cloudConfig.clear.desc', Core.bundle.format('cloudConfig.clear.comfirm', conf.repo), () => {
            try {
                cloud.setConfig(conf);
            } catch (e) {
                Vars.ui.showOkText('@error', '@cloudConfig.warn.saveNameTooLong', () => { });
                return;
            }
            try {
                cloud.removeSave();
            } catch (e) {
                Vars.ui.showOkText('@error', e.toString(), () => { });
                return;
            }
            Vars.ui.showOkText('@cloudConfig.clear.desc', '@cloudConfig.clear.done', () => { });
        });
    }).margin(14).width(240).height(64).pad(4).center().get();

    cloudSaveDialog.cont.row();

    let btnProvider = cloudSaveDialog.cont.button('provider', Icon.refresh, () => {
        if (!conf.provider || conf.provider === 'github') {
            conf.provider = 'gitee';
            // Optional: clear defaults if switching? 
            // Better to keep them as user might have same repo name.
        } else {
            conf.provider = 'github';
        }
        confModified = true;
        updateProviderBtn();
    }).margin(14).width(240).height(64).pad(4).center().get();

    let updateProviderBtn = () => {
        let icon = (conf.provider === 'gitee') ? Icon.icons.get("giteeIcon") : Icon.icons.get("githubIcon");
        btnProvider.getChildren().each(e => {
            if (e instanceof Packages.arc.scene.ui.Image) {
                e.setDrawable(icon);
            }
        });

        if (conf.provider === 'gitee') {
            btnProvider.setText("@cloudConfig.provider.gitee");
        } else {
            btnProvider.setText("@cloudConfig.provider.github");
        }
    };

    updateProviderBtn();
    bUpdate();
}

exports.init = () => {

    cloudSaveDialog = new Packages.mindustry.ui.dialogs.BaseDialog('@cloudConfig.title');
    exports.dialog = cloudSaveDialog;

    cloud.init(false);
    save.init();
    myIcons.init();
    conf = cloud.getConfig();

    cloudSaveDialog.buttons.defaults().size(210, 64);
    cloudSaveDialog.addCloseButton();
    // cloudSaveDialog.buttons.button('@back', Icon.left, () => {
    //     cloudSaveDialog.hide();
    // });
    cloudSaveDialog.buttons.button("@cloudConfig.save", Icon.save, () => {
        try {
            cloud.setConfig(conf);
            confModified = false;
            Vars.ui.showOkText('@tip', '@cloudConfig.save.success', () => { });
        } catch (e) {
            Vars.ui.showOkText('@error', '@cloudConfig.warn.saveNameTooLong', () => { });
            return;
        }
    });

    cloudSaveDialog.addCloseListener();
    cloudSaveDialog.shown(rebuild);
};
