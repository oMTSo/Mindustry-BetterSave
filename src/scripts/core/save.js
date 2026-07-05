// 存档归档：创建、读取、应用和删除 BetterSave 的 SMSF 备份文件。
const config = require('bettersave/core/config');
const fs = require('bettersave/tools/file');
const smsf = require('bettersave/core/smsf');
const setting = require('bettersave/core/setting');
const control = require('bettersave/core/control');
const localSyncState = require('bettersave/cloud/localSyncState');


exports.init = () => {
    if (!config.isInited()) config.init();
};

function isBetterSavePath(path, dir) {
    if (path == null) return false;
    let p = path.replace(/[\\]/g, '/');
    let d = dir.replace(/[\\]/g, '/');
    return p.startsWith(d + '/');
}

function makeObj(obj) {
    let ret = obj;
    ret.save = {
        name: null,
        path: null,
        data: null
    };
    ret.readFiles = () => {
        if (ret.save.path == null && ret.save.data == null) return;
        let data = ret.save.data;
        if (ret.save.data == null) data = fs.readFile(ret.save.path);
        let stream = new java.io.DataInputStream(new java.io.ByteArrayInputStream(data));
        let c = smsf.read(stream);
        ret.files = c.files;
        ret.save.data = null;
    };
    ret.remove = () => {
        if (ret.save.path == null) return;
        fs.removeFile(ret.save.path);
        localSyncState.markLocalChanged();
    };
    ret.apply = () => {
        if (typeof ret.files == 'undefined') ret.readFiles();
        control.closeCurrentMap();
        exports.reset();
        for (let f of ret.files) {
            if (f.name == '$setting') {
                setting.unpack(f.data);
                continue;
            }
            fs.writeFile(config.gameSaveDir + '/' + f.name, f.data);
        }
        control.reloadSave();
    };
    ret.makeData = () => {
        let byteStream = new java.io.ByteArrayOutputStream();
        let stream = new java.io.DataOutputStream(byteStream);
        smsf.make(ret, stream);
        return byteStream.toByteArray();
    };
    ret.write = (path) => {
        if (typeof path == 'undefined') path = ret.save.path;
        if (path == null) print('Waring: empty path in save write.');
        fs.writeFile(path, ret.makeData());
        if (isBetterSavePath(path, config.saveDir) || isBetterSavePath(path, config.playerDir)) {
            localSyncState.markLocalChanged();
        }
    };
    ret.writeToSavePath = () => {
        let path = config.saveDir + '/' + getSaveFileName(ret);
        ret.write(path);
        ret.save.path = path;
        ret.save.name = getSaveFileName(ret);
    };
    return ret;
}

function getSaveFileName(obj) {
    return obj.time[0].toString() + '-' + obj.time[1].toString() + '-' + obj.time[2].toString() + '-' + obj.time[3].toString() + '-' + obj.time[4].toString() + '-' + obj.time[5].toString() + '.smsf';
}

exports.readData = (data) => {
    let stream = new java.io.DataInputStream(new java.io.ByteArrayInputStream(data));
    let ret = makeObj(smsf.readMeta(stream));
    ret.save.data = data;
    return ret;
};

exports.readFile = (path) => {
    let data = fs.readFile(path);
    let ret = exports.readData(data);
    ret.save = {
        name: path.replace(/[\\]/g, '/').split('/').pop(),
        path: path
    };
    return ret;
};

exports.readAll = () => {
    let ret = [];
    let lst = fs.readDir(config.saveDir);
    for (let fn of lst) {
        try {
            ret.push(exports.readFile(config.saveDir + '/' + fn));
        } catch (e) {
            print(e);
        }
    }
    return ret;
};

exports.reset = () => {
    fs.removeFilesInDir(config.gameSaveDir);
    fs.removeFilesInDir(config.bluepointDir);
};

exports.make = (name) => {
    control.saveCurrentMap();
    let d = new Date();
    let o = {
        name: name,
        time: [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()],
        files: []
    };
    let lst = fs.readDir(config.gameSaveDir);
    for (let fn of lst) {
        o.files.push({
            name: fn,
            data: fs.readFile(config.gameSaveDir + '/' + fn)
        });
    }
    lst = fs.readDir(config.bluepointDir);
    for (let fn of lst) {
        o.files.push({
            name: '../schematics/' + fn,
            data: fs.readFile(config.bluepointDir + '/' + fn)
        });
    }
    o.files.push({
        name: '$setting',
        data: setting.pack()
    });
    let ret = makeObj(o);
    ret.save.name = getSaveFileName(ret);
    return ret;
};

