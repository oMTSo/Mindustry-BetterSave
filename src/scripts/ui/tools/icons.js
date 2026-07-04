exports.init = () => {
    let githubRegion = Core.atlas.find("bettersave-github");
    let giteeRegion = Core.atlas.find("bettersave-gitee");
    Icon.icons.put("githubIcon", new TextureRegionDrawable(githubRegion));
    Icon.icons.put("giteeIcon", new TextureRegionDrawable(giteeRegion));
};
