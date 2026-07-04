const config = require('bettersave/core/config');
const http = require('bettersave/tools/http');
const save = require('bettersave/core/save');
const types = require('bettersave/tools/type');
const fs = require('bettersave/tools/file');
const control = require('bettersave/core/control');

var conf = {
    token: '',
    owner: '',
    repo: '',
    branch: 'main',
    enable: false,
    provider: 'github',
    lastSaveTime: ''
};

const emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function readConfig() {
    conf = {
        token: '',
        owner: '',
        repo: '',
        branch: 'main',
        enable: false,
        provider: 'github',
        lastSaveTime: ''
    };
    conf = Object.assign(conf, config.readConfig('cloudsave'));
}

function writeConfig() {
    config.writeConfig('cloudsave', conf);
}

function getConfigForRequest(obj) {
    if (typeof obj == 'undefined' || obj == null) return conf;
    return Object.assign(JSON.parse(JSON.stringify(conf)), obj);
}

function encodeParam(v) {
    return encodeURIComponent(v);
}

function encodeRefName(v) {
    let parts = v.split('/');
    for (let i = 0; i < parts.length; i++) parts[i] = encodeURIComponent(parts[i]);
    return parts.join('/');
}

function getRequestMeta(path, extraParams, obj) {
    let c = getConfigForRequest(obj);
    let isGithub = (c.provider !== 'gitee');
    let baseUrl = isGithub ? 'https://api.github.com' : 'https://gitee.com/api/v5';
    let fullUrl = baseUrl + '/repos/' + encodeParam(c.owner) + '/' + encodeParam(c.repo) + path;

    let headers = {};
    if (isGithub) {
        headers['Authorization'] = 'Bearer ' + c.token;
        headers['Accept'] = 'application/vnd.github.v3+json';
        headers['Content-Type'] = 'application/json';
    } else {
        let sep = fullUrl.includes('?') ? '&' : '?';
        fullUrl += sep + 'access_token=' + encodeURIComponent(c.token);
        headers['Content-Type'] = 'application/json;charset=UTF-8';
    }

    if (extraParams) {
        for (let k in extraParams) {
            let sep = fullUrl.includes('?') ? '&' : '?';
            fullUrl += sep + encodeURIComponent(k) + '=' + encodeURIComponent(extraParams[k]);
        }
    }

    return { url: fullUrl, headers: headers };
}

function getGraphqlMeta(obj) {
    let c = getConfigForRequest(obj);
    return {
        url: 'https://api.github.com/graphql',
        headers: {
            'Authorization': 'Bearer ' + c.token,
            'Accept': 'application/vnd.github+json',
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

function ensureGithubProvider() {
    if (conf.provider === 'gitee') {
        throw new Error('Git Tree full sync currently supports GitHub only.');
    }
}

function getHeadRef() {
    let meta = getRequestMeta('/git/ref/heads/' + encodeRefName(conf.branch));
    return readJsonResponse(http.get(meta.url, meta.headers), 'Get branch ref', [200]);
}

function getCommit(sha) {
    let meta = getRequestMeta('/git/commits/' + sha);
    return readJsonResponse(http.get(meta.url, meta.headers), 'Get commit', [200]);
}

function createBlob(contentBytes) {
    let content = new java.lang.String(java.util.Base64.getEncoder().encode(contentBytes)).toString();
    let meta = getRequestMeta('/git/blobs');
    return readJsonResponse(http.post(meta.url, meta.headers, bodyBytes({
        content: content,
        encoding: 'base64'
    })), 'Create blob', [201]);
}

function createTree(entries) {
    if (entries.length == 0) return { sha: emptyTreeSha };
    let meta = getRequestMeta('/git/trees');
    return readJsonResponse(http.post(meta.url, meta.headers, bodyBytes({
        tree: entries
    })), 'Create tree', [201]);
}

function createCommit(message, treeSha, parentSha) {
    let meta = getRequestMeta('/git/commits');
    return readJsonResponse(http.post(meta.url, meta.headers, bodyBytes({
        message: message,
        tree: treeSha,
        parents: [parentSha]
    })), 'Create commit', [201]);
}

function updateBranchRef(commitSha, refNodeId) {
    if (!refNodeId) throw new Error('Missing branch ref node id.');

    let meta = getGraphqlMeta();
    let json = readJsonResponse(http.post(meta.url, meta.headers, bodyBytes({
        query: 'mutation($refId: ID!, $oid: GitObjectID!) { updateRef(input: { refId: $refId, oid: $oid, force: true }) { ref { target { oid } } } }',
        variables: {
            refId: refNodeId,
            oid: commitSha
        }
    })), 'Update branch ref', [200]);

    if (json.errors && json.errors.length > 0) {
        throw new Error('Update branch ref failed: ' + JSON.stringify(json.errors));
    }
    return json.data.updateRef.ref;
}

function fetchRecursiveTree(treeSha) {
    let meta = getRequestMeta('/git/trees/' + treeSha, { recursive: '1' });
    return readJsonResponse(http.get(meta.url, meta.headers), 'Fetch tree', [200]);
}

function fetchBlob(sha) {
    let meta = getRequestMeta('/git/blobs/' + sha);
    return readJsonResponse(http.get(meta.url, meta.headers), 'Fetch blob', [200]);
}

function isSyncedPath(path) {
    return path.startsWith('config/') || path.startsWith('saves/') || path.startsWith('players/');
}

function checkSafeRemotePath(path) {
    if (path.includes('..') || path.startsWith('/') || path.startsWith('\\')) {
        throw new Error('Unsafe remote path: ' + path);
    }
}

function shouldSkipConfigFile(fn) {
    return fn == 'cloudsave.json';
}

function sanitizePlayerData(path) {
    try {
        let obj = save.readFile(path);
        obj.readFiles();
        let files = [];
        for (let f of obj.files) {
            if (f.name == '../bettersave/config/cloudsave.json') continue;
            files.push(f);
        }
        obj.files = files;
        return obj.makeData();
    } catch (e) {
        print(e);
        return fs.readFile(path);
    }
}

function readLocalFilesInDir(dir, prefix) {
    let ret = [];
    if (!fs.pathExist(dir)) return ret;
    let lst = fs.readDir(dir);
    for (let fn of lst) {
        if (prefix == 'config' && shouldSkipConfigFile(fn)) continue;
        let abs = dir + '/' + fn;
        if (fs.isDir(abs)) continue;
        ret.push({
            path: prefix + '/' + fn,
            data: prefix == 'players' ? sanitizePlayerData(abs) : fs.readFile(abs)
        });
    }
    return ret;
}

function collectLocalSyncFiles() {
    let files = [];
    files = files.concat(readLocalFilesInDir(config.configDir, 'config'));
    files = files.concat(readLocalFilesInDir(config.saveDir, 'saves'));
    files = files.concat(readLocalFilesInDir(config.playerDir, 'players'));
    return files;
}

function writeDownloadedFile(remotePath, data) {
    checkSafeRemotePath(remotePath);

    if (remotePath.startsWith('config/')) {
        fs.writeFile(config.configDir + '/' + remotePath.substring(7), data);
    } else if (remotePath.startsWith('saves/')) {
        fs.writeFile(config.saveDir + '/' + remotePath.substring(6), data);
    } else if (remotePath.startsWith('players/')) {
        fs.writeFile(config.playerDir + '/' + remotePath.substring(8), data);
    }
}

function makeFullTreeCommit(localFiles, message) {
    ensureGithubProvider();

    let headRef = getHeadRef();
    let parentSha = headRef.object.sha;

    let entries = [];
    for (let f of localFiles) {
        checkSafeRemotePath(f.path);
        let blob = createBlob(f.data);
        entries.push({
            path: f.path,
            mode: '100644',
            type: 'blob',
            sha: blob.sha
        });
        print('Prepared cloud file: ' + f.path);
    }

    let tree = createTree(entries);
    let commit = createCommit(message, tree.sha, parentSha);
    updateBranchRef(commit.sha, headRef.node_id);
    return commit;
}

exports.init = (doUpdateLimit) => {
    if (!config.isInited()) config.init();
    save.init();
    readConfig();
};

exports.getConfig = () => {
    readConfig();
    return JSON.parse(JSON.stringify(conf));
};

exports.setConfig = (obj) => {
    conf = JSON.parse(JSON.stringify(Object.assign(conf, obj)));
    writeConfig();
};

exports.isEnable = () => {
    return (conf.token && conf.token.length > 0 &&
        conf.owner && conf.owner.length > 0 &&
        conf.repo && conf.repo.length > 0 &&
        conf.enable);
};

exports.test = (obj) => {
    try {
        let meta = getRequestMeta('', null, obj);
        let res = http.get(meta.url, meta.headers);
        if (res.code === 200) return true;
        print('Cloud test failed: ' + res.code + ' ' + types.toString(res.body));
        return false;
    } catch (e) {
        print(e);
        return false;
    }
};

exports.updateLimit = () => {
    try {
        let c = getConfigForRequest(conf);
        if (c.provider === 'gitee') return null;
        let headers = {
            'Authorization': 'Bearer ' + c.token,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };
        let res = http.get('https://api.github.com/rate_limit', headers);
        if (res.code === 200) return JSON.parse(types.toString(res.body));
    } catch (e) {
        print(e);
    }
    return null;
};

exports.uploadSaves = () => {
    readConfig();
    if (!exports.isEnable()) return;

    save.make('cloudsave').writeToSavePath();
    conf.lastSaveTime = new Date().toISOString();
    writeConfig();

    let localFiles = collectLocalSyncFiles();
    makeFullTreeCommit(localFiles, 'Full cloud sync via bettersave');
    print('Upload Sync Complete. Files: ' + localFiles.length);
};

exports.downloadSaves = () => {
    readConfig();
    if (!exports.isEnable()) return;
    ensureGithubProvider();

    let headRef = getHeadRef();
    let commit = getCommit(headRef.object.sha);
    let tree = fetchRecursiveTree(commit.tree.sha);

    let downloadedFiles = [];
    for (let item of tree.tree) {
        if (item.type !== 'blob') continue;
        if (!isSyncedPath(item.path)) continue;
        checkSafeRemotePath(item.path);

        let blob = fetchBlob(item.sha);
        let bytes = java.util.Base64.getMimeDecoder().decode(blob.content.replace(/\n/g, ''));
        downloadedFiles.push({
            path: item.path,
            data: bytes
        });
    }

    control.closeCurrentMap(false);
    fs.removeFilesInDir(config.configDir);
    fs.removeFilesInDir(config.saveDir);
    fs.removeFilesInDir(config.playerDir);

    for (let f of downloadedFiles) {
        writeDownloadedFile(f.path, f.data);
        print('Downloaded: ' + f.path);
    }

    control.reloadSave();
    print('Download Sync Complete. Files: ' + downloadedFiles.length);
};

exports.clearCloud = () => {
    readConfig();
    if (!exports.isEnable()) return;

    makeFullTreeCommit([], 'Clear cloud save via bettersave');

    conf.lastSaveTime = '';
    writeConfig();
    print('Cloud Clear Complete.');
};

exports.writeSave = exports.uploadSaves;
exports.removeSave = exports.clearCloud;
exports.getSave = () => {
    return {
        readFiles: () => { exports.downloadSaves(); },
        apply: () => { }
    };
};
