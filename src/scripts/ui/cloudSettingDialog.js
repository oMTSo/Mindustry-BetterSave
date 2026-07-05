// 云存档设置对话框：编辑仓库配置并触发上传、下载、清空操作。
const cloud = require('bettersave/cloud/index');
const myIcons = require('bettersave/ui/tools/icons');

var cloudSaveDialog = null;
var conf = {};
var confModified = false;
var saveBtn = null;
var testLoadingId = 0;

exports.dialog = cloudSaveDialog;

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

function showCancelableTestLoading(onCancel) {
    showLoading('cloudConfig.test');
    Vars.ui.loadfrag.setButton(() => {
        hideLoading();
        onCancel();
    });
}

function formatSyncTime(time) {
    if (!time || time <= 0) return Core.bundle.get('cloudConfig.test.none');
    return new Date(time).toLocaleString();
}

function formatDevice(meta) {
    if (!meta) return Core.bundle.get('cloudConfig.test.none');
    let name = meta.deviceName || '';
    let id = meta.deviceId || '';
    if (name.length == 0 && id.length == 0) return Core.bundle.get('cloudConfig.test.none');
    if (name.length == 0) return id;
    if (id.length == 0) return name;
    return name + ' (' + id + ')';
}

function syncConclusionText(key) {
    return Core.bundle.get('cloudConfig.test.result.' + key);
}

function makeTestReport(result) {
    if (!result.ok) return Core.bundle.get('cloudConfig.test.fail');

    let state = result.state;
    let localTime = formatSyncTime(state.localTime);
    let remoteTime = formatSyncTime(state.remoteTime);
    let localDevice = formatDevice(state.local);
    let remoteDevice = formatDevice(state.remote);
    return Core.bundle.get('cloudConfig.test.success') + '\n\n' +
        Core.bundle.format('cloudConfig.test.localTime', localTime) + '\n' +
        Core.bundle.format('cloudConfig.test.remoteTime', remoteTime) + '\n' +
        Core.bundle.format('cloudConfig.test.localDevice', localDevice) + '\n' +
        Core.bundle.format('cloudConfig.test.remoteDevice', remoteDevice) + '\n\n' +
        Core.bundle.format('cloudConfig.test.result', syncConclusionText(result.conclusion));
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

function rebuild() {
    cloud.init();
    conf = cloud.getConfig();
    confModified = false;
    cloudSaveDialog.cont.clear();

    cloudSaveDialog.cont.pane((pane) => {
        pane.add("@cloudConfig.token").padRight(8).left();
        pane.field(conf.token || "", {
            get: (v) => {
                conf.token = v;
                confModified = true;
                updateSaveBtn();
            }
        }).size(400, 55).maxTextLength(2048).get();
        pane.row();
        pane.add("@cloudConfig.owner").padRight(8).left();
        pane.field(conf.owner || "", {
            get: (v) => {
                conf.owner = v;
                confModified = true;
                updateSaveBtn();
            }
        }).size(400, 55).maxTextLength(2048).get();
        pane.row();
        pane.add("@cloudConfig.repo").padRight(8).left();
        pane.field(conf.repo || "", {
            get: (v) => {
                conf.repo = v;
                confModified = true;
                updateSaveBtn();
            }
        }).size(400, 55).maxTextLength(2048).get();
        pane.row();
        pane.add("@cloudConfig.branch").padRight(8).left();
        pane.field(conf.branch || "main", {
            get: (v) => {
                conf.branch = v;
                confModified = true;
                updateSaveBtn();
            }
        }).size(400, 55).maxTextLength(2048).get();
    });

    cloudSaveDialog.cont.row();

    let b = cloudSaveDialog.cont.button('enableCloudSave', Icon.cancel, () => {
        conf.enable = !conf.enable;
        confModified = true;
        updateSaveBtn();
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
    cloudSaveDialog.cont.row();

    exports.createUploadBtn(cloudSaveDialog.cont).margin(14).width(240).height(64).pad(4).center().get();

    cloudSaveDialog.cont.row();

    exports.createDownloadBtn(cloudSaveDialog.cont).margin(14).width(240).height(64).pad(4).center().get();

    cloudSaveDialog.cont.row();

    cloudSaveDialog.cont.button("@cloudConfig.test", Icon.play, () => {
        let loadingId = ++testLoadingId;
        let cancelled = false;

        showCancelableTestLoading(() => {
            cancelled = true;
            testLoadingId++;
        });

        cloud.inspectSyncAsync(conf, (result) => {
            if (cancelled || loadingId !== testLoadingId) return;
            hideLoading();
            Vars.ui.showOkText('@cloudConfig.test', makeTestReport(result), () => { });
        }, (e) => {
            if (cancelled || loadingId !== testLoadingId) return;
            hideLoading();
            print(e);
            Vars.ui.showOkText('@cloudConfig.test', '@cloudConfig.test.fail', () => { });
        });
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
            showLoading('cloudConfig.clear.desc');
            cloud.clearCloudAsync(() => {
                hideLoading();
                Vars.ui.showOkText('@cloudConfig.clear.desc', '@cloudConfig.clear.done', () => { });
            }, (e) => {
                hideLoading();
                print(e);
                Vars.ui.showOkText('@error', e.toString(), () => { });
            });
        });
    }).margin(14).width(240).height(64).pad(4).center().get();

    cloudSaveDialog.cont.row();

    let btnProvider = cloudSaveDialog.cont.button('provider', Icon.refresh, () => {
        if (!conf.provider || conf.provider === 'github') {
            conf.provider = 'gitee';
        } else {
            conf.provider = 'github';
        }
        confModified = true;
        updateSaveBtn();
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
    updateSaveBtn();
    bUpdate();
}

// 检查当前配置是否可以执行云端操作。
const checkConf = () => {
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

// 根据配置是否修改更新保存按钮状态。
const updateSaveBtn = () => {
    if (!saveBtn) return;
    let btn = saveBtn.get();
    if (confModified) {
        btn.setText("@cloudConfig.save");
        btn.getChildren().each(e => {
            if (e instanceof Packages.arc.scene.ui.Image) {
                e.setDrawable(Icon.save);
            }
        });
    } else {
        btn.setText("@cloudConfig.saved");
        btn.getChildren().each(e => {
            if (e instanceof Packages.arc.scene.ui.Image) {
                e.setDrawable(Icon.ok);
            }
        });
    }
};

exports.createUploadBtn = (parent) => {
    if (!parent) parent = cloudSaveDialog.cont;
    return parent.button("@cloudConfig.upload", Icon.upload, () => {
        if (!checkConf()) return;
        Vars.ui.showConfirm("@cloudSave.title", "@cloudSave.syncToComfirm", () => {
            cloud.init();
            uploadCloud(false);
        });
    });
};

exports.createDownloadBtn = (parent) => {
    if (!parent) parent = cloudSaveDialog.cont;
    return parent.button("@cloudConfig.download", Icon.download, () => {
        if (!checkConf()) return;
        Vars.ui.showConfirm("@cloudSave.title", "@cloudSave.syncFromComfirm", () => {
            cloud.init();
            downloadCloud(false);
        });
    });
};

exports.init = () => {

    cloudSaveDialog = new Packages.mindustry.ui.dialogs.BaseDialog('@cloudConfig.title');
    exports.dialog = cloudSaveDialog;

    cloud.init();
    myIcons.init();
    conf = cloud.getConfig();

    cloudSaveDialog.buttons.defaults().size(210, 64);
    cloudSaveDialog.addCloseButton();
    saveBtn = cloudSaveDialog.buttons.button("@cloudConfig.saved", Icon.ok, () => {
        try {
            cloud.setConfig(conf);
            confModified = false;
            updateSaveBtn();
            Vars.ui.showOkText('@tip', '@cloudConfig.save.success', () => { });
        } catch (e) {
            Vars.ui.showOkText('@error', '@cloudConfig.warn.saveNameTooLong', () => { });
            return;
        }
    });

    cloudSaveDialog.addCloseListener();
    cloudSaveDialog.shown(rebuild);

    updateSaveBtn();
};
