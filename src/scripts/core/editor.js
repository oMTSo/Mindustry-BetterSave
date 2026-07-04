// 地图编辑桥接：把存档中的地图临时交给 Mindustry 编辑器并回收结果。
const fs = require('bettersave/tools/file');
const config = require('bettersave/core/config');
const control = require('bettersave/core/control');

var editing = false;
var checkingEdit = false;
var uiShown = false;
var currentName = '';

var saveMapEventListener = [];
var uiShowEventListener = [];
var uiHideEventListener = [];

var fileNeedToRemove = [];

function emitEvent(listener, arg) {
    for (let o of listener) {
        try {
            o(arg);
        } catch (e) {
            print(e);
        }
    }
}

exports.init = () => {
    if (!config.isInited()) config.init();
    fileNeedToRemove = Object.assign({ fileNeedToRemove: [] }, config.readConfig('editor')).fileNeedToRemove;

    Events.on(StateChangeEvent, (e) => {
        if (!checkingEdit) return;
        if (e.from == Packages.mindustry.core.GameState.State.menu && e.to == Packages.mindustry.core.GameState.State.menu) editing = true;
        if (e.from == Packages.mindustry.core.GameState.State.menu && e.to == Packages.mindustry.core.GameState.State.playing && Vars.state.rules.editor) editing = true;
        checkingEdit = false;
        if (editing && uiShown) {
            emitEvent(uiHideEventListener, null);
            uiShown = false;
        }
    });

    Vars.ui.editor.shown(() => {
        if (!editing) return;
        if (!uiShown) {
            emitEvent(uiShowEventListener, null);
            uiShown = true;
        }
    });

    Vars.ui.editor.hidden(() => {
        if (!editing) return;
        let path = config.gameMapDir + '/' + currentName + '.msav';
        if (fs.pathExist(path)) {
            let data = fs.readFile(path);
            let rm = Vars.maps.all().find((om) => { return om.name() == currentName });
            if (rm != null) Vars.maps.removeMap(rm);
            fs.writeFile(path, data);
            if (!fileNeedToRemove.includes(path)) {
                fileNeedToRemove.push(path);
                config.writeConfig('editor', { fileNeedToRemove: fileNeedToRemove });
            }
            emitEvent(saveMapEventListener, data);
        }
        editing = false;
        checkingEdit = true;
    });

};

exports.edit = (name, data) => {
    Vars.ui.loadAnd(() => {
        control.closeCurrentMap();
        exports.removeFiles();
        let path = config.tmpDir + '/' + name;
        fs.writeFile(path, data);
        let f = new Fi(path);
        let m = Packages.mindustry.io.MapIO.createMap(f, true);
        m.tags.put('name', name);
        Vars.editor.beginEdit(m);
        Packages.mindustry.io.MapIO.writeMap(f, m);
        editing = true;
        checkingEdit = false;
        uiShown = false;
        currentName = name;
        if (!fileNeedToRemove.includes(path)) {
            fileNeedToRemove.push(path);
            config.writeConfig('editor', { fileNeedToRemove: fileNeedToRemove });
        }
        Time.run(10, () => {
            Vars.ui.editor.beginEditMap(f);
        });
    });
};

exports.on = (name, f) => {
    switch (name) {
        case 'saveMap': {
            saveMapEventListener.push(f);
            break;
        }
        case 'uiShow': {
            uiShowEventListener.push(f);
            break;
        }
        case 'uiHide': {
            uiHideEventListener.push(f);
            break;
        }
        default: { }
    }
};

exports.removeFiles = () => {
    if (!config.isInited()) config.init();
    fileNeedToRemove = Object.assign({ fileNeedToRemove: [] }, config.readConfig('editor')).fileNeedToRemove;
    for (let i of fileNeedToRemove) fs.removeFile(i);
    fileNeedToRemove = [];
    config.writeConfig('editor', { fileNeedToRemove: fileNeedToRemove });
};
