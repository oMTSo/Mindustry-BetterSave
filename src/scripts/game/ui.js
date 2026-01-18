
// UI 管理模块

exports.register = () => {
    // 确保在主线程执行 UI 操作
    if (!Vars.ui || !Vars.ui.settings) return;

    // 在游戏设置 -> 游戏数据 分类下添加 "BetterSave" 类别
    // 第二个参数 Icon.save 是图标，可以换成 Icon.cloud 等
    Vars.ui.settings.addCategory('@bettersave.title', Icon.download, (t) => {
        // t 是 Table 对象，用于布局

    });
};
