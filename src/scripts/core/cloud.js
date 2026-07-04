const config = require('bettersave/core/config');
const http = require('bettersave/tools/http');
const save = require('bettersave/core/save');
const types = require('bettersave/tools/type');
const fs = require('bettersave/tools/file');

var limit = {
    maxPayloadSize: 52428800, // 50MB
    maxNameSize: 512
};

var conf = {
    token: '',
    owner: '',
    repo: '',
    branch: 'main',
    enable: false,
    provider: 'github',
    lastSaveTime: ''
};

// Map<Path, SHA>
var repoCache = {};

function getRequestMeta(path, method, extraParams) {
    let isGb = (conf.provider !== 'gitee'); // Default to github
    let baseUrl = isGb ? "https://api.github.com" : "https://gitee.com/api/v5";

    // Path handling
    let fullUrl = baseUrl + "/repos/" + conf.owner + "/" + conf.repo + path;

    let headers = {};
    if (isGb) {
        headers['Authorization'] = "Bearer " + conf.token;
        headers['Accept'] = "application/vnd.github.v3+json";
        headers['Content-Type'] = "application/json";
    } else {
        // Gitee: access_token in param
        let sep = fullUrl.includes('?') ? '&' : '?';
        fullUrl += sep + "access_token=" + conf.token;
        headers['Content-Type'] = 'application/json;charset=UTF-8';
    }

    // Add extra params (like ref/branch)
    if (extraParams) {
        for (let k in extraParams) {
            let sep = fullUrl.includes('?') ? '&' : '?';
            fullUrl += sep + k + "=" + extraParams[k];
        }
    }

    return { url: fullUrl, headers: headers };
}

function readConfig() {
    conf = {
        token: '',
        owner: '',
        repo: '',
        branch: 'main',
        enable: false,
        provider: 'github', // 'github' or 'gitee'
        lastSaveTime: ''
    };
    conf = Object.assign(conf, config.readConfig('cloudsave'));
}

function writeConfig() {
    config.writeConfig('cloudsave', conf);
}

exports.init = (doUpdateLimit) => {
    if (!config.isInited()) config.init();
    save.init();
    readConfig();
    // No fetchRepoInfo here to avoid startup lag
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
    if (typeof obj == 'undefined') obj = conf;
    // Test connection by fetching repo info
    try {
        let meta = getRequestMeta("", "GET");
        let res = http.get(meta.url, meta.headers);
        if (res.code === 200) {
            return true;
        }
        print("GitHub Test Failed: " + res.code + " " + JSON.stringify(res.body));
        return false;
    } catch (e) {
        print(e);
        return false;
    }
};

exports.updateLimit = () => {
    try {
        readConfig();
        let meta = getRequestMeta("/rate_limit", "GET");
        let res = http.get(meta.url, meta.headers);
        if (res.code === 200) {
            return JSON.parse(types.toString(res.body));
        }
    } catch (e) { }
    return null;
};

// --- Core 1: Fetch Repo Info ---
function fetchRepoInfo() {
    print("Fetching cloud repository info...");
    repoCache = {};

    function fetchRecursive(path) {
        let meta = getRequestMeta("/contents/" + path, "GET", { ref: conf.branch });
        let res = http.get(meta.url, meta.headers); // Let it throw if network fails

        if (res.code === 404) return; // Empty repo or path not found is acceptable
        if (res.code !== 200) {
            throw new Error("Failed to fetch repo info: " + res.code);
        }

        let items = JSON.parse(types.toString(res.body));
        if (!Array.isArray(items)) items = [items];

        for (let item of items) {
            if (item.path.includes("..") || item.path.startsWith("/")) continue;

            if (item.type === "dir") {
                fetchRecursive(item.path);
            } else if (item.type === "file") {
                repoCache[item.path] = item.sha;
            }
        }
    }

    fetchRecursive("");
    print("Fetch complete. Found " + Object.keys(repoCache).length + " files.");
}

// --- Helper: Delete Remote File ---
function deleteFile(path) {
    let sha = repoCache[path];
    if (!sha) return;

    let bodyObj = {
        message: "Delete " + path + " via bettersave",
        sha: sha,
        branch: conf.branch
    };

    let meta = getRequestMeta("/contents/" + path, "DELETE");
    let res = http.del(meta.url, meta.headers, new java.lang.String(JSON.stringify(bodyObj)).getBytes("UTF-8"));

    // Strict Error Handling: Throw on failure
    if (res.code !== 200 && res.code !== 204) {
        throw new Error("Failed to delete " + path + ": " + res.code);
    }

    print("Deleted remote: " + path);
    delete repoCache[path];
}

// --- Helper: Upload File ---
function uploadFile(relativePath, contentBytes) {
    let sha = repoCache[relativePath] || null;

    // Atomic / Immutable Check:
    // If file exists (SHA matches), SKIP IT.
    // Exception: config/player.json is mutable and MUST be overwritten.
    if (sha && relativePath !== "config/player.json") {
        print("Skipping existing file (Atomic): " + relativePath);
        return;
    }

    let base64Content = new java.lang.String(java.util.Base64.getEncoder().encode(contentBytes));

    let bodyObj = {
        message: "Sync " + relativePath,
        content: base64Content.toString(),
        branch: conf.branch
    };
    if (sha) bodyObj.sha = sha;

    let putMeta = getRequestMeta("/contents/" + relativePath, "PUT");
    let putRes = http.put(putMeta.url, putMeta.headers, new java.lang.String(JSON.stringify(bodyObj)).getBytes("UTF-8"));

    // Strict Error Handling
    if (putRes.code !== 200 && putRes.code !== 201) {
        throw new Error("Upload failed for " + relativePath + ": " + putRes.code);
    }
    print("Uploaded: " + relativePath);
}

// --- Core 2: Upload Saves (Local -> Remote) ---
exports.uploadSaves = () => {
    readConfig();
    if (!exports.isEnable()) return;

    // No try-catch here - let UI catch it to show error dialog
    fetchRepoInfo();

    // 1. Force Sync Config
    let playerConfPath = config.configDir + "/player.json";
    if (fs.pathExist(playerConfPath)) {
        uploadFile("config/player.json", fs.readFile(playerConfPath));
    }

    // 2. Sync Saves & Players
    let visitedRemotePaths = ["config/player.json"];

    let saves = save.readAll();
    for (let s of saves) {
        let rel = "saves/" + s.save.name;
        uploadFile(rel, s.save.data);
        visitedRemotePaths.push(rel);
    }

    let players = save.readAllPlayers();
    for (let p of players) {
        let rel = "players/" + p.save.name;
        uploadFile(rel, p.save.data);
        visitedRemotePaths.push(rel);
    }

    // 3. Delete Unknown Remote Files (Mirror Sync)
    for (let remotePath in repoCache) {
        if (remotePath.startsWith("saves/") || remotePath.startsWith("players/")) {
            if (visitedRemotePaths.indexOf(remotePath) === -1) {
                deleteFile(remotePath);
            }
        }
    }

    conf.lastSaveTime = new Date().toISOString();
    writeConfig();
    print("Upload Sync Complete.");
};

// --- Core 3: Download Saves (Remote -> Local) ---
exports.downloadSaves = () => {
    readConfig();
    if (!exports.isEnable()) return;

    // No try-catch - let UI handle errors
    fetchRepoInfo();

    let visitedLocalPaths = [];

    function downloadAndWrite(remotePath, localAbsPath, forceOverwrite) {
        // Atomic Check for Local Files (unless forceOverwrite is true)
        if (!forceOverwrite && fs.pathExist(localAbsPath)) {
            print("Skipping existing local (Atomic): " + remotePath);
            visitedLocalPaths.push(localAbsPath);
            return;
        }

        let meta = getRequestMeta("/contents/" + remotePath, "GET", { ref: conf.branch });
        let res = http.get(meta.url, meta.headers);

        if (res.code !== 200) {
            throw new Error("Failed to download " + remotePath + ": " + res.code);
        }

        let json = JSON.parse(types.toString(res.body));
        let content = java.util.Base64.getMimeDecoder().decode(json.content.replace(/\n/g, ""));

        let parent = localAbsPath.substring(0, localAbsPath.lastIndexOf("/"));
        if (!fs.pathExist(parent)) fs.mkdir(parent);

        fs.writeFile(localAbsPath, content);
        print("Downloaded: " + remotePath);
        visitedLocalPaths.push(localAbsPath);
    }

    // 1. Force Sync Config (Always Overwrite)
    if (repoCache["config/player.json"]) {
        downloadAndWrite("config/player.json", config.configDir + "/player.json", true);
    }

    // 2. Download Saves & Players (Atomic: Skip existing)
    for (let remotePath in repoCache) {
        if (remotePath.startsWith("saves/")) {
            downloadAndWrite(remotePath, config.saveDir + "/" + remotePath.substring(6), false);
        } else if (remotePath.startsWith("players/")) {
            downloadAndWrite(remotePath, config.playerDir + "/" + remotePath.substring(8), false);
        }
    }

    // 3. Delete Unknown Local Files (Mirror Sync)
    // Saves
    let localSaves = fs.readDir(config.saveDir);
    for (let f of localSaves) {
        let abs = config.saveDir + "/" + f;
        if (visitedLocalPaths.indexOf(abs) === -1) {
            fs.removeFile(abs);
            print("Deleted local: " + f);
        }
    }
    // Players
    let localPlayers = fs.readDir(config.playerDir);
    for (let f of localPlayers) {
        let abs = config.playerDir + "/" + f;
        if (visitedLocalPaths.indexOf(abs) === -1) {
            fs.removeFile(abs);
            print("Deleted local: " + f);
        }
    }

    // No save.init() as requested
    print("Download Sync Complete.");
};

// --- Core 4: Clear Cloud ---
exports.clearCloud = () => {
    readConfig();
    if (!exports.isEnable()) return;

    // No try-catch - let UI handle errors
    fetchRepoInfo();

    for (let remotePath in repoCache) {
        if (remotePath.startsWith("saves/") ||
            remotePath.startsWith("players/") ||
            remotePath.startsWith("config/")) {
            deleteFile(remotePath);
        }
    }

    conf.lastSaveTime = "";
    writeConfig();
    print("Cloud Clear Complete.");
};

// Compatibility for UI calls (interface adapter)
exports.writeSave = exports.uploadSaves;
exports.removeSave = exports.clearCloud;
exports.getSave = () => {
    return {
        readFiles: () => { exports.downloadSaves(); },
        apply: () => { }
    };
};