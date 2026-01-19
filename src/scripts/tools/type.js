
// 将 JS 字符串转换为 Java 字节数组 (UTF-8)
exports.getString = (str) => {
    if (str.length == 0) return [];
    return (new java.lang.String(str)).getBytes(java.nio.charset.Charset.forName("UTF-8"));
};

// 将 Java 字节数组转换为 JS 字符串 (UTF-8)
exports.toString = (obj) => {
    if (obj.length == 0) return '';
    var o = java.nio.ByteBuffer.allocate(obj.length);
    o.put(obj);
    var r = new java.lang.String(o.array(), java.nio.charset.Charset.forName("UTF-8"));
    return r.concat(''); // 确保返回的是 JS String 类型
};

// 创建指定长度的空的 Java 字节数组
exports.byteArray = (length) => {
    let o = java.nio.ByteBuffer.allocate(length);
    return o.array();
};