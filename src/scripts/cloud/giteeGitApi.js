// Gitee API：使用 tree/blob 读取，用 commits actions 实现覆盖式同步。
const http = require('bettersave/tools/http');
const types = require('bettersave/tools/type');

function encodeParam(v) {
    return encodeURIComponent(v);
}

function getRequestMeta(conf, path, extraParams) {
    let fullUrl = 'https://gitee.com/api/v5/repos/' + encodeParam(conf.owner) + '/' + encodeParam(conf.repo) + path;
    let params = {};
    extraParams = extraParams || {};
    for (let k in extraParams) params[k] = extraParams[k];
    if (conf.token) params.access_token = conf.token;

    for (let k in params) {
        let sep = fullUrl.includes('?') ? '&' : '?';
        fullUrl += sep + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }

    return {
        url: fullUrl,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };
}

function bodyBytes(obj) {
    return new java.lang.String(JSON.stringify(obj)).getBytes('UTF-8');
}

function readJsonResponse(res, desc, expectedCodes) {
    if (expectedCodes.indexOf(res.code) === -1) {
        throw new Error(desc + ' failed: ' + res.code + ' ' + types.toString(res.body));
    }
    let txt = types.toString(res.body);
    if (txt.length == 0) return {};
    return JSON.parse(txt);
}

function checkCancelled(cancelToken) {
    if (!cancelToken) return;
    if (typeof cancelToken.throwIfCancelled == 'function') {
        cancelToken.throwIfCancelled();
        return;
    }
    if (cancelToken.cancelled) {
        let e = new Error('Cloud sync cancelled.');
        e.cancelled = true;
        throw e;
    }
}

function getRepository(conf) {
    let meta = getRequestMeta(conf, '');
    return readJsonResponse(http.get(meta.url, meta.headers), 'Get repository', [200]);
}

function getBranch(conf) {
    let meta = getRequestMeta(conf, '/branches/' + encodeParam(conf.branch));
    return readJsonResponse(http.get(meta.url, meta.headers), 'Get branch', [200]);
}

function getCommit(conf, sha) {
    let meta = getRequestMeta(conf, '/commits/' + encodeParam(sha));
    return readJsonResponse(http.get(meta.url, meta.headers), 'Get commit', [200]);
}

function fetchRecursiveTree(conf, ref) {
    let meta = getRequestMeta(conf, '/git/trees/' + encodeParam(ref), { recursive: '1' });
    return readJsonResponse(http.get(meta.url, meta.headers), 'Fetch tree', [200]);
}

function fetchBlob(conf, sha) {
    let meta = getRequestMeta(conf, '/git/blobs/' + sha);
    return readJsonResponse(http.get(meta.url, meta.headers), 'Fetch blob', [200]);
}

function createCommit(conf, message, actions) {
    let meta = getRequestMeta(conf, '/commits');
    return readJsonResponse(http.post(meta.url, meta.headers, bodyBytes({
        access_token: conf.token,
        branch: conf.branch,
        message: message,
        actions: actions
    })), 'Create commit', [200, 201]);
}

function decodeBlobContent(blob) {
    return java.util.Base64.getMimeDecoder().decode(blob.content.replace(/\n/g, ''));
}

function bytesToHex(data) {
    let ret = '';
    for (let i = 0; i < data.length; i++) {
        let v = data[i];
        if (v < 0) v += 256;
        let s = v.toString(16);
        if (s.length < 2) s = '0' + s;
        ret += s;
    }
    return ret;
}

function gitBlobSha(data) {
    let digest = java.security.MessageDigest.getInstance('SHA-1');
    let header = new java.lang.String('blob ' + data.length + '\u0000').getBytes('UTF-8');
    digest.update(header);
    digest.update(data);
    return bytesToHex(digest.digest());
}

function readTextBlob(conf, sha, cancelToken) {
    checkCancelled(cancelToken);
    let blob = fetchBlob(conf, sha);
    checkCancelled(cancelToken);
    return new java.lang.String(
        decodeBlobContent(blob),
        java.nio.charset.Charset.forName('UTF-8')
    ).toString();
}

function findTreeBlob(tree, path) {
    for (let item of tree.tree) {
        if (item.type !== 'blob') continue;
        if (item.path === path) return item;
    }
    return null;
}

function treeBlobMap(tree) {
    let ret = {};
    if (!tree || !tree.tree) return ret;
    for (let item of tree.tree) {
        if (item.type !== 'blob') continue;
        ret[item.path] = item;
    }
    return ret;
}

function normalizeTree(tree) {
    if (!tree || !tree.tree) return { tree: [] };
    return tree;
}

function normalizeProgress(progress) {
    progress = progress || {};
    return {
        current: progress.current || 0,
        total: progress.total || 0,
        onProgress: progress.onProgress || null
    };
}

function progressCall(progress, current, total, path) {
    if (!progress || typeof progress.onProgress != 'function') return;
    progress.onProgress({
        current: current,
        total: total,
        path: path
    });
}

function base64(data) {
    return new java.lang.String(java.util.Base64.getEncoder().encode(data)).toString();
}

function markProgressForUploadedFile(progress, f) {
    if (f.path === 'meta/sync.json') return;
    progress.current++;
    progressCall(progress, progress.current, progress.total, f.path);
}

function readBranchTree(conf, cancelToken) {
    checkCancelled(cancelToken);
    getBranch(conf);
    checkCancelled(cancelToken);
    return normalizeTree(fetchRecursiveTree(conf, conf.branch));
}

function remoteSyncedPath(path) {
    return path.startsWith('config/') || path.startsWith('saves/') || path.startsWith('players/') || path === 'meta/sync.json';
}

function syncedDataPath(path) {
    return path.startsWith('config/') || path.startsWith('saves/') || path.startsWith('players/');
}

exports.testRepository = (conf) => {
    try {
        getRepository(conf);
        getBranch(conf);
        return true;
    } catch (e) {
        print(e);
        return false;
    }
};

exports.replaceBranchTree = (conf, localFiles, message, cancelToken, progress) => {
    progress = normalizeProgress(progress);

    checkCancelled(cancelToken);
    let tree = readBranchTree(conf, cancelToken);
    let remoteFiles = treeBlobMap(tree);
    let keep = {};
    let changedDataFiles = [];
    let actions = [];

    for (let f of localFiles) {
        checkCancelled(cancelToken);
        if (typeof f.makeData == 'function') f.makeData();
        f.blobSha = gitBlobSha(f.data);

        let oldItem = remoteFiles[f.path];
        keep[f.path] = true;
        if (oldItem && f.blobSha && oldItem.sha === f.blobSha) {
            continue;
        }

        let action = oldItem ? 'update' : 'create';
        actions.push({
            action: action,
            path: f.path,
            content: base64(f.data),
            encoding: 'base64'
        });
        if (f.path !== 'meta/sync.json') changedDataFiles.push(f);
        print('Prepared cloud file: ' + f.path);
    }

    for (let path in remoteFiles) {
        if (!remoteSyncedPath(path)) continue;
        if (keep[path]) continue;
        actions.push({
            action: 'delete',
            path: path
        });
    }

    if (actions.length == 0) {
        return getCommit(conf, conf.branch);
    }

    progress.total = changedDataFiles.length;
    progress.current = 0;
    for (let f of changedDataFiles) {
        markProgressForUploadedFile(progress, f);
    }

    checkCancelled(cancelToken);
    let commit = createCommit(conf, message, actions);
    if (cancelToken && typeof cancelToken.markCommitted == 'function') cancelToken.markCommitted();
    return commit;
};

exports.readBranchState = (conf, cancelToken) => {
    let tree = readBranchTree(conf, cancelToken);
    let metaItem = findTreeBlob(tree, 'meta/sync.json');
    let remoteMeta = null;
    if (metaItem) remoteMeta = JSON.parse(readTextBlob(conf, metaItem.sha, cancelToken));
    return {
        tree: tree,
        meta: remoteMeta
    };
};

exports.readBranchFiles = (conf, paths, cancelToken, tree, progress) => {
    if (!tree) tree = readBranchTree(conf, cancelToken);
    progress = normalizeProgress(progress);
    let files = [];
    let pathFilter = null;

    if (paths) {
        pathFilter = {};
        for (let p of paths) pathFilter[p] = true;
    }

    for (let item of tree.tree) {
        checkCancelled(cancelToken);
        if (item.type !== 'blob') continue;
        if (item.path === 'meta/sync.json') continue;
        if (!syncedDataPath(item.path)) continue;
        if (pathFilter && !pathFilter[item.path]) continue;
        let blob = fetchBlob(conf, item.sha);
        checkCancelled(cancelToken);
        files.push({
            path: item.path,
            data: decodeBlobContent(blob)
        });
        progress.current++;
        progressCall(progress, progress.current, progress.total, item.path);
    }

    checkCancelled(cancelToken);
    return files;
};

exports.readRemoteMeta = (conf, cancelToken) => {
    let tree = readBranchTree(conf, cancelToken);
    let item = findTreeBlob(tree, 'meta/sync.json');
    if (item) return JSON.parse(readTextBlob(conf, item.sha, cancelToken));
    return null;
};
