var youtubeVideoNames = [];

(function() {
    var youtubeVideoIds = [];
    var scriptUrl = "/js/youtubeContent.js";

    addMessageListener({
        "youtube": function(a) {
            youtube(a.input);
        },
        "youtubeEnd": function(a,b) {
            youtubeEnd(b.tab);
        },
        "skipAd": function(a,b) {
            skipAd(b.tab);
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
        chrome.tabs.query(query,callback);
    }

    function youtube(index) {
        if (typeof index === "number") {
            play(youtubeVideoIds.splice(index,1)[0]);
            youtubeVideoNames.splice(index,1);
        } else {
            youtubeTabs(function(tabs) {
                //if tabs is empty, nothing to play anyways
                var states = [];
                var numPause = 0;

                var cnt = 0;
                var num = tabs.length;
                for (var i = 0 ; i < num ; i++) {
                    getState(tabs[i].id,i);
                }

                function getState(id,i,repeat) {
                    var data = {action:"getState"};
                    chrome.tabs.sendMessage(id,data,function(state) {
                        //script missing from the tab, inject
                        if (state === undefined && !repeat) {
                            chrome.tabs.executeScript(id,{file:scriptUrl},function() {
                                if (chrome.runtime.lastError) {
                                    //something went wrong here, don't try again, just move on
                                    log(chrome.runtime.lastError);
                                    action();
                                } else {
                                    //make sure not to get in infinite loop
                                    getState(id,i,true);
                                }
                            });
                        } else {
                            states[i] = state;
                            if (state === "play") {
                                numPause++;
                            }
                            cnt++;
                            if (cnt === num) {
                                action();
                            }
                        }
                    });
                }

                function action() {
                    if (numPause) {
                        emptyList();
                        for (var i = 0 ; i < num ; i++) {
                            if (states[i] === "play") {
                                var tab = tabs[i];
                                var data = {action:"pause"};

                                chrome.tabs.sendMessage(tab.id,data);
                                addTab(tab.id,tab.title);
                            }
                        }
                        sendRequest("youtube");
                    } else if (youtubeVideoIds.length) {
                        playAll();
                        sendRequest("youtube");
                    } else if (isBlocked()) {
                        playCurrent(tabs);
                    }
                }
            });
        }
    }

    function skipAd() {
        youtubeTabs(function(tabs) {
            var data = {action:"skipAd"};
            for (var i = 0 ; i < tabs.length ; i++) {
                chrome.tabs.sendMessage(tabs[i].id,data);
            }
        });
    }

    function addTab(id,title) {
        //remove ending - YouTube
        title = title.substr(0,title.lastIndexOf(" - YouTube"));
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
        chrome.tabs.sendMessage(tabId,data);
    }

    function youtubeEnd(tab) {
        //add to list only if empty, or thing before was added this way
        //property that gets overwritten when array is restarted
        if (youtubeVideoIds.ended || !youtubeVideoIds.length) {
            emptyList();
            addTab(tab.id,tab.title);
            sendRequest("youtube");
            youtubeVideoIds.ended = true;
            chrome.tabs.sendMessage(tab.id,{action:"listen"},function() {
                if (youtubeVideoIds.ended && youtubeVideoIds[0] === tab.id) {
                    emptyList();
                }
            });
        }
    }
})();