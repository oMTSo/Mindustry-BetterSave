
const types = require('bettersave/tools/type');

var setting = null;

function readSetting(key) {
    var r = Packages.arc.Core.settings.get(key, '');
    switch (typeof r) {
        case 'boolean':
        case 'string': {
            return {
                type: typeof r,
                value: r,
                key: key
            };
        }
        case 'object': {
            return {
                type: 'binary',
                value: r,
                key: key
            };
        }
        case 'number': {
            let ret = {
                type: '',
                value: r,
                key: key
            };
            if (parseInt(r) == r) {
                if (r > 2147483647 || r < -2147483648) {
                    ret.type = 'long';
                } else {
                    ret.type = 'int';
                }
            } else {
                ret.type = 'float';
            }
            return ret;
        }
        default: {
            return {
                type: typeof r,
                value: r,
                key: key
            };
        }
    }
}

function settingKeys() {
    var ret = [];
    Packages.arc.Core.settings.keys().forEach(c => ret.push(c));
    return ret;
}

/*
    =List of settings we need to store=
        *-unlocked
        save-*-name
        save-*-autosave
        hiscore*
        last-sector-save
        lastplanet
        req-*
        *-hint-done
        *-s-*-info
        lastloadout-*
        lastloadout-core-foundation
        lastloadout-core-nucleus
        lastloadout-core-shard
        launch-resources-seq
    ==
*/
function filter(key) {
    return (
        (key.endsWith('-unlocked')) ||
        (key.startsWith('save-') && key.endsWith('-name')) ||
        (key.startsWith('save-') && key.endsWith('-autosave')) ||
        (key.startsWith('hiscore')) ||
        (key == 'last-sector-save') ||
        (key == 'lastplanet') ||
        (key.startsWith('req-')) ||
        (key.endsWith('-hint-done')) ||
        (!key.startsWith('-s-') && key.includes('-s-') && key.endsWith('-info')) ||
        (key.startsWith('lastloadout-')) ||
        (key == 'lastloadout-core-foundation') ||
        (key == 'lastloadout-core-nucleus') ||
        (key == 'lastloadout-core-shard') ||
        (key == 'launch-resources-seq')
    );
}

function writeSetting(obj) {
    var value;
    if (obj.type == 'binary') {
        value = java.nio.ByteBuffer.allocate(obj.value.length);
        value.put(obj.value);
        value = value.array();
    }
    if (obj.type == 'float') value = new java.lang.Float(obj.value);
    if (obj.type == 'int') value = new java.lang.Integer(obj.value);
    if (obj.type == 'long') value = new java.lang.Long(obj.value);
    if (obj.type == 'string') value = new java.lang.String(obj.value);
    if (obj.type == 'boolean') value = new java.lang.Boolean(obj.value);
    Packages.arc.Core.settings.put(obj.key, value);
}

const typeMap = ['boolean', 'int', 'long', 'float', 'string', 'binary'];

function makeSettingBlock(obj, stream) {
    stream.writeUTF(obj.key)
    stream.writeByte(typeMap.indexOf(obj.type));
    switch (obj.type) {
        case 'boolean': {
            stream.writeBoolean(obj.value)
            break;
        }
        case 'int': {
            stream.writeInt(obj.value)
            break;
        }
        case 'long': {
            stream.writeLong(obj.value)
            break;
        }
        case 'float': {
            stream.writeFloat(obj.value)
            break;
        }
        case 'string': {
            stream.writeUTF(obj.value)
            break;
        }
        case 'binary': {
            stream.writeLong(obj.value.length);
            stream.write(obj.value, 0, obj.value.length);
            break;
        }
        default: { }
    }
}

function readSettingBlock(stream) {
    var ret = {
        type: '',
        key: '',
        value: 0
    };
    ret.key = stream.readUTF();
    ret.type = typeMap[stream.readByte()];
    switch (ret.type) {
        case 'boolean': {
            ret.value = stream.readBoolean();
            return ret;
        }
        case 'int': {
            ret.value = stream.readInt();
            return ret;
        }
        case 'long': {
            ret.value = stream.readLong();
            return ret;
        }
        case 'float': {
            ret.value = stream.readFloat();
            return ret;
        }
        case 'string': {
            ret.value = stream.readUTF();
            return ret;
        }
        case 'binary': {
            let len = stream.readLong();
            ret.value = types.byteArray(len);
            stream.readFully(ret.value);
            return ret;
        }
        default: {
            return ret;
        }
    }
}

exports.reset = () => {
    settingKeys().forEach(key => {
        if (filter(key)) Packages.arc.Core.settings.remove(key);
    });
    Packages.arc.Core.settings.manualSave();
};

exports.load = (data) => {
    let stream = new java.io.DataInputStream(new java.io.ByteArrayInputStream(data));
    let num = stream.readLong();
    setting = {};
    for (let i = 0; i < num; i++) {
        let o = readSettingBlock(stream);
        setting[o.key] = o;
    }
};

exports.unload = () => {
    setting = null;
};

exports.read = (key, defaultValue) => {
    if (setting == null) return Packages.arc.Core.settings.get(key, defaultValue)
    let o = setting[key];
    if (typeof o == 'undefined') return defaultValue;
    return o.value;
};

exports.write = (key, type, value) => {
    let o = {
        key: key,
        type: type,
        value: value
    };
    if (setting == null) {
        writeSetting(o);
        Packages.arc.Core.settings.manualSave();
    } else {
        setting[key] = o;
    }
};

exports.apply = () => {
    if (setting == null) return;
    let keys = Object.keys(setting);
    for (let o of keys) {
        writeSetting(setting[o]);
    }
    Packages.arc.Core.settings.manualSave();
};

exports.pack = () => {
    let byteStream = new java.io.ByteArrayOutputStream();
    let stream = new java.io.DataOutputStream(byteStream);
    let lst = [];
    settingKeys().forEach(key => {
        if (filter(key)) lst.push(key);
    });
    stream.writeLong(lst.length);
    for (let key of lst) makeSettingBlock(readSetting(key), stream);
    return byteStream.toByteArray();
}

exports.unpack = (data) => {
    exports.reset();
    exports.load(data);
    exports.apply();
    exports.unload();
}

