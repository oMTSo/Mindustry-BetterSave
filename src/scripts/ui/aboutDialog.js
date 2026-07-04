// 关于对话框：展示模组版本、描述和图标信息。
const version = require('bettersave/tools/version');
const myIcons = require('bettersave/ui/tools/icons');

let aboutDialog = null;

function makeColor(txt, color) {
    let ret = [];
    txt.split('\n').forEach(c => {
        ret.push(color + c);
    });
    return ret.join('\n');
}

exports.init = () => {
    aboutDialog = new Packages.mindustry.ui.dialogs.BaseDialog('@about.title');
    myIcons.init();

    aboutDialog.addCloseButton();

    let rebuild = () => {
        aboutDialog.cont.clear();

        let img = new Packages.mindustry.ui.BorderImage();
        img.setDrawable(Icon.icons.get("mainIcon"));
        img.border(Packages.mindustry.graphics.Pal.accent);
        aboutDialog.cont.add(img).size(102);

        aboutDialog.cont.row();

        aboutDialog.cont.add('[accent]bettersave');
        aboutDialog.cont.row();
        aboutDialog.cont.add('@about.version');
        aboutDialog.cont.row();
        aboutDialog.cont.add('[lightgray]' + version.major.toString() + '.' + version.minor.toString() + '.' + version.bugFix.toString());
        aboutDialog.cont.row();
        aboutDialog.cont.add('@about.description');
        aboutDialog.cont.row();
        aboutDialog.cont.add('[lightgray]' + version.description).wrap().center().width(Math.min(Core.graphics.getWidth() - 40, 600));
    };

    aboutDialog.shown(rebuild);
    rebuild();

    exports.dialog = aboutDialog;
};

exports.dialog = aboutDialog;
