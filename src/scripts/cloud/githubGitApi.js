// GitHub Git API：使用 blob、tree、commit 和 GraphQL updateRef 实现整树覆盖。
const http = require('bettersave/tools/http');
const types = require('bettersave/tools/type');

const emptyTreeSha = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function encodeParam(v) {
    return encodeURIComponent(v);
}

function encodeRefName(v) {
    let parts = v.split('/');
    for (let i = 0; i < parts.length; i++) parts[i] = encodeURIComponent(parts[i]);
    return parts.join('/');
}

function ensureGithubProvider(conf) {
    if (conf.provider === 'gitee') {
        throw new Error('Git Tree full sync currently supports GitHub only.');
    }
}

function getRequestMeta(conf, path, extraParams) {
    let fullUrl = 'https://api.github.com/repos/' + encodeParam(conf.owner) + '/' + encodeParam(conf.repo) + path;
    let headers = {
        'Authorization': 'Bearer ' + conf.token,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };

    if (extraParams) {
        for (let k in extraParams) {
            let sep = fullUrl.includes('?') ? '&' : '?';
            fullUrl += sep + encodeURIComponent(k) + '=' + encodeURIComponent(extraParams[k]);
        }
    }

    return { url: fullUrl, headers: headers };
}

function getGraphqlMeta(conf) {
    return {
        url: 'https://api.github.com/graphql',
        headers: {
            'Authorization': 'Bearer ' + conf.token,
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

function getHeadRef(conf) {
    let meta = getRequestMeta(conf, '/git/ref/heads/' + encodeRefName(conf.branch));
    return readJsonResponse(http.get(meta.url, meta.headers), 'Get branch ref', [200]);
}

function getCommit(conf, sha) {
    let meta = getRequestMeta(conf, '/git/commits/' + sha);
    return readJsonResponse(http.get(meta.url, meta.headers), 'Get commit', [200]);
}

function createBlob(conf, contentBytes) {
    let content = new java.lang.String(java.util.Base64.getEncoder().encode(contentBytes)).toString();
    let meta = getRequestMeta(conf, '/git/blobs');
    return readJsonResponse(http.post(meta.url, meta.headers, bodyBytes({
        content: content,
        encoding: 'base64'
    })), 'Create blob', [201]);
}

function createTree(conf, entries) {
    if (entries.length == 0) return { sha: emptyTreeSha };
    let meta = getRequestMeta(conf, '/git/trees');
    return readJsonResponse(http.post(meta.url, meta.headers, bodyBytes({
        tree: entries
    })), 'Create tree', [201]);
}

function createCommit(conf, message, treeSha, parentSha) {
    let meta = getRequestMeta(conf, '/git/commits');
    return readJsonResponse(http.post(meta.url, meta.headers, bodyBytes({
        message: message,
        tree: treeSha,
        parents: [parentSha]
    })), 'Create commit', [201]);
}

function updateBranchRef(conf, commitSha, refNodeId) {
    if (!refNodeId) throw new Error('Missing branch ref node id.');

    let meta = getGraphqlMeta(conf);
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

function fetchRecursiveTree(conf, treeSha) {
    let meta = getRequestMeta(conf, '/git/trees/' + treeSha, { recursive: '1' });
    return readJsonResponse(http.get(meta.url, meta.headers), 'Fetch tree', [200]);
}

function fetchBlob(conf, sha) {
    let meta = getRequestMeta(conf, '/git/blobs/' + sha);
    return readJsonResponse(http.get(meta.url, meta.headers), 'Fetch blob', [200]);
}

function readBranchTree(conf, cancelToken) {
    ensureGithubProvider(conf);
    checkCancelled(cancelToken);
    let headRef = getHeadRef(conf);
    checkCancelled(cancelToken);
    let commit = getCommit(conf, headRef.object.sha);
    checkCancelled(cancelToken);
    if (commit.tree.sha == emptyTreeSha) return { tree: [] };
    return fetchRecursiveTree(conf, commit.tree.sha);
}

exports.testRepository = (conf) => {
    try {
        let meta = getRequestMeta(conf, '');
        let res = http.get(meta.url, meta.headers);
        if (res.code === 200) return true;
        print('Cloud test failed: ' + res.code + ' ' + types.toString(res.body));
        return false;
    } catch (e) {
        print(e);
        return false;
    }
};

exports.replaceBranchTree = (conf, localFiles, message, cancelToken) => {
    ensureGithubProvider(conf);

    checkCancelled(cancelToken);
    let headRef = getHeadRef(conf);
    let parentSha = headRef.object.sha;
    checkCancelled(cancelToken);

    let entries = [];
    for (let f of localFiles) {
        checkCancelled(cancelToken);
        let blob = createBlob(conf, f.data);
        checkCancelled(cancelToken);
        entries.push({
            path: f.path,
            mode: '100644',
            type: 'blob',
            sha: blob.sha
        });
        print('Prepared cloud file: ' + f.path);
    }

    checkCancelled(cancelToken);
    let tree = createTree(conf, entries);
    checkCancelled(cancelToken);
    let commit = createCommit(conf, message, tree.sha, parentSha);
    checkCancelled(cancelToken);
    updateBranchRef(conf, commit.sha, headRef.node_id);
    if (cancelToken && typeof cancelToken.markCommitted == 'function') cancelToken.markCommitted();
    return commit;
};

exports.readBranchFiles = (conf, cancelToken) => {
    let tree = readBranchTree(conf, cancelToken);
    let files = [];

    for (let item of tree.tree) {
        checkCancelled(cancelToken);
        if (item.type !== 'blob') continue;
        let blob = fetchBlob(conf, item.sha);
        checkCancelled(cancelToken);
        files.push({
            path: item.path,
            data: java.util.Base64.getMimeDecoder().decode(blob.content.replace(/\n/g, ''))
        });
    }

    checkCancelled(cancelToken);
    return files;
};

exports.readRemoteMeta = (conf, cancelToken) => {
    let tree = readBranchTree(conf, cancelToken);
    for (let item of tree.tree) {
        checkCancelled(cancelToken);
        if (item.type !== 'blob') continue;
        if (item.path !== 'meta/sync.json') continue;

        let blob = fetchBlob(conf, item.sha);
        checkCancelled(cancelToken);
        let text = new java.lang.String(
            java.util.Base64.getMimeDecoder().decode(blob.content.replace(/\n/g, '')),
            java.nio.charset.Charset.forName('UTF-8')
        ).toString();
        return JSON.parse(text);
    }
    return null;
};
