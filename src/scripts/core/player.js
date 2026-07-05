// 玩家档案管理：保存当前玩家状态，并在多个本地玩家档案之间切换。
const config = require('bettersave/core/config');
const fs = require('bettersave/tools/file');
const save = require('bettersave/core/save');
const setting = require('bettersave/core/setting');
const control = require('bettersave/core/control');
const ui = require('bettersave/ui/ui');
const localSyncState = require('bettersave/cloud/localSyncState');

var currentPlayer = {
    name: '默认玩家',
    save: {
        name: null,
        path: null
    }
};

var conf = {
    currentName: '默认玩家',
    player: {
        '默认玩家': currentPlayer
    }
};

function checkExist(obj) {
    return (typeof conf.player[obj.name] != 'undefined');
}

exports.init = () => {
    if (!config.isInited()) config.init();
    save.init();

    conf = Object.assign(conf, config.readConfig('player'));
    for (let i in conf.player) conf.player[i].save.path = (conf.player[i].save.name == null ? null : config.playerDir + '/' + conf.player[i].save.name);

    if (typeof conf.player[conf.currentName] != 'undefined') {
        currentPlayer = makeObj(conf.player[conf.currentName]);
    } else {
        conf.player[currentPlayer.name] = JSON.parse(JSON.stringify(currentPlayer));
        conf.currentName = currentPlayer.name;
        currentPlayer = makeObj(currentPlayer);
    }

    ui.setupMultiplayer(currentPlayer.name);
};

function writeConfig() {
    var obj = JSON.parse(JSON.stringify(conf));
    for (let i in obj.player) delete obj.player[i].save.path;
    config.writeConfig('player', obj);
}

function markLocalChanged() {
    localSyncState.markLocalChanged();
}

function makeObj(obj) {
    let ret = JSON.parse(JSON.stringify(obj));
    ret.isCurrent = () => {
        return ret.name == currentPlayer.name;
    };
    ret.rename = (n) => {
        if (n == null || n == undefined || n == ret.name) return;
        if (!checkExist(ret)) return;
        if (ret.isCurrent()) conf.currentName = n;
        if (typeof conf.player[n] != 'undefined') throw new Error('name already existed');
        conf.player[n] = conf.player[ret.name];
        delete conf.player[ret.name];
        ret.name = n;
        conf.player[n].name = n;
        writeConfig();
        markLocalChanged();
        ui.setupMultiplayer(currentPlayer.name);
    };
    ret.switchTo = () => {
        if (ret.isCurrent()) return;
        if (!checkExist(ret)) return;

        let current = save.make(ret.name);

        let lst = fs.readDir(config.saveDir);
        for (let fn of lst) {
            current.files.push({
                name: '../bettersave/saves/' + fn,
                data: fs.readFile(config.saveDir + '/' + fn)
            });
        }

        let currentPath = config.playerDir + '/' + current.save.name;
        current.write(currentPath);

        fs.removeFilesInDir(config.saveDir);
        markLocalChanged();

        currentPlayer.save.path = config.playerDir + '/' + current.save.name;
        currentPlayer.save.name = current.save.name;
        if (typeof conf.player[currentPlayer.name] != 'undefined') {
            conf.player[currentPlayer.name].save.name = current.save.name;
            conf.player[currentPlayer.name].save.path = currentPath;
        } else {
            print('bettersave player switchto warning currentPlayer ' + currentPlayer.name + ' is not in conf list');
        }

        if (ret.save.path == null) {
            save.reset();
            setting.reset();
            control.reloadSave();
        } else {
            let self = save.readFile(ret.save.path);
            self.readFiles();
            self.apply();
            self.remove();
        }

        ret.save.path = null;
        ret.save.name = null;
        if (typeof conf.player[ret.name] != 'undefined') {
            conf.player[ret.name].save.name = ret.save.name;
            conf.player[ret.name].save.path = ret.save.path;
        } else {
            print('bettersave player switchto warning ret ' + ret.name + ' is not in conf list');
        }

        conf.currentName = ret.name;

        writeConfig();
        markLocalChanged();

        currentPlayer = ret;
        ui.setupMultiplayer(currentPlayer.name);
    };
    ret.remove = () => {
        if (ret.isCurrent()) return;
        if (!checkExist(ret)) return;
        delete conf.player[ret.name];
        writeConfig();
        markLocalChanged();
        if (ret.save.path == null) return;
        fs.removeFile(ret.save.path);
        markLocalChanged();
    };
    return ret;
}

exports.read = () => {
    let ret = [];
    for (let i in conf.player) {
        ret.push(makeObj(conf.player[i]));
    }
    return ret;
};

exports.add = (name) => {
    if (typeof conf.player[name] != 'undefined') throw new Error('player already existed');
    conf.player[name] = {
        name: name,
        save: {
            name: null,
            path: null
        }
    };
    writeConfig();
    markLocalChanged();
};

exports.current = () => {
    return currentPlayer;
};
