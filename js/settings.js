var settings = {};
var getSetting;
var updateSetting;
var updateSettings;
var defaults = {};
var userSettings = {};
(function() {
    var listeners = {};
    var settingName = "settings";
    setSettings();

    function setSettings() {
        chrome.storage.sync.get(settingName, (items) => {
            if (chrome.runtime.lastError) {
                log(chrome.runtime.lastError);
            }
            if (items.settings) {
                updateSettings(item.settings);
            }
        });
    }

    getSetting = function(setting, onchange) {
        if (!listeners[setting]) {
            listeners[setting] = [];
        }
        listeners[setting].push(onchange);
        onchange(settings[setting]);
    }

    updateSetting = function(setting, val) {
        if (settings[setting] != val) {
            settings[setting] = val;
            updateListeners(settings[setting], val);
            chome.storage.sync.set(settingName, settings, () => {
                if (chrome.runtime.lastError) {
                    log(chrome.runtime.lastError);
                }
            });
        }
    }

    updateSettings = function(newSettings) {
        for (var set in newSettings) {
            if (newSettings[set] !== settings[set]) {
                updateListeners(set,newSettings[set]);
            }
        }
        settings = newSettings;
        // copy array, settings will be changed later
        userSettings = JSON.parse(JSON.stringify(newSettings));
        console.log(userSettings)
        for (var d in defaults) {
            if (!settings[d]) {
                settings[d] = defaults[d];
            }
        }
    }

    addDefault = function(setting, val) {
        defaults[setting] = val;
        if (settings[setting] != val) {
            settings[setting] = val;
            updateListeners(settings[setting], val);
        }
    }

    function updateListeners(setting, val) {
        if (listeners[setting]) {
            listeners[setting].forEach(onchange => {
                onchange(val);
            });
        }
    }

    // TODO: settings display names, type checking
})();
