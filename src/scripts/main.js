const version = require('bettersave/version');
const ui = require('bettersave/game/ui');

print('BetterSave v' + version.major + '.' + version.minor + '.' + version.bugFix);

Events.on(ClientLoadEvent, () => {
    Time.run(10, () => {
        ui.register();
    });
});
