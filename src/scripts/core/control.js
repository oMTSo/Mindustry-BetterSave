// 游戏控制工具：封装保存当前地图、关闭地图、监听退出和重载存档状态。
var campaignQuitListener = [];

exports.isInMap = ()=>{
    return Vars.control.saves.getCurrent()!=null;
};

exports.isNetClient = ()=>{
    return Vars.net.client();
};

exports.saveCurrentMap = (showUI)=>{
    let ret = true;
    if (showUI==undefined) showUI=false;
    let f = ()=>{
        try{
            Vars.control.saves.getCurrent().save();
        }catch(e){
            print(e);
            ret = false;
            if (showUI) Vars.ui.showException("[accent]" + Core.bundle.get("savefail"), e);
        }
    };
    if (Vars.net.client()) return ret;
    if (!exports.isInMap()) return ret;
    if (showUI){
        Vars.ui.loadAnd("@saving", f);
    }else{
        f();
    }
    return ret;
};

exports.closeCurrentMap = (save,showUI)=>{
    if (showUI==undefined) showUI=false;
    if (save==undefined) save=true;
    if (Vars.net.client()) return;
    if (!exports.isInMap()) return;
    if (save) exports.saveCurrentMap(showUI);
    Vars.logic.reset();
};

exports.onCampaignQuit = (listener)=>{
    campaignQuitListener.push(listener);
};

exports.listen = ()=>{
    
    let inCampaign = false;
    let playingToMenu = false;
    Events.on(StateChangeEvent,(e)=>{
        inCampaign = Vars.state.isCampaign();
        if (e.from==Packages.mindustry.core.GameState.State.playing && e.to==Packages.mindustry.core.GameState.State.menu){
            playingToMenu = true;
        }else{
            playingToMenu = false;
        }
    });
    Events.on(ResetEvent,()=>{
        Time.run(25,()=>{
            if (!inCampaign && playingToMenu){
                for (let listener of campaignQuitListener) listener();
            }
        });
    });

};

exports.reloadSave = ()=>{

    let lst = Vars.content.getContentMap();
    lst.forEach(lst=>{
        for (let i=0;i<lst.size;i++){
            let item = lst.items[i];
            if (typeof item.alwaysUnlocked == 'undefined') continue;
            if (Packages.arc.Core.settings.getBool(item.name + "-unlocked", false)){
                item.quietUnlock();
            }else{
                item.clearUnlock();
            }
        }
    });
    
    Vars.schematics = new Packages.mindustry.game.Schematics();
    Vars.schematics.load();
    
    lst = Packages.mindustry.content.TechTree.all;
    for (let i=0;i<lst.size;i++){
        let node = lst.items[i];
        node.setupRequirements(node.requirements);
    }
    
    lst = Vars.content.planets();
    for (let i=0;i<lst.size;i++){
        let planet = lst.items[i];
        print(planet);
        let slst = planet.sectors;
        for (let ii=0;ii<slst.size;ii++){
            let sector = slst.items[ii];
            sector.save = null;
            sector.loadInfo();
        }
    }
    
    Vars.control.saves.load();
    
    Vars.ui.research.lastNode = null;
    Vars.ui.research.rebuildTree(Packages.mindustry.content.TechTree.roots.items[0]);
    
};
