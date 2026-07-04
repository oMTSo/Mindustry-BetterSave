// 存档地图编辑对话框：把当前存档或备份中的地图交给游戏编辑器修改。
const editor = require('bettersave/core/editor');
const save = require('bettersave/core/save');
const config = require('bettersave/core/config');
const fs = require('bettersave/tools/file');
const maps = require('bettersave/core/map');
const ui = require("bettersave/ui/ui");
const setting = require('bettersave/core/setting');

var saveEditDialog = null;

var parentDialogs = [];
var needRebuild = true;

var mapPane = null;

var targetPath = null;
var target = null;

var allMapLst = [];
var modified = false;

var currentEditingFile = {
    isSmsf: false,
    index: 0,
    path: ''
};

var showBackup = false;

var category = [
    {
        planet: null,
        custom: false
    },
    {
        planet: null,
        custom: true
    }
];

var currentCategory = category[0];

var bCategory = null;
var bBackup = null;

function rebuild() {
    if (!needRebuild) return;
    if (mapPane == null) return;
    mapPane.clear();

    var mapLst = [];

    if (currentCategory.planet == null) {
        if (currentCategory.custom) {
            allMapLst.forEach(c => {
                if (c.backup && !showBackup) return;
                if (c.custom) mapLst.push(c);
            });
        } else {
            allMapLst.forEach(c => {
                if (c.backup && !showBackup) return;
                mapLst.push(c);
            });
        }
    } else {
        allMapLst.forEach(c => {
            if (c.backup && !showBackup) return;
            if (c.planet == currentCategory.planet) mapLst.push(c);
        });
    }


    if (mapLst.length == 0) {
        mapPane.add('@saveEdit.noMapInThisCategory').color(Packages.arc.graphics.Color.lightGray).pad(4);
        return;
    }
    var s = 64;
    for (let map of mapLst) {
        let m = map;
        ui.button(mapPane, con => {
            con.margin(0);
            con.left();
            let img = new Packages.mindustry.ui.BorderImage();
            img.setDrawable(Icon.map);
            img.border(Packages.mindustry.graphics.Pal.accent);
            con.add(img).size(s).pad(4 * 2);
            con.add("[accent]" + m.displayName + "\n[lightgray]" + m.file).width(358).wrap().grow().pad(4, 2, 4, 6).top().left().labelAlign(Packages.arc.util.Align.topLeft);
        }, Packages.mindustry.ui.Styles.flatBordert, () => {
            if (target != null && targetPath != null) {
                currentEditingFile.index = mapLst.indexOf(m);
                editor.edit(m.file, target.files[currentEditingFile.index].data);
            } else {
                currentEditingFile.path = config.gameSaveDir + '/' + m.file;
                editor.edit(m.file, fs.readFile(currentEditingFile.path));
            }
        });
        mapPane.row();
    }
}

function makePlanetCategory(name) {
    for (let i of category) if (i.planet == name) return;
    category.push({
        planet: name,
        custom: false
    });
}

exports.init = (parents) => {

    saveEditDialog = new Packages.mindustry.ui.dialogs.BaseDialog('@saveEdit.title');
    exports.dialog = saveEditDialog;

    parentDialogs = parents;

    editor.init();
    editor.on('uiShow', () => {
        needRebuild = false;
        for (let o of parentDialogs) o.show();
        saveEditDialog.show();
        needRebuild = true;
    });
    editor.on('uiHide', () => {
        needRebuild = false;
        for (let o of parentDialogs) o.hide();
        saveEditDialog.hide();
        needRebuild = true;
    });
    editor.on('saveMap', (data) => {
        if (currentEditingFile.isSmsf && target != null) {
            target.files[currentEditingFile.index].data = data;
        } else {
            fs.writeFile(currentEditingFile.path, data);
        }
        modified = true;
    });

    config.init();
    maps.init();
    save.init();

    saveEditDialog.cont.row();
    saveEditDialog.cont.pane(tablebrow => {
        tablebrow.margin(10).top();
        mapPane = tablebrow;
    }).scrollX(false);
    saveEditDialog.addCloseButton();

    bCategory = saveEditDialog.buttons.button(Core.bundle.format('saveEdit.category', '[accent]' + Core.bundle.get('saveEdit.category.all')), () => {
        let i = category.indexOf(currentCategory);
        if (i == -1) i = 0;
        i++;
        if (i >= category.length) i = 0;
        switch (i) {
            case 0: {
                bCategory.setText(Core.bundle.format('saveEdit.category', '[accent]' + Core.bundle.get('saveEdit.category.all')));
                break;
            }
            case 1: {
                bCategory.setText(Core.bundle.format('saveEdit.category', '[accent]' + Core.bundle.get('saveEdit.category.custom')));
                break;
            }
            default: {
                bCategory.setText(Core.bundle.format('saveEdit.category', String(category[i].planet)));
                break;
            }
        }
        currentCategory = category[i];
        rebuild();
    }).get();
    bBackup = saveEditDialog.buttons.button('@saveEdit.backup.hide', () => {
        showBackup = !showBackup;
        bBackup.setText('@saveEdit.backup.hide');
        if (showBackup) bBackup.setText('@saveEdit.backup.show');
        rebuild();
    }).get();

    saveEditDialog.shown(rebuild);
    saveEditDialog.hidden(() => {
        setting.unload();
        if (!needRebuild || !modified) {
            return;
        }
        if (currentEditingFile.isSmsf && targetPath != null && target != null) {
            Time.run(10, () => {
                Vars.ui.loadAnd('@saveEdit.saving', () => {
                    target.writeToSavePath();
                });
            });
        }
    });

};

exports.show = () => {
    if (!needRebuild) {
        saveEditDialog.show();
        return;
    }
    allMapLst = [];
    if (targetPath != null) {
        Vars.ui.loadAnd(() => {
            target = save.readFile(targetPath);
            target.readFiles();
            for (let f of target.files) {
                if (f.name.endsWith('.msav')) allMapLst.push(maps.resolveName(f.name));
                if (f.name == '$setting') setting.load(f.data);
            }
            currentEditingFile.isSmsf = true;
            modified = false;
            currentCategory = category[0];
            bCategory.setText(Core.bundle.format('saveEdit.category', '[accent]' + Core.bundle.get('saveEdit.category.all')));
            maps.planets().forEach(p => { makePlanetCategory(p); });
            saveEditDialog.show();
        });
    } else {
        for (let fn of fs.readDir(config.gameSaveDir)) if (fn.endsWith('.msav')) allMapLst.push(maps.resolveName(fn));
        setting.unload();
        currentEditingFile.isSmsf = false;
        modified = false;
        currentCategory = category[0];
        bCategory.setText(Core.bundle.format('saveEdit.category', '[accent]' + Core.bundle.get('saveEdit.category.all')));
        maps.planets().forEach(p => { makePlanetCategory(p); });
        saveEditDialog.show();
    }
};

exports.needRebuild = () => {
    return needRebuild;
};

exports.modified = () => {
    return modified;
};

exports.setTargetPath = (path) => {
    targetPath = path;
};

exports.dialog = saveEditDialog;
