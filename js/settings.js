var settings = {};
var getSetting;
var updateSetting;
var updateSettings;
var onSettingLoad;
var defaults = {};
var userSettings = {};
(function() {
    var listeners = {};
    var onload = {};
    var settingName = "settings";
    setSettings();
    setTimeout(() => {
        setSettings()
    })

    function setSettings() {
        console.log('Getting Settings...')
        chrome.storage.sync.get(settingName, (items) => {
            if (chrome.runtime.lastError) {
                log(chrome.runtime.lastError);
            }
            console.log('Got Settings:', items)
            if (items.settings) {
                updateSettings(items.settings);
                updateOnLoads(items.settings);
            }
        });
    }

    onSettingChange = function(setting, onchange) {
        if (!listeners[setting]) {
            listeners[setting] = [];
        }
        listeners[setting].push(onchange);
    };

    updateSetting = function(setting, val) {
        if (settings[setting] != val) {
            updateListeners(setting, val);
            settings[setting] = val;
            storeSettings();
        }
    };

    updateSettings = function(newSettings) {
        for (var set in newSettings) {
            if (newSettings[set] !== settings[set]) {
                updateListeners(set, newSettings[set]);
            }
        }
        settings = newSettings;
        storeSettings();
        // copy array, settings will be changed later
        userSettings = JSON.parse(JSON.stringify(newSettings));
        for (var d in defaults) {
            if (settings[d] === undefined) {
                settings[d] = defaults[d][0];
            }
        }
    };

    addDefault = function(setting, val, type, display) {
        defaults[setting] = [val, type, display || setting];
        if (settings[setting] != val) {
            updateListeners(settings[setting], val);
            settings[setting] = val;
        }
    };

    onSettingLoad = function(setting, onchange) {
        if (!onload[setting]) {
            onload[setting] = [];
        }
        onload[setting].push(onchange);
    };

    function updateOnLoads(settings) {
        // since this is called after updateSettings, defaults should be loaded in
        for (var set in onload) {
            onload[set].forEach((c) => {
                c(settings[set]);
            });
        }
    };


    function updateListeners(setting, val) {
        if (listeners[setting]) {
            listeners[setting].forEach(onchange => {
                onchange(val, settings[setting]);
            });
        }
    }

    function storeSettings() {
        var obj = {};
        obj[settingName] = settings;
        chrome.storage.sync.set(obj, () => {
            if (chrome.runtime.lastError) {
                log(chrome.runtime.lastError);
            }
        });
    }

    // TODO: settings display names, type checking
})();
