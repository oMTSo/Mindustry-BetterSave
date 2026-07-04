
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


exports.post = (url, header, body) => {
    let content = new java.io.ByteArrayInputStream(body);
    let req = new Packages.arc.util.Http.request(Packages.arc.util.Http.HttpMethod.POST, url);
    req.content = null;
    req.contentStream = content;
    req.timeout = 3600000;
    let h = checkUA(header);
    for (let i in h) req.header(i, h[i]);
    return handleRequest(req);
};

exports.put = (url, header, body) => {
    let content = new java.io.ByteArrayInputStream(body);
    let req = new Packages.arc.util.Http.request(Packages.arc.util.Http.HttpMethod.PUT, url);
    req.content = null;
    req.contentStream = content;
    req.timeout = 3600000;
    let h = checkUA(header);
    for (let i in h) req.header(i, h[i]);
    return handleRequest(req);
};

exports.get = (url, header) => {
    let req = new Packages.arc.util.Http.get(url);
    req.timeout = 3600000;
    let h = checkUA(header);
    for (let i in h) req.header(i, h[i]);
    return handleRequest(req);
};

exports.del = (url, header, body) => {
    let content = new java.io.ByteArrayInputStream(body);
    print(url);
    print(header);
    print(content);
    let req = new Packages.arc.util.Http.request(Packages.arc.util.Http.HttpMethod.DELETE, url);
    req.content = null;
    req.contentStream = content;
    req.timeout = 3600000;
    let h = checkUA(header);
    for (let i in h) req.header(i, h[i]);
    return handleRequest(req);
};