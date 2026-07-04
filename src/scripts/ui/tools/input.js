// 通用输入对话框：向用户收集一段文本并回调给调用方。
var inputDialog = null;

var currentValue = '';
var currentCb = ()=>{};

exports.dialog = inputDialog;

exports.init = ()=>{
    inputDialog = new Packages.mindustry.ui.dialogs.BaseDialog('@input.title');
    exports.dialog = inputDialog;
    inputDialog.buttons.clear();
    inputDialog.buttons.defaults().size(240, 64);
    inputDialog.buttons.button("@cancel", Icon.cancel, ()=>{
        inputDialog.hide();
    });
    inputDialog.buttons.button("@ok", Icon.ok, ()=>{
        inputDialog.hide();
        currentCb(currentValue);
    });
    inputDialog.addCloseListener();
};

exports.begin = (title,value,tips,cb)=>{
    inputDialog.title.setText(Core.bundle.get('input.title')+' '+title);
    inputDialog.cont.clear();
    currentValue = value;
    currentCb = cb;
    let t = inputDialog.cont.field(value,{
        get: (v)=>{
            currentValue = v;
        }
    }).size(400, 55).maxTextLength(2048).get();
    t.setMessageText(tips);
    inputDialog.show();
};
