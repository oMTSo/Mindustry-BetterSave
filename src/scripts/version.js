// 获取当前模组对象
// 注意：这里用 "bettersave" 是因为 mod.json 里的 name 是 "bettersave"
const mod = Vars.mods.getMod("bettersave");

var versionStr = "0.0.0";
var changeLogStr = "暂无更新日志";

// 尝试读取 mod.json
try {
    // mod.file 指向模组的根目录（或者是 zip 文件）
    // 对于开发中的解压模组，它是一个目录
    let file = mod.file.child("mod.json");
    if (file.exists()) {
        let json = JSON.parse(file.readString());
        if (json.version) versionStr = json.version;
        if (json.changeLog) changeLogStr = json.changeLog;
    } else {
        // 如果读不到文件（比如是加密的或者路径不对），降级使用 meta 信息
        versionStr = mod.meta.version;
    }
} catch (e) {
    print("BetterSave: Error reading mod.json - " + e);
    // 降级
    versionStr = mod.meta.version;
}

const parts = versionStr.split('.');

exports.major = parseInt(parts[0]) || 0;
exports.minor = parseInt(parts[1]) || 0;
exports.bugFix = parseInt(parts[2]) || 0;

exports.changeLog = changeLogStr;
