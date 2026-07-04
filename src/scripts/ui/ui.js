
const mainDialog = require('bettersave/ui/mainDialog');
const playerDialog = require('bettersave/ui/playerDialog');
const cloudSettingDialog = require('bettersave/ui/cloudSettingDialog');
const aboutDialog = require('bettersave/ui/aboutDialog');

exports.register = () => {
    mainDialog.init();
    playerDialog.init();
    aboutDialog.init();
    cloudSettingDialog.init();

    Vars.ui.settings.addCategory('@main.title', Icon.download, (t) => {
        t.table(Tex.button, tt => {
            tt.defaults().size(280, 60).left();
            let style = Styles.flatt;

            tt.button('@menu.saveMgr', Icon.save, style, () => {
                mainDialog.dialog.show();
            }).marginLeft(4);

            tt.row();

            tt.button('@menu.multiplayer', Icon.players, style, () => {
                playerDialog.dialog.show();
            }).marginLeft(4);

            tt.row();

            tt.button('@cloudConfig.title', Icon.host, style, () => {
                cloudSettingDialog.dialog.show();
            }).marginLeft(4);

            tt.row();

            tt.button('@menu.about', Icon.info, style, () => {
                aboutDialog.dialog.show();
            }).marginLeft(4);
        });
    });
};

exports.button = (parent, f, style, listener) => {
    let b = new Packages.arc.scene.ui.Button(style);
    b.clearChildren();
    b.clicked(listener);
    f(b);
    return parent.add(b);
};

exports.table = (parent, f) => {
    let t = new Packages.arc.scene.ui.layout.Table();
    t.clearChildren();
    f(t);
    return parent.add(t);
};

var multiplayerUiRegistered = false;
var currentPlayer = Core.bundle.get("multiplayer.defaultPlayer");

exports.setupMultiplayer = (player) => {
    if (!multiplayerUiRegistered) {
        Vars.ui.planet.shown(() => {
            Time.run(10, () => {
                Vars.ui.showInfoFade(Core.bundle.get("multiplayer.currentPlayer") + ': ' + currentPlayer);
            });
        });
        multiplayerUiRegistered = true;
    }
    currentPlayer = player;
};