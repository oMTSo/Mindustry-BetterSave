
const types = require('bettersave/tools/type');

const magic = [0x53, 0x4D, 0x53, 0x46];
const version = 100;

function readMagic(stream) {
    for (let i in magic) {
        if (stream.readByte() != magic[i]) return false;
    }
    return true;
}

function makeMagic(stream) {
    return stream.write(magic, 0, 4);
}

function readHeader(stream) {
    var ret = {
        version: 0,
        name: '',
        time: [1990, 1, 1, 12, 30, 0],
        fileNum: 0
    };
    ret.version = stream.readInt();
    ret.name = stream.readUTF();
    ret.time[0] = stream.readInt();
    ret.time[1] = stream.readByte();
    ret.time[2] = stream.readByte();
    ret.time[3] = stream.readByte();
    ret.time[4] = stream.readByte();
    ret.time[5] = stream.readByte();
    ret.fileNum = stream.readInt();
    return ret;
}

function makeHeader(obj, stream) {
    stream.writeInt(obj.version);
    stream.writeUTF(obj.name)
    stream.writeInt(obj.time[0]);
    stream.writeByte(obj.time[1]);
    stream.writeByte(obj.time[2]);
    stream.writeByte(obj.time[3]);
    stream.writeByte(obj.time[4]);
    stream.writeByte(obj.time[5]);
    stream.writeInt(obj.fileNum);
}

function readFiles(stream, fileNum) {
    var ret = {
        files: []
    };
    for (let i = 0; i < fileNum; i++) {
        let name = stream.readUTF();
        let filelen = stream.readLong();
        let file = types.byteArray(filelen);
        stream.readFully(file);
        ret.files.push({
            name: name,
            data: file
        });
    }
    return ret;
}

function makeFiles(obj, stream) {
    for (let f of obj) {
        stream.writeUTF(f.name);
        stream.writeLong(f.data.length);
        stream.write(f.data, 0, f.data.length);
    }
}

exports.read = (stream) => {
    if (!readMagic(stream)) throw new Error('Not a vaild smsf file: magic not match.');
    let ret = {};
    ret = Object.assign(ret, readHeader(stream));
    if (ret.version != version) throw new Error('Not supported version: ' + ret.version.toString() + '.');
    ret = Object.assign(ret, readFiles(stream, ret.fileNum));
    ret.fileNum = undefined;
    ret.version = undefined;
    return ret;
};

exports.readMeta = (stream) => {
    if (!readMagic(stream)) throw new Error('Not a vaild smsf file: magic not match.');
    let ret = {};
    ret = Object.assign(ret, readHeader(stream));
    if (ret.version != version) throw new Error('Not supported version: ' + ret.version.toString() + '.');
    ret.version = undefined;
    return ret;
};

exports.make = (obj, stream) => {
    obj.fileNum = obj.files.length;
    obj.version = version;
    makeMagic(stream);
    makeHeader(obj, stream);
    makeFiles(obj.files, stream);
};