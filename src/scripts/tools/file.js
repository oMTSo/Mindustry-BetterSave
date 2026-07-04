
exports.readFile = (path) => {
    return java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(path));
};

exports.readDir = (path) => {
    let dir = new java.io.File(path);
    let lst = dir.listFiles();
    let out = [];
    lst.forEach(c => out.push(c.getName()));
    return out;
};

exports.writeFile = (path, data) => {
    let v = data;
    if (typeof data.getClass == 'undefined') {
        v = java.nio.ByteBuffer.allocate(data.length);
        v.put(data);
        v = v.array();
    }
    let f = new Fi(path);
    if (f.exists()) f['delete']();
    let w = new java.io.FileOutputStream(path);
    w.write(v);
    w.close();
};

exports.removeFile = (path) => {
    let f = new Fi(path);
    if (f.exists()) f['delete']();
};

exports.pathExist = (path) => {
    let f = new Fi(path);
    return f.exists();
};

exports.mkdir = (path) => {
    let f = new Fi(path);
    if (!f.exists()) f.mkdirs();
};

exports.removeFilesInDir = (path) => {
    if (path.endsWith('/') || path.endsWith('\\')) path = path.slice(0, path.length - 1);
    if (!exports.pathExist(path)) return;
    let lst = exports.readDir(path);
    for (let i of lst) {
        try {
            exports.removeFile(path + '/' + i);
        } catch (e) {
            print(e);
        }
    }
};

exports.isDir = (path) => {
    let f = new Fi(path);
    return f.isDirectory();
};