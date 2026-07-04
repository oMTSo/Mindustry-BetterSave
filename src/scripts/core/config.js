
const fs = require('bettersave/tools/file');
const types = require('bettersave/tools/type');

exports.dataDir = Vars.saveDirectory.toString() + '/../betterSave';

exports.gameSaveDir = Vars.saveDirectory.toString();

exports.gameMapDir = exports.gameSaveDir + '/../maps';

exports.saveDir = exports.dataDir + '/saves';

exports.bluepointDir = exports.gameSaveDir + '/../schematics';

exports.playerDir = exports.dataDir + '/players'

exports.tmpDir = exports.dataDir + '/tmp';

exports.configDir = exports.dataDir + '/config';

var inited = false;

function checkDir(path) {
    fs.mkdir(path);
}

exports.init = () => {
    checkDir(exports.dataDir);
    checkDir(exports.gameSaveDir);
    checkDir(exports.saveDir);
    checkDir(exports.bluepointDir);
    checkDir(exports.configDir);
    checkDir(exports.tmpDir);
    checkDir(exports.gameMapDir);
    checkDir(exports.playerDir);
    inited = true;
};

exports.isInited = () => {
    return inited;
};

exports.readConfig = (name) => {
    if (!fs.pathExist(exports.configDir + '/' + name + '.json')) return {};
    return JSON.parse(types.toString(fs.readFile(exports.configDir + '/' + name + '.json')));
};

exports.writeConfig = (name, obj) => {
    fs.writeFile(exports.configDir + '/' + name + '.json', types.getString(JSON.stringify(obj)));
};