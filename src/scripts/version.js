const mod = Vars.mods.getMod("bettersave");

var versionStr = "0.0.0";
var changeLogStr = "none";

try {
    let file = mod.file.child("mod.json");
    if (file.exists()) {
        let json = JSON.parse(file.readString());
        if (json.version) versionStr = json.version;
        if (json.changeLog) changeLogStr = json.changeLog;
    } else {
        versionStr = mod.meta.version;
    }
} catch (e) {
    print("BetterSave: Error reading mod.json - " + e);
    versionStr = mod.meta.version;
}

const parts = versionStr.split('.');

exports.major = parseInt(parts[0]) || 0;
exports.minor = parseInt(parts[1]) || 0;
exports.bugFix = parseInt(parts[2]) || 0;

exports.changeLog = changeLogStr;
