const setting = require('bettersave/core/setting');

var tree = {};

function loadPlanet() {
    var lst = Vars.content.planets();
    for (let i = 0; i < lst.size; i++) {
        var o = lst.items[i];
        if (typeof o == 'undefined') continue;
        tree[o.name] = {
            name: o.localizedName,
            content: {}
        };
    }
}

exports.init = () => {
    loadPlanet();
    let lst = Vars.content.sectors();
    for (let i = 0; i < lst.size; i++) {
        let o = lst.items[i];
        if (typeof o == 'undefined') continue;
        if (typeof tree[o.planet.name] == 'undefined') {
            tree[o.planet.name] = {
                name: o.planet.name,
                content: {}
            };
        }
        tree[o.planet.name].content[o.sector.id] = {
            name: o.localizedName,
            rawName: o.name
        };
    }
};

exports.resolveName = (filename) => {
    if (filename.endsWith('.msav')) filename = filename.slice(0, filename.length - 5);
    if (filename.endsWith('-backup')) {
        let r = exports.resolveName(filename.slice(0, filename.length - 7));
        r.backup = true;
        r.displayName += ' ' + Core.bundle.get('map.backup');
        return r;
    }
    if (!filename.startsWith('sector-')) {
        return {
            custom: true,
            displayName: Core.bundle.get('map.custom') + ' ' + setting.read("save-" + filename + "-name", Core.bundle.get('map.untitled')),
            name: setting.read("save-" + filename + "-name", Core.bundle.get('map.untitled')),
            id: 0,
            planet: '',
            backup: false,
            file: filename + '.msav'
        };
    }
    let n = filename.slice(7).split('-');
    let sectorId = n.pop();
    let rawPlanetName = n.join('-');
    if (typeof tree[rawPlanetName] == 'undefined') {
        tree[rawPlanetName] = {
            name: rawPlanetName,
            content: {}
        };
    }
    let planetName = (typeof tree[rawPlanetName] == 'undefined') ? rawPlanetName : tree[rawPlanetName].name;
    let sectorName = '';
    if (typeof tree[rawPlanetName] != 'undefined') {
        let o = tree[rawPlanetName].content[parseInt(sectorId)];
        if (typeof o != 'undefined') sectorName = o.name;
    }
    return {
        custom: false,
        displayName: String(planetName + ' ' + Core.bundle.get('map.sector') + sectorId + ' ' + sectorName).trim(),
        name: sectorName,
        id: parseInt(sectorId),
        planet: planetName,
        backup: false,
        file: filename + '.msav'
    };
};

exports.planets = () => {
    let o = [];
    Object.keys(tree).forEach(p => {
        o.push(tree[p].name);
    });
    return o;
};