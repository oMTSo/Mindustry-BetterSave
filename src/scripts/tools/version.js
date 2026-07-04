const mod = Vars.mods.getMod("bettersave");

var versionStr = "0.0.0";
var description = "none";

if (versionStr == "0.0.0" && mod.meta.version) versionStr = mod.meta.version;
if (description == "none" && mod.meta.description) description = mod.meta.description;

const parts = versionStr.split('.');

exports.major = parseInt(parts[0]) || 0;
exports.minor = parseInt(parts[1]) || 0;
exports.bugFix = parseInt(parts[2]) || 0;

exports.description = description;
