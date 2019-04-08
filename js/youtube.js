var youtubeVideoNames = [];

addDefault("youtubeEnabled", true, "bool");
onSettingLoad("youtubeEnabled", (e) => {
    if (!e) return;
    var youtubeVideoIds = [];
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
        // getState injects if not already
        tabs.map(tab => tab.id).forEach((t) => getState(t));
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

    function youtube(key) {
        youtubeTabs((tabs) => {
            Promise.all(tabs.map((tab) => getState(tab.id))).then((states) => {
                var playing = tabs.filter((tab, i) => states[i] === "play");
                if (key === "K".charCodeAt(0)) {
                    if (playing.length) {
                        emptyList();
                        playing.forEach((t) => {
                            chrome.tabs.sendMessage(t.id, sendFormat("key", key));
                            addTab(t.id, t.title);
                        });
                        sendRequest("youtube");
                    } else if (youtubeVideoIds.length) {
                        playAll();
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

    function getState(id, repeated) {
        return new Promise(function(resolve, reject) {
            var data = {action:"getState"};
            chrome.tabs.sendMessage(id, data, function(state) {
                //script missing from the tab, inject
                if (state === undefined && !repeated) {
                    chrome.tabs.executeScript(id, {file:scriptUrl}, function() {
                        if (chrome.runtime.lastError) {
                            //something went wrong here, don't try again, just move on
                            log(chrome.runtime.lastError);
                            // resolve so that Promises.all doesn't reject, empty response
                            resolve();
                        } else {
                            //make sure not to get in infinite loop
                            resolve(getState(id, true));
                        }
                    });
                } else {
                    resolve(state);
                }
            });
        });
    }

    function youtubePlay(index) {
        play(youtubeVideoIds.splice(index, 1)[0]);
        youtubeVideoNames.splice(index, 1);
    }

    function skipAd() {
        youtubeTabs(function(tabs) {
            var data = {action:"skipAd"};
            for (var i = 0 ; i < tabs.length ; i++) {
                chrome.tabs.sendMessage(tabs[i].id, data);
            }
        });
    }

    function addTab(id, title) {
        //remove ending - YouTube
        title = title.substr(0, title.lastIndexOf(" - YouTube"));
        youtubeVideoIds.push(id);
        youtubeVideoNames.push(title);
        chrome.tabs.sendMessage(id, {action:"listen"}, () => {
            if (youtubeVideoIds.length === 1 && youtubeVideoIds[0] === id) {
                emptyList();
            } else {
                youtubeVideoIds.some((vId, i) => {
                    if (vId === id) {
                        youtubeVideoIds.splice(i, 1);
                        youtubeVideoNames.splice(i, 1);
                        return true;
                    }
                });
            }
        });
    }

    function emptyList() {
        youtubeVideoIds = [];
        youtubeVideoNames = [];
    }

    function playAll() {
        for (var i = 0 ; i < youtubeVideoIds.length ; i++) {
            play(youtubeVideoIds[i]);
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
        //add to list only if empty, or thing before was added this way
        //property that gets overwritten when array is restarted
        if (youtubeVideoIds.ended || !youtubeVideoIds.length) {
            emptyList();
            addTab(tab.id, tab.title);
            sendRequest("youtube");
            youtubeVideoIds.ended = true;
        }
    }
});