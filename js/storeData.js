var storeData;
var getData;
(function() {
    var throttled = 5;
    var suf = "s";
    var metaSuf = "Meta";
    storeData = function(name, data) {
        var storeName = name + suf;
        get(storeName, function(items) {
            var info = items[storeName] || [];
            //approximately the max size per item, slightly smaller
            //for some reason the limit is around 7700 instead of 8192, be much lower to be sure
            //can check getBytesInUse, but seems unnecessary
            var limit = 7000;
            //if the new entry is larger than it can possibly be stored, shouldn't ever happen
            //to make sure we don't get into an infinite loop
            if (JSON.stringify(data).length > limit) {
                log("can't store the following, too large:");
                log(data);
            } else if (JSON.stringify(info).length + JSON.stringify(data).length > limit) {
                moveData(name, info, () => {
                    // call self again
                    storeData(name, data);
                });
            } else {
                info.push(data);
                var setObj = {};
                setObj[storeName] = info;
                set(setObj);
            }
        });
    };

    getData = function(name, callback, unthrottled) {
        var metaName = name + metaSuf;
        get(metaName, function(item) {
            var metaData = item[metaName] || {};
            var min = 0;
            var max = 0;
            //this really generally always happen
            if (metaData.local) {
                max = metaData.local[1];
                min = metaData.local[0];
                if (!unthrottled) {
                    min = Math.max(min, max - throttled);
                }
            }
            get(getIndexes(name, min, max), callback);
        });
    };

    function moveData(name, info, callback) {
        var metaName = name + metaSuf;
        get(metaName, function(items) {
            var metaData = items[metaName] || {};
            //move older things to localStorage - unlimited storage
            //hold [start, end] values, end is 1 more than largest
            if (!metaData.local) {
                metaData.local = [0, 0];
            }

            var next = metaData.local[1];
            metaData.local[1]++;

            var dataName = name + "_" + next;
            var setObj = {};
            setObj[name + suf] = [];
            setObj[dataName] = info;
            setObj[metaName] = metaData;
            set(setObj);
            callback();
        });
    }

    function getIndexes(name, min, max) {
        var indexes = [];
        for (var i = min ; i < max ; i++) {
            indexes.push(name + "_" + i);
        }
        indexes.push(name + suf);
        return indexes;
    }

    function set(obj, callback, onerror) {
        chrome.storage.local.set(obj, function() {
            if (!storageError(onerror) && typeof callback === "function") {
                callback();
            }
        });
    }

    function get(list, callback, onerror) {
        chrome.storage.local.get(list, function(items) {
            if (!storageError(onerror) && typeof callback === "function") {
                callback(items);
            }
        });
    }

    function remove(list, callback, onerror) {
        chrome.storage.local.remove(list, function() {
            if (!storageError(onerror) && typeof callback === "function") {
                callback();
            }
        });
    }

    function storageError(onerror) {
        if (chrome.runtime.lastError) {
            if (typeof onerror === "function") {
                onerror(chrome.runtime.lastError.message);
            }
            log(chrome.runtime.lastError.message);
            return true;
        }
        return false;
    }
})();