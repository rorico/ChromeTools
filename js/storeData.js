var storeData;
var getData;
(function() {
    var suf = "s";
    var indexSuf = "Indexes";
    var metaSuf = "Meta";
    storeData = function(name,data) {
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
                moveData(name,info,data);
            } else {
                info.push(data);
                var setObj = {};
                setObj[storeName] = info;
                set(setObj,null,function(message) {
                    //if total data is too large, move things into local storage
                    //would like to change the way this is done, but this seems alright
                    if (message === "QUOTA_BYTES quota exceeded") {
                        moveData(name,info,data);
                    }
                });
            }
        });
    };

    getData = function(name,callback) {
        var indexName = name + indexSuf;
        var metaName = name + metaSuf;
        get([indexName,metaName], function(item) {
            var indexes = item[indexName] || [];
            var metaData = item[metaName] || {};
            if (metaData.sync) {
                indexes = indexes.slice(metaData.sync[0],metaData.sync[1]);
            }
            indexes.push(name + suf);
            get(indexes, callback);
        });
    };

    function moveData(name,info,data) {
        var indexName = name + indexSuf;
        var metaName = name + metaSuf;
        get([indexName,metaName], function(items) {
            var indexes = items[indexName] || [];
            var metaData = items[metaName] || {};

            var store = function() {
                var dataName = name + "_" + indexes.length;
                indexes.push(dataName);
                var setObj = {indexes:indexes};
                setObj[indexName] = indexes;
                setObj[name + suf] = [];
                setObj[dataName] = info;
                setObj[metaName] = metaData;
                set(setObj);
                storeData(name,data);
            };

            //move older things to localStorage - unlimited storage
            //hold [start,end] values, end is 1 more than largest
            if (!metaData.sync) {
                metaData.sync = [0,indexes.length];
            }
            metaData.sync[1]++;
            //limit to 5 blocks of data
            var overflow = metaData.sync[1] - metaData.sync[0] - 3;

            if (overflow > 0) {
                if (!metaData.local) {
                    metaData.local = [0,0];
                }
                metaData.local[1] += overflow;
                var removeIndexes = indexes.slice(metaData.sync[0],metaData.sync[0] + overflow);
                metaData.sync[0] += overflow;
                get(removeIndexes, function(removedItems) {
                    setLocal(removedItems);
                    //store after to free up space first
                    remove(removeIndexes,store);
                });
            } else {
                store();
            }
        });
    }

    function set(obj,callback,onerror) {
        chrome.storage.sync.set(obj,function() {
            if (!storageError(onerror) && typeof callback === "function") {
                callback();
            }
        });
    }

    function setLocal(obj,callback,onerror) {
        chrome.storage.local.set(obj,function() {
            if (!storageError(onerror) && typeof callback === "function") {
                callback();
            }
        });
    }

    function get(list,callback,onerror) {
        chrome.storage.sync.get(list, function(items) {
            if (!storageError(onerror) && typeof callback === "function") {
                callback(items);
            }
        });
    }

    function remove(list,callback,onerror) {
        chrome.storage.sync.remove(list,function() {
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