var youtubeVideoNames = [];

(function() {
    var youtubeVideoIds = [];
    var scriptUrl = "/js/youtubeContent.js";

    addMessageListener({
        "youtube": function(a) {
            youtube(a.input);
        },
        "youtubeEnd": function(a, b) {
            youtubeEnd(b.tab);
        },
        "skipAd": function(a, b) {
            skipAd(b.tab);
        },
        "changeVolume": function(a) {
            changeVolume(a.input);
        }
    });

    //inject youtube script into all youtube tabs
    //mostly for development, any tab opened after extension loaded should have it already
    youtubeTabs(function(tabs) {
        for (var i = 0 ; i < tabs.length ; i++) {
            chrome.tabs.executeScript(tabs[i].id, {file:scriptUrl});
        }
    });

    function youtubeTabs(callback) {
        //get all youtube tabs that isn't the current one
        var query = {url:["*://*.youtube.com/*", "*://youtube.com/*"]};
        //if current page is blocked, add it to current list
        //defined in siteBlocker
        if (!isBlocked()) {
            query.active = false;
        }
        chrome.tabs.query(query, callback);
    }

    function youtube(index) {
        if (typeof index === "number") {
            play(youtubeVideoIds.splice(index, 1)[0]);
            youtubeVideoNames.splice(index, 1);
        } else {
            youtubeTabs((tabs) => {
                var cnt = 0;
                var num = tabs.length;
                Promise.all(tabs.map((tab) => getState(tab.id))).then((states) => {
                    var playing = states.some((s) => s === "play");
                    if (index === "K") {
                        if (playing) {
                            emptyList();
                            for (var i = 0 ; i < num ; i++) {
                                if (states[i] === "play") {
                                    var tab = tabs[i];
                                    var data = {action:"pause"};

                                    chrome.tabs.sendMessage(tab.id, data);
                                    addTab(tab.id, tab.title);
                                }
                            }
                            sendRequest("youtube");
                        } else if (youtubeVideoIds.length) {
                            playAll();
                            sendRequest("youtube");
                        } else if (isBlocked()) {
                            playCurrent(tabs);
                        }
                    } else if (playing) {
                        for (var i = 0 ; i < num ; i++) {
                            if (states[i] === "play") {
                                var tab = tabs[i];
                                var data = {action:index === "J" ? "back" : "forward"};

                                chrome.tabs.sendMessage(tab.id, data);
                            }
                        }
                    }
                });

                function getState(id, repeat) {
                    return new Promise(function(resolve, reject) {
                        var data = {action:"getState"};
                        chrome.tabs.sendMessage(id, data, function(state) {
                            //script missing from the tab, inject
                            if (state === undefined && !repeat) {
                                chrome.tabs.executeScript(id, {file:scriptUrl}, function() {
                                    if (chrome.runtime.lastError) {
                                        //something went wrong here, don't try again, just move on
                                        log(chrome.runtime.lastError);
                                        reject();
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
            });
        }
    }

    function skipAd() {
        youtubeTabs(function(tabs) {
            var data = {action:"skipAd"};
            for (var i = 0 ; i < tabs.length ; i++) {
                chrome.tabs.sendMessage(tabs[i].id, data);
            }
        });
    }

    function changeVolume(dir) {
        youtubeTabs(function(tabs) {
            var data = {action:"changeVolume", input:dir};
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
        var data = {action:"play"};
        chrome.tabs.sendMessage(tabId, data);
    }

    function youtubeEnd(tab) {
        //add to list only if empty, or thing before was added this way
        //property that gets overwritten when array is restarted
        if (youtubeVideoIds.ended || !youtubeVideoIds.length) {
            emptyList();
            addTab(tab.id, tab.title);
            sendRequest("youtube");
            youtubeVideoIds.ended = true;
            chrome.tabs.sendMessage(tab.id, {action:"listen"}, function() {
                if (youtubeVideoIds.ended && youtubeVideoIds[0] === tab.id) {
                    emptyList();
                }
            });
        }
    }
})();