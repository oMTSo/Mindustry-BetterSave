// 玩家档案对话框：管理多个本地玩家档案并执行切换。
const listView = require("bettersave/ui/tools/listView");
const inputDialog = require("bettersave/ui/tools/input");
const player = require("bettersave/core/player");

var playerDialog = null;

exports.init = () => {
    playerDialog = listView.init();
    playerDialog.setTitle("@multiplayer.title");

    player.init();
    inputDialog.init();

    playerDialog.button("@multiplayer.addPlayer", Icon.add, () => {
        inputDialog.begin(Core.bundle.get('multiplayer.newPlayerName'), '', Core.bundle.get('multiplayer.newPlayerName'), (v) => {
            if (v.trim().length == 0) {
                Vars.ui.showOkText('@error', '@multiplayer.nameCanNotBeEmpty', () => { });
                return;
            }
            player.add(v);
            playerDialog.rebuild();
        });
    }).size(210, 64);

    playerDialog.shown(playerDialog.rebuild);

    playerDialog.rebuilt(() => {
        let lst = player.read();
        let current = player.current();

        playerDialog.listCase("[accent]" + current.name, "[lightgray]" + Core.bundle.get('multiplayer.currentPlayer'), Icon.players, () => { }, [
            {
                icon: Icon.pencil,
                clicked: () => {
                    inputDialog.begin(Core.bundle.get('multiplayer.playerName'), current.name, Core.bundle.get('multiplayer.playerName'), (v) => {
                        if (v.trim().length == 0) {
                            Vars.ui.showOkText('@error', '@multiplayer.nameCanNotBeEmpty', () => { });
                            return;
                        }
                        try {
                            current.rename(v);
                            playerDialog.rebuild();
                        } catch (e) {
                            print(e);
                            Vars.ui.showOkText('@error', Core.bundle.get('multiplayer.renameFail') + e.toString(), () => { });
                        }
                    });
                }
            }
        ]);

        playerDialog.listLine();

        if (lst.length <= 1) {
            playerDialog.text("@multiplayer.noAnyOtherPlayer").color(Packages.arc.graphics.Color.lightGray).pad(4);
        } else {
            for (let oo of lst) {
                let o = oo;
                if (o.name == current.name) continue;
                playerDialog.listCase("[accent]" + o.name, '', Icon.players, () => { }, [
                    {
                        icon: Icon.upOpen,
                        clicked: () => {
                            Vars.ui.showConfirm("@multiplayer.switchPlayer", Core.bundle.format('multiplayer.switchPlayerComfirm', o.name), () => {
                                Vars.ui.loadAnd("@multiplayer.switchingPlayer", () => {
                                    o.switchTo();
                                    playerDialog.rebuild();
                                    Vars.ui.showInfoFade("@multiplayer.switchedToPlayer");
                                });
                            });
                        }
                    },
                    {
                        icon: Icon.pencil,
                        clicked: () => {
                            inputDialog.begin(Core.bundle.get('multiplayer.playerName'), o.name, Core.bundle.get('multiplayer.playerName'), (v) => {
                                if (v.trim().length == 0) {
                                    Vars.ui.showOkText('@error', '@multiplayer.nameCanNotBeEmpty', () => { });
                                    return;
                                }
                                try {
                                    o.rename(v);
                                    playerDialog.rebuild();
                                } catch (e) {
                                    print(e);
                                    Vars.ui.showOkText('@error', Core.bundle.get('multiplayer.renameFail') + e.toString(), () => { });
                                }
                            });
                        }
                    },
                    {
                        icon: Icon.trash,
                        clicked: () => {
                            Vars.ui.showConfirm("@multiplayer.deletePlayer", Core.bundle.format('multiplayer.deletePlayerComfirm', o.name), () => {
                                o.remove();
                                playerDialog.rebuild();
                                Vars.ui.showInfoFade("@multiplayer.deletedPlayer");
                            });
                        }
                    }
                ]);
            }
        }

    });

    exports.dialog = playerDialog;
};

exports.dialog = playerDialog;
