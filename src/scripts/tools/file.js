
// 读取文件内容为字节数组
exports.readFile = (path) => {
    return java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(path));
};

// 读取目录下的所有文件名
exports.readDir = (path) => {
    let dir = new java.io.File(path);
    let lst = dir.listFiles();
    let out = [];
    // 转换Java数组为JS数组
    lst.forEach(c => out.push(c.getName()));
    return out;
};

// 写入数据到文件
exports.writeFile = (path, data) => {
    let v = data;
    // 如果不是Java对象（是JS数组或其他），则转换为ByteBuffer
    if (typeof data.getClass == 'undefined') {
        v = java.nio.ByteBuffer.allocate(data.length);
        v.put(data);
        v = v.array();
    }
    // 使用Mindustry的Fi (FileHandle) 类先删除旧文件
    let f = new Fi(path);
    if (f.exists()) f['delete']();
    // 使用Java IO流写入新文件
    let w = new java.io.FileOutputStream(path);
    w.write(v);
    w.close();
};

// 删除文件
exports.removeFile = (path) => {
    let f = new Fi(path);
    if (f.exists()) f['delete']();
};

// 检查路径是否存在
exports.pathExist = (path) => {
    let f = new Fi(path);
    return f.exists();
};

// 创建目录（递归）
exports.mkdir = (path) => {
    let f = new Fi(path);
    if (!f.exists()) f.mkdirs();
};

// 删除目录下的所有文件
exports.removeFilesInDir = (path) => {
    // 规范化路径结尾
    if (path.endsWith('/') || path.endsWith('\\')) path = path.slice(0, path.length - 1);
    if (!exports.pathExist(path)) return;
    let lst = exports.readDir(path);
    // 遍历删除
    for (let i of lst) {
        try {
            exports.removeFile(path + '/' + i);
        } catch (e) {
            print(e);
        }
    }
};