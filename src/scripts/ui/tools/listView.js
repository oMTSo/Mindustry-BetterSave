
const ui = require("bettersave/ui/ui");

exports.init = () => {

    let ret = {
        dialog: null,
        onRebuildFunc: () => { },
        pane: null,
        h: 110,
        w: Math.min(Core.graphics.getWidth() / Packages.arc.scene.ui.layout.Scl.scl(1.05), 520)
    };

    ret.dialog = new Packages.mindustry.ui.dialogs.BaseDialog("");
    ret.dialog.addCloseButton();

    // # methods

    ret.rebuild = () => {
        if (ret.dialog == null) return;

        ret.h = 110;
        ret.w = Math.min(Core.graphics.getWidth() / Packages.arc.scene.ui.layout.Scl.scl(1.05), 520);

        ret.dialog.cont.clear();
        ret.dialog.cont.defaults().width(Math.min(Core.graphics.getWidth() / Packages.arc.scene.ui.layout.Scl.scl(0.9), 556)).pad(4);

        ret.dialog.cont.row();

        ret.dialog.cont.pane((p) => {
            p.clear();
            ret.pane = p;
        });

        ret.onRebuildFunc();
    };

    ret.show = () => {
        if (ret.dialog == null) return;
        ret.dialog.show();
    };

    ret.hide = () => {
        if (ret.dialog == null) return;
        ret.dialog.hide();
    };

    ret.setTitle = (txt) => {
        if (ret.dialog == null) return;
        ret.dialog.title.setText(txt);
    };

    // # add content

    ret.button = (txt, icon, f) => {
        if (ret.dialog == null) return;
        return ret.dialog.buttons.button(txt, icon, f);
    };

    // title:string, txt:string, icon:Icon, clicked:function, iconGroup:[{icon:Icon,clicked:function}]
    ret.listCase = (title, txt, icon, clicked, iconGroup) => {
        if (ret.pane == null) return;
        ui.button(ret.pane, (b) => {
            b.top().left();
            b.margin(12);
            b.defaults().left().top();
            ui.table(b, (t) => {
                t.left();
                let img = new Packages.mindustry.ui.BorderImage();
                img.setDrawable(icon);
                img.border(Packages.mindustry.graphics.Pal.accent);
                t.add(img).size(ret.h - 8).padTop(-8).padLeft(-8).padRight(8);
                ui.table(t, (txtTable) => {
                    txtTable.add(title + '\n\n' + txt).wrap().top().width(300).left();
                    txtTable.row();
                }).top().growX();
                t.add().growX();
            }).growX().growY().left();
            ui.table(b, (rt) => {
                rt.right();
                iconGroup.forEach(ic => {
                    rt.button(ic.icon, Packages.mindustry.ui.Styles.clearNonei, ic.clicked).size(50);
                });
            }).growX().right().padRight(-8).padTop(-8);
        }, Packages.mindustry.ui.Styles.flatBordert, clicked).size(ret.w, ret.h).growX().pad(4);
        ret.pane.row();
    };

    ret.listLine = () => {
        if (ret.pane == null) return;
        ret.pane.image().growX().height(4).pad(6).color(Packages.mindustry.graphics.Pal.gray).row();
    };

    ret.text = (txt) => {
        if (ret.pane == null) return;
        let o = ret.pane.add(txt);
        ret.pane.row();
        return o;
    };

    // # add listener

    ret.rebuilt = (f) => {
        ret.onRebuildFunc = f;
    };

    ret.hidden = (f) => {
        if (ret.dialog == null) return;
        ret.dialog.hidden(f);
    };

    ret.shown = (f) => {
        if (ret.dialog == null) return;
        ret.dialog.shown(f);
    };

    return ret;
};