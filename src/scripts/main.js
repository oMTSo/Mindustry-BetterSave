const version = require('betterSave/version');
const ui = require('betterSave/game/ui');

print('BetterSave v' + version.major + '.' + version.minor + '.' + version.bugFix);

Events.on(ClientLoadEvent, () => {
    Time.run(10, () => {
        ui.register();
    });
});
