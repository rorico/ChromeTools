var youtubeQueue = [];

addDefault("youtubeEnabled", true, "bool");
onSettingLoad("youtubeEnabled", (e) => {
    if (!e) return;
    var scriptUrl = "/js/youtubeContent.js";

    addMessageListener({
        "youtube": function(a) {
            youtube(a.input);
        },
        "youtubeEnd": function(a, b) {
            youtubeEnd(b.tab);
        },
        "skipAd": function() {
            skipAd();
        },
        "youtubePlay": function(a) {
            youtubePlay(a.input);
        }
    });

    //inject youtube script into all youtube tabs
    //mostly for development, any tab opened after extension loaded should have it already
    youtubeTabs(function(tabs) {
        tabs.map(tab => tab.id).forEach(inject);
    }, true);

    function youtubeTabs(callback, self) {
        //get all youtube tabs that isn't the current one
        var query = {url:["*://*.youtube.com/*", "*://youtube.com/*"]};
        //if current page is blocked, add it to current list
        //defined in siteBlocker
        if (!self && !isBlocked()) {
            query.active = false;
        }
        chrome.tabs.query(query, callback);
    }

    function inject(id) {
        return new Promise((resolve, reject) => {
            chrome.tabs.executeScript(id, {file:scriptUrl}, function() {
                if (chrome.runtime.lastError) {
                    //something went wrong here, don't try again, just move on
                    log(chrome.runtime.lastError);
                    reject();
                } else {
                    resolve();
                }
            });
        });
    }

    function youtube(key) {
        youtubeTabs((tabs) => {
            Promise.all(tabs.map((tab) => getState(tab.id))).then((states) => {
                var playing = tabs.filter((tab, i) => states[i] === "play");
                if (key === "K".charCodeAt(0)) {
                    if (playing.length) {
                        playing.forEach((t) => {
                            chrome.tabs.sendMessage(t.id, sendFormat("key", key));
                            addTab(t.id, t.title, 1);
                        });
                        sendRequest("youtube");
                    } else if (youtubeQueue.length) {
                        playFirst();
                        sendRequest("youtube");
                    } else if (isBlocked()) {
                        playCurrent(playing);
                    }
                } else {
                    playing.forEach((t) => chrome.tabs.sendMessage(t.id, sendFormat("key", key)));
                }
            });
        });
    }

    function getState(id) {
        return new Promise(function(resolve, reject) {
            var data = {action:"getState"};
            chrome.tabs.sendMessage(id, data, resolve);
        });
    }

    function youtubePlay(id) {
        youtubeQueue.some((y, i) => {
            if (y.id === id) {
                play(youtubeQueue.splice(i, 1)[0].id);
                return true;
            }
        });
    }

    function skipAd() {
        youtubeTabs(function(tabs) {
            var data = {action:"skipAd"};
            for (var i = 0 ; i < tabs.length ; i++) {
                chrome.tabs.sendMessage(tabs[i].id, data);
            }
        });
    }

    function addTab(id, title, top) {
        //remove ending - YouTube
        var index = title.lastIndexOf(" - YouTube");
        if (index !== -1) {
            title = title.substr(0, index);
        }
        var y = {
            id: id,
            title: title
        }
        if (top) {
            youtubeQueue.unshift(y);
        } else {
            youtubeQueue.push(y);
        }
        chrome.tabs.sendMessage(id, {action:"listen"}, () => {
            youtubeQueue.some((y, i) => {
                if (y.id === id) {
                    youtubeQueue.splice(i, 1);
                    return true;
                }
            });
            // not updating browserAction as its hard to start a song while its open
        });
    }

    function emptyList() {
        youtubeQueue = [];
    }

    function playFirst() {
        if (youtubeQueue.length) {
            play(youtubeQueue.shift().id);
        }
    }

    function playAll() {
        for (var y of youtubeQueue) {
            play(y.id);
        }
        emptyList();
    }

    function playCurrent(tabs) {
        for (var i = 0 ; i < tabs.length ; i++) {
            if (tabs[i].active) {
                play(tabs[i].id);
                return;
            }
        }
    }

    function play(tabId) {
        chrome.tabs.sendMessage(tabId, sendFormat("key", "K".charCodeAt(0)));
    }


    function youtubeEnd(tab) {
        // add to end of list
        addTab(tab.id, tab.title);
        sendRequest("youtube");
    }
});
