
exports.getString = (str)=>{
    if (str.length==0) return [];
    return (new java.lang.String(str)).getBytes(java.nio.charset.Charset.forName("UTF-8"));
};

exports.toString = (obj)=>{
    if (obj.length==0) return '';
    var o = java.nio.ByteBuffer.allocate(obj.length);
    o.put(obj);
    var r = new java.lang.String(o.array(),java.nio.charset.Charset.forName("UTF-8"));
    return r.concat('');
};

exports.byteArray = (length)=>{
    let o = java.nio.ByteBuffer.allocate(length);
    return o.array();
};