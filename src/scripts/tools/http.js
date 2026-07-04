
const defaultUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36';

function checkUA(header) {
    if (header['User-Agent'] != undefined) return header;
    if (header['user-agent'] != undefined) return header;
    return Object.assign(header, { 'User-Agent': defaultUA });
}

function handleRequest(req) {
    let ret = {
        body: [],
        code: 0,
        header: {}
    };
    try {
        req.block({
            get: (v) => {
                if (typeof v.getResult == 'undefined') throw v;
                ret.body = v.getResult();
                ret.code = v.getStatus().code;
                let h = v.getHeaders();
                let hlst = h.keys().toSeq();
                for (let i = 0; i < hlst.size; i++) {
                    ret.header[hlst.items[i]] = h.get(hlst.items[i], '').items[0];
                }
            }
        });
    } catch (e) {
        throw e;
    }
    return ret;
}

function requestWithArcBody(method, url, header, body) {
    let req = new Packages.arc.util.Http.request(method, url);
    req.content = new java.lang.String(body, java.nio.charset.Charset.forName("UTF-8"));
    req.contentStream = null;
    req.timeout = 3600000;
    let h = checkUA(header);
    for (let i in h) req.header(i, h[i]);
    return handleRequest(req);
}

function findPublicMethod(className, name, paramNames) {
    let methods = java.lang.Class.forName(className).getMethods();
    for (let i = 0; i < methods.length; i++) {
        let m = methods[i];
        if (m.getName() != name) continue;
        let types = m.getParameterTypes();
        if (types.length != paramNames.length) continue;

        let ok = true;
        for (let j = 0; j < types.length; j++) {
            if (types[j].getName() != paramNames[j]) {
                ok = false;
                break;
            }
        }
        if (ok) return m;
    }
    throw new Error('Can not find method ' + className + '.' + name);
}

function invokePublic(className, name, paramNames, target, args) {
    let arr = java.lang.reflect.Array.newInstance(java.lang.Class.forName('java.lang.Object'), args.length);
    for (let i = 0; i < args.length; i++) java.lang.reflect.Array.set(arr, i, args[i]);
    return findPublicMethod(className, name, paramNames).invoke(target, arr);
}

function forceRequestMethod(conn, method) {
    try {
        invokePublic('java.net.HttpURLConnection', 'setRequestMethod', ['java.lang.String'], conn, [new java.lang.String(method)]);
    } catch (e) {
        if (method !== 'POST') throw e;
    }
}

function requestWithUrlConnection(method, url, header, body) {
    let ret = {
        body: [],
        code: 0,
        header: {}
    };

    let conn = new java.net.URL(url).openConnection();
    invokePublic('java.net.URLConnection', 'setDoOutput', ['boolean'], conn, [java.lang.Boolean.TRUE]);
    invokePublic('java.net.URLConnection', 'setConnectTimeout', ['int'], conn, [new java.lang.Integer(3600000)]);
    invokePublic('java.net.URLConnection', 'setReadTimeout', ['int'], conn, [new java.lang.Integer(3600000)]);
    invokePublic('java.net.HttpURLConnection', 'setFixedLengthStreamingMode', ['int'], conn, [new java.lang.Integer(body.length)]);
    forceRequestMethod(conn, method);

    let h = checkUA(header);
    for (let i in h) {
        invokePublic('java.net.URLConnection', 'setRequestProperty', ['java.lang.String', 'java.lang.String'], conn, [
            new java.lang.String(i),
            new java.lang.String(h[i])
        ]);
    }

    let out = invokePublic('java.net.URLConnection', 'getOutputStream', [], conn, []);
    invokePublic('java.io.OutputStream', 'write', ['[B'], out, [body]);
    invokePublic('java.io.OutputStream', 'close', [], out, []);

    ret.code = invokePublic('java.net.HttpURLConnection', 'getResponseCode', [], conn, []);
    let stream = ret.code >= 400
        ? invokePublic('java.net.HttpURLConnection', 'getErrorStream', [], conn, [])
        : invokePublic('java.net.URLConnection', 'getInputStream', [], conn, []);
    if (stream != null) {
        let bout = new java.io.ByteArrayOutputStream();
        let buf = java.nio.ByteBuffer.allocate(8192).array();
        let len = invokePublic('java.io.InputStream', 'read', ['[B'], stream, [buf]);
        while (len != -1) {
            bout.write(buf, 0, len);
            len = invokePublic('java.io.InputStream', 'read', ['[B'], stream, [buf]);
        }
        ret.body = bout.toByteArray();
        invokePublic('java.io.InputStream', 'close', [], stream, []);
    }
    let fields = invokePublic('java.net.URLConnection', 'getHeaderFields', [], conn, []);
    let keys = fields.keySet().toArray();
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] == null) continue;
        let values = fields.get(keys[i]);
        if (values.size() > 0) ret.header[keys[i]] = values.get(0);
    }
    return ret;
}

function requestWithBody(methodName, arcMethod, url, header, body) {
    try {
        if (typeof arcMethod != 'undefined') {
            let res = requestWithArcBody(arcMethod, url, header, body);
            if (res.code != 0) return res;
            print('Arc HTTP returned status 0 for ' + methodName + ', retrying with Java HTTP.');
        }
    } catch (e) {
        print(e);
    }

    return requestWithUrlConnection(methodName, url, header, body);
}

exports.post = (url, header, body) => {
    return requestWithBody('POST', Packages.arc.util.Http.HttpMethod.POST, url, header, body);
};

exports.put = (url, header, body) => {
    return requestWithBody('PUT', Packages.arc.util.Http.HttpMethod.PUT, url, header, body);
};

exports.get = (url, header) => {
    let req = new Packages.arc.util.Http.get(url);
    req.timeout = 3600000;
    let h = checkUA(header);
    for (let i in h) req.header(i, h[i]);
    return handleRequest(req);
};

exports.del = (url, header, body) => {
    return requestWithBody('DELETE', Packages.arc.util.Http.HttpMethod.DELETE, url, header, body);
};

exports.patch = (url, header, body) => {
    let arcMethod = undefined;
    try {
        arcMethod = Packages.arc.util.Http.HttpMethod.PATCH;
    } catch (e) {
    }
    return requestWithBody('PATCH', arcMethod, url, header, body);
};
