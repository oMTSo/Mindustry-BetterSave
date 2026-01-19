
const fs = require('betterSave/tools/file');
const types = require('betterSave/tools/type');

// Mod 数据根目录：位于游戏存档目录的平级目录 "saveMaster"
exports.dataDir = Vars.saveDirectory.toString() + '/../betterSave';

// 游戏原生存档目录
exports.gameSaveDir = Vars.saveDirectory.toString();

// 游戏地图目录
exports.gameMapDir = exports.gameSaveDir + '/../maps';

// 游戏蓝图目录
exports.bluepointDir = exports.gameSaveDir + '/../schematics';

// Mod 备份存档存放目录 (saveMaster/saves)
exports.saveDir = exports.dataDir + '/saves';

// 玩家数据目录 (多玩家相关)
exports.playerDir = exports.dataDir + '/players'

// 临时文件目录
exports.tmpDir = exports.dataDir + '/tmp';

// 配置文件目录
exports.configDir = exports.dataDir + '/config';

var inited = false;

// 辅助函数：如果不存在则创建目录
function checkDir(path) {
    fs.mkdir(path);
}

// 初始化目录结构
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

// 检查是否已初始化
exports.isInited = () => {
    return inited;
};

// 读取JS对象配置（JSON格式）
exports.readConfig = (name) => {
    if (!fs.pathExist(exports.configDir + '/' + name + '.json')) return {};
    return JSON.parse(types.toString(fs.readFile(exports.configDir + '/' + name + '.json')));
};

// 写入JS对象配置到文件
exports.writeConfig = (name, obj) => {
    fs.writeFile(exports.configDir + '/' + name + '.json', types.getString(JSON.stringify(obj)));
};