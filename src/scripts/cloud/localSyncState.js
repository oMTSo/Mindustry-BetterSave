// 本地同步状态：记录本地同步内容发生过增删改，用于删除类变更的冲突检测。
const config = require('bettersave/core/config');

const syncConfigName = 'sync';

function makeDeviceId() {
    return new Date().getTime().toString() + '-' + Math.floor(Math.random() * 1000000000).toString();
}

exports.markLocalChanged = () => {
    if (!config.isInited()) config.init();
    let meta = Object.assign({
        version: 2,
        updatedAt: '',
        localSyncedAt: '',
        localDirtyAt: '',
        deviceId: makeDeviceId(),
        deviceName: 'Mindustry',
        fileCount: 0,
        files: {}
    }, config.readConfig(syncConfigName));
    meta.localDirtyAt = new Date().toISOString();
    config.writeConfig(syncConfigName, meta);
};
