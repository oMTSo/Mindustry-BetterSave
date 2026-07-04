
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
    
    // listen for CampaignQuit
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
            //print(sector);
            sector.save = null;
            sector.loadInfo();
        }
    }
    
    Vars.control.saves.load();
    
    Vars.ui.research.lastNode = null;
    Vars.ui.research.rebuildTree(Packages.mindustry.content.TechTree.roots.items[0]);
    
};

/*
// old version of reloadSave
// now is removed as it leads to several problems

exports.reloadSave = ()=>{
    
    // remove all techTree nodes
    while (Packages.mindustry.content.TechTree.roots.size>0) Packages.mindustry.content.TechTree.roots.pop();
    while (Packages.mindustry.content.TechTree.all.size>0) Packages.mindustry.content.TechTree.all.pop();
    
    // reload all content
    Vars.content = new Packages.mindustry.core.ContentLoader();
    Vars.content.createBaseContent();
    Vars.content.loadColors();
    Vars.content.createModContent();
    
    // reload schematics (known that the game may crash if schematics show its errorTexture when handling an error schematic)
    Vars.schematics = new Packages.mindustry.game.Schematics();
    Vars.schematics.load();
    
    // init all content
    Vars.content.init();
    Vars.content.load();
    Vars.bases.load();
    
    // reload saves
    Vars.control.saves.load();
    
    // update planet dialog's plant vars
    Vars.ui.planet.state.planet = Packages.mindustry.content.Planets.serpulo;
    
    // rebuild research dialog
    Vars.ui.research.lastNode = null;
    Vars.ui.research.rebuildTree(Packages.mindustry.content.TechTree.roots.items[0]);
    
};
*/