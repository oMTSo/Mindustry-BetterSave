// 云同步配置：读取、保存并判断 Git 仓库同步配置是否可用。
const config = require('bettersave/core/config');

function defaultConfig() {
    return {
        token: '',
        owner: '',
        repo: '',
        branch: 'main',
        enable: false,
        provider: 'github',
        lastSaveTime: ''
    };
}

var conf = defaultConfig();

function readConfig() {
    conf = Object.assign(defaultConfig(), config.readConfig('cloudsave'));
}

function writeConfig() {
    config.writeConfig('cloudsave', conf);
}

exports.init = () => {
    if (!config.isInited()) config.init();
    readConfig();
};

exports.read = () => {
    exports.init();
    return JSON.parse(JSON.stringify(conf));
};

exports.write = (obj) => {
    exports.init();
    conf = JSON.parse(JSON.stringify(Object.assign(conf, obj)));
    writeConfig();
};

exports.isEnable = (obj) => {
    let c = obj || conf;
    return (c.token && c.token.length > 0 &&
        c.owner && c.owner.length > 0 &&
        c.repo && c.repo.length > 0 &&
        c.enable);
};

exports.updateLastSaveTime = () => {
    exports.write({ lastSaveTime: new Date().toISOString() });
};

exports.clearLastSaveTime = () => {
    exports.write({ lastSaveTime: '' });
};
