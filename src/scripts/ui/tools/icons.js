// 图标注册工具：把自带贴图注册到 Mindustry 的 Icon 表中。
exports.init = () => {
    let githubRegion = Core.atlas.find("bettersave-github");
    let giteeRegion = Core.atlas.find("bettersave-gitee");
    let mainRegion = Core.atlas.find("bettersave-mainicon");
    Icon.icons.put("githubIcon", new TextureRegionDrawable(githubRegion));
    Icon.icons.put("giteeIcon", new TextureRegionDrawable(giteeRegion));
    Icon.icons.put("mainIcon", new TextureRegionDrawable(mainRegion));
};
