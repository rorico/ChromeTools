// use by shortcuts, is a constant
var wastingUrl = chrome.extension.getURL("/html/wasting.html")
//set global variables, these are likely used by browserAction
var startTime = new Date();
var wastingTime = 0;
var url = "";
var title = "";
var timeLeft = 0;
var timeLine = [];
var noBlocks = [];
// data shown on timeline, may not be what is focused
var foreground = {};
// used in wordsParser
var getWasteStreak;

//functions
var isBlocked = () => false;

addDefault("siteBlockerEnabled", true, "bool");
onSettingLoad("siteBlockerEnabled", (e) => {
    if (!e) return;
    var tabId = -2;
    var windowId = -4;
    var returnTimer;
    var VIPtab = -1;
    var tempVIPtimer = -1;
    var tempVIPstartTime = 0;
    var finishTab = false;
    var nextTime = 0;
    var nextNoBlock = Infinity;
    var noBlockTimer;
    var windows = {};

    // used in wordsParser
    var wasteStreak = 0;

    //sites that will block after time spent
    // TODO: better system for this, more check
    addDefault("blockUrls", [[
        "*://reddit.com/*", "*://*.reddit.com/*",
        "http://threesjs.com/"
    ],
    //sites that will spend time but not actively block
    [
        "*://*.youtube.com/*",
        "*://imgur.com/*", "*://*.imgur.com/*"
    ]], "json");

    addDefault("timeLineLength", 1800000, "int"); // 30 mins
    addDefault("startingTimeLeft", 300000, "int"); // 5 mins
    addDefault("VIPlength", 20000, "int"); // 20s
    addDefault("zeroLength", 1800000, "int"); // 30 mins
    addDefault("tolerance", 2000, "int"); // 2s
    addDefault("quickTabTime", 400, "int"); // 0.4s
    addDefault("minChange", 1200000, "int"); // 20 mins
    addDefault("startingZero", false, "bool");
    addDefault("afkRestart", false, "bool");
    if (0) { // if in testing mode
        addDefault("timeLineLength", 120000, "int"); // 2 mins
        addDefault("startingTimeLeft", 60000, "int"); // 1 mins
        addDefault("minChange", 60000, "int"); // 1 mins
    }
    // might need to move to let functions load first
    onSettingChange("startingTimeLeft", (newS, oldS) => {
        timeLeft += newS - oldS;
        returnTime();
    });

    timeLeft = settings.startingTimeLeft;

    //functions in their own closure
    var blockTab;
    var sendContent;

    addMessageListener({
        "VIP": () => {
            VIP();
        },
        "finish": () => {
            finish();
        },
        "resetTime": resetTime,
        "change": function(a) {
            change(a.input);
        },
        "temp": tempVIP,
        "zero": zero,
        "antizero": antizero
    });
    addScheduleListener(setupClass);

    var inChrome = true;
    function currentWindow() {
        return inChrome ? windowId : -3;
    }


    function currentTab() {
        // should be tabId inChrome and null outside
        return windows[currentWindow()].tab;
    }

    addDefault("recordComputer", true, "bool");
    onSettingLoad("recordComputer", (e) => {
        addDefault("localUrl", "ws:localhost:2012", "str");

        var conn = new WebSocket(settings.localUrl);
        conn.onopen = () => {
            console.log("localhost connected");
        }
        conn.onerror = (error) => {
            log("localhost connection error: " + JSON.stringify(error));
        };

        conn.onclose = () => {
            log("connection to localhost closed");
            inChrome = true;
            delete windows[-3];
            // refresh
            refreshTimeline();
            // TODO: retry logic
        };

        conn.onmessage = (message) => {
            var data = message.data;
            var [path, title] = JSON.parse(data);

            if (/\\chrome.exe$/.test(path)) {
                inChrome = true;
                // do this for now so that wasting on the outside doesn't take time.
                delete windows[-3];
                refreshTimeline();
            } else {
                inChrome = false;
                handleChange(path, title, false, -3, null);
            }
        }
    });


    //set-up first time when opened
    startTimeLine();

    getWasteStreak = function() {
        // worse the more wasting, and the more keywords used
        return wasteStreak + (timeLeft < 0 ? Math.floor(-timeLeft / settings.startingTimeLeft) : 0);
    };

    function addNoBlock(start, stop, info) {
        var index = noBlocks.length;
        for (var i = 0; i < noBlocks.length ; i++) {
            var block = noBlocks[i];
            if (start < block[0]) {
                index = i;
                break;
            }
        }
        //need timestamp to be jsonifiable (when sent to content scripts)
        var entry = [+start, +stop, info];
        noBlocks.splice(index, 0, entry);

        //TODO better way to do this, for now redo entire thing
        sendContent("addNoBlock", noBlocks);
        if (index === 0) {
            noBlockReminder();
        }
    }

    function checkNoBlock(date) {
        for (var i = 0; i < noBlocks.length ; i++) {
            var block = noBlocks[i];
            if (date < block[1]) {
                return block;
            }
        }
        //could go to next day, for now, don't do that
        return [Infinity, Infinity];
    }

    function noBlockReminder() {
        clearTimer(noBlockTimer);
        var next = checkNoBlock(new Date());
        if (isFinite(next[0])) {
            var now = new Date();
            var inBlock = next[0] < now;
            nextNoBlock = inBlock ? next[1] : next[0] - settings.startingTimeLeft;
            noBlockTimer = setTimer(function check() {
                nextNoBlock = inBlock ? next[1] : next[0] - timeLeft;
                var time = nextNoBlock - new Date();
                //if timing is off
                if (time > 0) {
                    noBlockTimer = setTimer(function() {
                        check();
                    }, time);
                } else {
                    timeLeftOutput();
                    noBlockReminder();
                }
            }, nextNoBlock - new Date());
        } else {
            nextNoBlock = Infinity;
        }
    }

    //gets run when schedule gets loaded in ScheduleInfo.js
    function setupClass(today) {
        var now = new Date();
        //want history of previous classes
        var position = now - settings.timeLineLength;
        for (var i = 0 ; i < today.length ; i++) {
            var thisClass = today[i];
            var end = militaryToUTC(thisClass[1][2]);
            if (position < end) {
                var start = militaryToUTC(thisClass[1][1]);
                addNoBlock(start, end, thisClass);
            }
        }
    }

    //after change, its not even close to military time, but too lazy to switch function names
    function militaryToUTC(time) {
        var ret = new Date();
        var hour = Math.floor(time/60);
        var minutes = time % 60;
        ret.setHours(hour);
        ret.setMinutes(minutes);
        ret.setSeconds(0);
        ret.setMilliseconds(0);
        return ret;
    }

    function startTimeLine() {
        if (settings.startingZero) {
            // assume this is set before this is called
            startTime -= settings.startingTimeLeft
            wastingTime = 2;
            url = "starting";
            title = "starting";
        }
        chrome.tabs.query({active:true}, function(tabs) {
            // just to get variables set properly, can do this more efficiently
            var newTab = (tab) => {
                tabId = tab.id;
                windowId = tab.windowId;
                handleChangeTab(tab);
            };
            tabs.forEach(newTab);
            // can run these simultaneous, but too lazy
            chrome.windows.getCurrent((window) => {
                windowId = window.windowId;
                tabs.forEach((tab) => {
                    if (tab.windowId === windowId) {
                        newTab(tab);
                    }
                });
            });
        });
    }

    chrome.tabs.onActivated.addListener(function(activeInfo) {
        var id = activeInfo.tabId;
        chrome.tabs.get(id, function(tab) {
            var window = activeInfo.windowId;
            if (window === windowId) {
                tabId = id;
            }
            // will get filled in later
            windows[window] = {
                tab: id
            };
            handleChangeTab(tab);
        });
    });

    chrome.tabs.onUpdated.addListener(function(id, changeInfo, tab) {
        if (changeInfo) {
            // page changed
            if (changeInfo.status === "loading") {
                // finish keyword updates on page changes, check here
                if (finishTab && id === VIPtab) {
                    finishTab = false;
                    VIPtab = -1;
                }
                handleChangeTab(tab);
            }
            // title updated (delayed)
            if (changeInfo.title) {
                // since this delayed, just manually update the current entry
                // not ideal, but simpler
                if (id === windows[tab.windowId].tab) {
                    windows[tab.windowId].title = changeInfo.title;
                    if (windows[tab.windowId] === foreground) {
                        title = tab.incognito ? "incognito" : changeInfo.title;
                    }
                }
            }

        }
    });


    chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId) {
        if (removedTabId === VIPtab) {
            VIPtab = addedTabId;
        }
    });

    chrome.windows.onFocusChanged.addListener(function(id) {
        if (id === chrome.windows.WINDOW_ID_NONE) {
            // this only happens in debugger and browserAction
            // they don't have own tab info so don't care
            // the chrome tab query also doesn't play nice with it
            return;
        }
        if (windowId !== id) {
            chrome.tabs.query({windowId:id, active:true}, function(tabs) {
                if (tabs.length) {
                    var activeTab = tabs[0];
                    tabId = activeTab.id;
                    // this windowId can be different from id
                    // namely due to current window being -1
                    windowId = activeTab.windowId;
                    // this sets it up for active tab in windows
                    // don't handle activeTab, as tab could be blocked.
                    if (windows[windowId]) {
                        refreshTimeline();
                    } else {
                        handleChangeTab(activeTab);
                    }
                    // 
                } else {
                    log("window empty tab");
                }
            });
        }
    });

    chrome.windows.onRemoved.addListener(function(id) {
        if (windows[id]) {
            delete windows[id];
        }
    });

    function handleChangeTab(tab) {
        handleChange(tab.url, tab.title, tab.incognito, tab.windowId, tab.id);
    }

    function handleChange(newUrl, newTitle, incognito, wId, tId) {
        var testWasting = wastingTime;
        if (!windows[wId]) {
            // will get filled in lower
            windows[wId] = {
                tab: tId
            }
        }
        if (windows[wId].tab === tId) {
            var testWasting = matchesURL(newUrl);
            //consider converting to integer right here
            var startTime = new Date();
            // overwrite entire object instead of partial, incase references are kept elsewhere
            windows[wId] = {
                wasting: testWasting,
                title: newTitle,
                url: newUrl,
                incognito: incognito,
                tab: tId,
                window: wId,
                startTime: startTime
            };


            var currentW = currentWindow();
            var currentT = currentTab();
            // start with copy of foreground
            // overwrite with things that are higher wasting
            var newForeground = windows[currentW];
            for (var w in windows) {
                // lower wasting time is higher priority, but 0 is lowest, might want to reverse order
                if (windows[w].wasting && (!newForeground.wasting || (windows[w].wasting < newForeground.wasting))) {
                    newForeground = windows[w];
                }
            }

            if ((wId === currentW && tId === currentT) ||
                newForeground !== foreground) {
                updateTimeline(newForeground, startTime);
            }
        }
    }

    function updateTimeline(info, newStart) {
        //handle previous page
        var timeSpent = new Date() - startTime;
        //if small time spent on wasting, don't count
        if (timeSpent < settings.tolerance) {
            wastingTime = 0;
        }
        var newest = [+startTime, timeSpent, wastingTime, url, title];
        modifyTimeLine("add", newest);
        if (wastingTime) {
            changeTimeLeft(-timeSpent);
            // don't include hack to start at 0
            if (url !== "starting") {
                //don't want to slow down event handler
                setTimeout(function() {
                    storeData("wasting", newest);
                }, 0);
            }
        }
        // don't include hack to start at 0
        if (url && url !== "starting") {
            setTimeout(() => {
                storeData("timeline", newest);
            });
        }
        if (settings.afkRestart && timeSpent > settings.timeLineLength) {
            setTimeout(() => {
                resetTime();
            });
        }
        //handle new page
        //TODO, make incognito a setting
        url = info.incognito ? "incognito" : info.url;
        title = info.incognito ? "incognito" : info.title;
        startTime = newStart;
        wastingTime = info.wasting;
        foreground = info;

        timeLeftOutput();

        //to browserAction, doesn't happen often, but can happen
        var info = {
            newest:newest,
            startTime:+startTime,
            wastingTime:wastingTime,
            url:url,
            title:title
        };
        sendContent("newPage", info);

        //check for returnTime to be more up to date
        if (startTime > nextTime + settings.tolerance) {
            returnTime();
        }
    }

    function refreshTimeline() {
        var currentW = currentWindow();
        var foreground = windows[currentW] || {};
        handleChange(foreground.url, foreground.title, foreground.incognito, currentW, tabId);
    }

    //checks all levels and returns the level of url if matched, 0 if none
    function matchesURL(url) {
        if (url === wastingUrl) return 1
        for (var lvl = 0 ; lvl < settings.blockUrls.length ; lvl++) {
            for (var i = 0 ; i < settings.blockUrls[lvl].length ; i++) {
                if (new RegExp("^" + settings.blockUrls[lvl][i].replace(/\./g, "\\.").replace(/\*/g, ".*") + "$").test(url)) {
                    return lvl + 1;
                }
            }
        }
        return 0;
    }

    //timeLine acts as an object
    function modifyTimeLine(action, load) {
        if (action === "add") {
            timeLine.unshift(load);
        } else if (action === "remove") {
            timeLine.splice(load[0], load[1]);
        } else if (action === "change") {
            if (load < timeLine.length || load < 0) {
                if (timeLine[load][2]) {
                    sendContent("change", [load, timeLine[load][2]]);
                    timeLine[load][2] = 0;
                    changeTimeLeft(timeLine[load][1]);
                }
            } else {
                log("change to timeline out of bounds" + load + "/" + timeLine.length);
            }
        } else {
            log("timeLine action incorrect");
        }
    }

    function changeTimeLeft(change) {
        timeLeft += change;
        //could run timeLeftOutput() here, but if this function gets called multiple times, a lot of calculations are wasted
        //instead, remember to call timeLeftOutput(); at end of processing
    }

    //shows effective timeLeft from this moment on
    var timeLeftOutput = (function() {
        var displayTimer = -1;
        var displayTimeStarter = -1;
        return timeLeftOutput;
        //ideally, shows lowest timeLeft at all points
        function timeLeftOutput() {
            sendContent("timer", timeLeft);
            var now = new Date();
            var timeSpent = now - startTime;
            var time = timeLeft - (wastingTime ? timeSpent : 0);
            var endTime = 0;
            var countDown = wastingTime;
            var blockType = "time";
            var oneTab;

            //just check if reminder is needed for this time.
            if (now > nextNoBlock) {
                noBlockReminder();
            }
            var classInfo = checkNoBlock(now);
            var classTime = classInfo[0] - now;
            if (time > classTime) {
                time = classTime;
                countDown = true;
                if (classInfo[2]) {
                    blockType = "schedule";
                }
            }

            // reset wasteStreak when timeLeft goes positive
            // kinda sketchy way to do this, want to do before user given time
            if (time > 0) {
                wasteStreak = 0;
            }

            var displayTime = time;
            // cannot block any window outside of chrome
            var blocking = Object.values(windows).filter(w => w.window !== -3 && w.wasting)

            if (VIPtab !== -1) {
                // can be vip tab without wasting time
                // still want to show time left
                var VIPinfo;
                blocking.some((b, i) => {
                    if (b.tab === VIPtab) {
                        // don't block this tab
                        VIPinfo = blocking.splice(i, 1)[0];
                        return true;
                    }
                });
                var tabId = windows[windowId].tab;
                var thisTab = VIPtab === tabId;
                // this handles finish keyword, kinda sketch, but I can't think of an edge case where this doesn't work
                // TODO test without this
                if (thisTab) {
                    VIPinfo = windows[windowId];
                }
                if (!tempVIPstartTime) {
                    if (VIPinfo) {
                        oneTab = [VIPinfo, Infinity];
                    }
                    if (thisTab) {
                        displayTime = Infinity;
                        countDown = false;
                    }
                } else {
                    //don't even bother if more time left than limit
                    var VIPtimeLeft = settings.VIPlength - now + tempVIPstartTime;
                    if (time < VIPtimeLeft) {
                        if (VIPinfo) {
                            oneTab = [VIPinfo, VIPtimeLeft];
                        }
                        if (thisTab) {
                            //if not wasting time, vip will countDown, but stop when reach timeLeft
                            if (!countDown && !wastingTime && time > endTime) {
                                endTime = time;
                            }
                            displayTime = VIPtimeLeft;
                            countDown = true;
                        }
                    }
                }
            }

            countDownTimer(displayTime, endTime, countDown);
            // this can change timeline, so put at very bottom
            blockTab(blocking, time, blockType, oneTab);
        }

        function countDownTimer(time, endTime, countDown) {
            clearTimeout(displayTimeStarter);
            clearInterval(displayTimer);
            //don't have negative time
            if (time < 0) {
                time = 0;
            }
            setBadgeText(time);
            if (countDown && time > endTime) {
                var delay = (time-1)%1000 + 1;
                displayTimeStarter = setTimeout(function() {
                    time -= delay;
                    if (countDown && time >= endTime) {
                        setBadgeText(time);
                        displayTimer = setInterval(function() {
                            time -= 1000;
                            if (countDown && time >= endTime) {
                                setBadgeText(time);
                            } else {
                                clearInterval(displayTimer);
                            }
                        }, 1000);
                    }
                }, delay);
            }
        }

        function setBadgeText(time) {
            chrome.browserAction.setBadgeText({text:MinutesSecondsFormat(time)});
        }

        function MinutesSecondsFormat(milli) {
            if (milli === Infinity) {
                //infinity symbol
                return "\u221e";
            } else {
                var secs = Math.ceil(milli/1000);
                return Math.floor(secs/60) + ":" + ("0" + Math.floor(secs%60)).slice(-2);
            }
        }
    })();

    (function() {
        var blockTimers = [];
        var blocked = [];

        //sets a reminder when timeLeft reaches 0, and blocks site
        blockTab = function(tabs, time, blockType, oneTab) {
            // on blocked tab per window (all foreground should be blocked)
            if (time > 0) {
                unblockAll();
            } else {
                blocked.some((b, i) => {
                    // both of these are independent, but only one happens at a time
                    if (oneTab && b.tab === oneTab[0].tab) {
                        unblockTab(b);
                        blocked.splice(i, 1);
                        return true;
                    } else if (b.tab !== windows[b.window].tab) {
                        // do not unblock the site if tab hasn't changed and still no timeLeft
                        unblockTab(b);
                        blocked.splice(i, 1);
                        return true;
                    }
                });
            }

            blockTimers.forEach(clearTimeout);
            blockTimers = [];
            if (tabs.length) {
                if (time < settings.tolerance) {
                    time = settings.tolerance;
                }
                // auto finish
                if (!oneTab) {
                    var now = +new Date();
                    var check = (start) => time + now - start > settings.VIPlength + settings.tolerance;
                    var tab = -1;
                    // finish the focused one
                    if (windows[windowId].wasting === 2 && check(startTime)) {
                        tab = tabId;
                        tabs = tabs.filter((w) => w.tab !== tabId);
                    } else {
                        // if not focused, pick one
                        tabs.some((b, i) => {
                            if (b.wasting === 2 && check(b.startTime)) {
                                tab = b.tab;
                                tabs.splice(i, 1);
                                return true;
                            }
                        });
                    }
                    if (tab !== -1) {
                        blockTimers.push(setTimeout(() => {
                            finish(tab);
                            setAlarm(0, 2);
                        }, time));
                    }
                }
                block(tabs, time, blockType);
            }
            if (wastingTime && oneTab && isFinite(oneTab[1])) {
                block([oneTab[0]], oneTab[1], blockType);
            }
        };

        function block(tabs, time, blockType) {
            var start = +new Date();
            var delay = Math.max(time - settings.tolerance, settings.quickTabTime);
            blockTimers.push(setTimeout(() => {
                var readys = tabs.map(() => false);
                // when both callbacks end, block
                var blockC = (tab, i) => {
                    if (readys[i]) {
                        blockSite(tab, blockType);
                    }
                    readys[i] = true;
                };
                tabs.forEach((tab, i) => {
                    //note, won't inject if already injected
                    injectScripts(tab.tab, blockType, function(ready) {
                        if (ready) {
                            prepareBlock(tab, blockType, delay);
                            blockC(tab, i);
                        }
                    });
                });

                var delay = time - new Date() + start;
                blockTimers.push(setTimeout(() => {
                    tabs.forEach(blockC);
                }, delay));
            }, delay));
        }

        function prepareBlock(tab, type, blockTime) {
            //if in the time to block, tab changes, don't block
            if (windows[tab.window].tab === tab.tab) {
                //iframes need time to load, load beforehand if can
                var info = {settings: settings};
                if (type === "time") {
                    info = {
                        //just for setup
                        settings: settings,
                        iframeInfo: iframeInfo,
                        delay: blockTime
                    };
                }
                var data = {action:"prepare", info:info, type:type};
                chrome.tabs.sendMessage(tab.tab, data);
            }
        }

        function blockSite(tab, type) {
            //if in the time to block, tab changes, don't block
            if (windows[tab.window].tab === tab.tab) {
                if (type === "time") {
                    var info = {
                        timeLeft: timeLeft,
                        startTime: +startTime,
                        wastingTime: wastingTime,
                        url: url,
                        title: title,
                        timeLine: timeLine,
                        settings: settings,
                        noBlocks: noBlocks
                    };
                }

                var data = {action:"block", info:info, type:type};
                chrome.tabs.sendMessage(tab.tab, data, function(isBlocked) {
                    //when page is actually blocked, update timeline
                    if (isBlocked) {
                        blocked.push(Object.assign({type: type}, tab));

                        handleChange("Blocked", "Blocked", false, tab.window, tab.tab);
                        storeData("block", [+new Date(), tab.url, tab.title, tab.wasting]);
                    }
                });
            }
        }

        function unblockTab(tab) {
            chrome.tabs.sendMessage(tab.tab, sendFormat("unblock"), (unblocked) => {
                // important to not run in same thread to allow this one to finish to avoid recursion problems
                if (unblocked) {
                    handleChange(tab.url, tab.title, tab.incognito, tab.window, tab.tab);
                }
            });
        }

        function unblockAll() {
            blocked.forEach((b) => {
                unblockTab(b);
            });
            blocked = [];
        }

        sendContent = function(action, input, content) {
            //only send to content scripts
            if (!content) {
                sendRequest(action, input);
            }
            blocked.forEach((b) => {
                chrome.tabs.sendMessage(b.tab, sendFormat(action, input));
            });
        };

        isBlocked = function() {
            //I'm just gonna assume there is no usual url named "Blocked"
            return url === "Blocked";
        };

        var injectScripts = (function() {
            var injecting = false;
            var injectQueue = [];
            var scripts = {
                all:[
                    "/lib/jquery.min.js",
                    "/css/content.css",
                    "/js/content.js"],
                schedule:[
                    "/lib/jquery-ui.min.js",
                    "/lib/jquery-ui.min.css",
                    "/css/schedule.css",
                    "/js/schedule.js"],
                time:[
                    "/js/timeLine.js",
                    "/js/keyPress.js",
                    "/js/iframe.js",
                    "/css/timeLine.css"]
            };
            return injectScripts;
            function injectScripts(tab, blockType, callback) {
                //see if the page is already injected, and what type
                var data = {action:"ping"};
                chrome.tabs.sendMessage(tab, data, function(blockTypes) {
                    var injectTypes;
                    if (blockTypes) {
                        //if there, but wrong block type
                        if (!blockTypes[blockType]) {
                            injectTypes = [blockType];
                        }
                    } else {
                        //if not there, inject
                        //want content.js to be last, jquery order doesn't matter until files are called
                        injectTypes = ["all", blockType];
                    }
                    if (injectTypes && injectTypes.length) {
                        var list = [];
                        for (var i = 0 ; i < injectTypes.length ; i++) {
                            list = list.concat(scripts[injectTypes[i]]);
                        }
                        //want to make sure not injecting to the same page twice
                        if (injecting) {
                            //ping again
                            injectQueue.push(function() {
                                injectScripts(tab, blockType, callback);
                            });
                        } else {
                            injecting = true;
                            addContentScript(tab, list, 0, function(ready) {
                                injecting = false;
                                callback(ready);
                                if (injectQueue.length) {
                                    var next = injectQueue.shift();
                                    next();
                                }
                            });
                        }
                    } else {
                        callback(true);
                    }
                });
            }

            function addContentScript(tab, list, i, callback) {
                var file = list[i];
                if (file) {
                    var inject = file.substring(file.lastIndexOf(".")) === ".js" ? chrome.tabs.executeScript : chrome.tabs.insertCSS;
                    inject(tab, {file:file}, function() {
                        if (chrome.runtime.lastError) {
                            //this happens a lot due to closing of tab
                            //don't show front end
                            console.log(chrome.runtime.lastError);
                            callback(false);
                            return;
                        }
                        addContentScript(tab, list, i + 1, callback);
                    });
                } else {
                    //if end of list, or if list is empty
                    callback(true);
                }
            }
        })();
    })();

    function returnTime() {
        var date = new Date() - settings.timeLineLength;
        var endingIndex = -1;
        var cnt = 0;
        var timeTotal = 0;
        var currentTimeInterval = new Date() - startTime;
        var currentTimeOffset = (wastingTime ? currentTimeInterval : 0);
        //remove anything after limit
        for (var i = timeLine.length - 1 ; i != -1 ; i--) {
            //endtime is same as next starttime
            var endTime = (i ? timeLine[i-1][0] : +timeLine[i][0] + timeLine[i][1]);
            if (date > endTime) {
                if (timeLine[i][2]) {
                    timeLeft += timeLine[i][1];
                }
                cnt++;
            } else {
                //note if going through entire array, this will never run
                timeTotal = timeLine[i][0] - date; //negative
                endingIndex = i;
                break;
            }
        }
        if (endingIndex === -1) {
            timeTotal = startTime - date; //negative
        }

        if (cnt) {
            modifyTimeLine("remove", [endingIndex + 1, cnt]);
        }

        //return time and calculate when to call function again
        //ideally check again when can return time again
        var completed = false;
        for (var i = endingIndex ; i != -1 ; i--) {
            if (timeLine[i][2]) {
                //note timeLeft can be negative
                if (timeLeft - currentTimeOffset > timeTotal) {
                    modifyTimeLine("change", i);
                } else {
                    completed = true;
                    break;
                }
            }
            timeTotal += timeLine[i][1];
        }
        //if reach end of the list, add current time
        if (!completed) {
            timeTotal += currentTimeInterval;
        }
        timeLeftOutput();
        //upper limit can be passed if currently in very long wastingTime
        var nextDelay = Math.min(timeTotal - timeLeft + currentTimeOffset, settings.timeLineLength - settings.startingTimeLeft);
        //used to make sure that this is called at appropriate times
        nextTime = +new Date() + nextDelay;
        clearTimer(returnTimer);
        returnTimer = setTimer(returnTime, nextDelay);
    }

    ///////////// Requests from outside ///////////
    function resetTime() {
        startTime = new Date();
        timeLeft = settings.startingTimeLeft;
        timeLine = [];
        startTimeLine();

        var info = {
            timeLeft:timeLeft,
            startTime:+startTime,
            wastingTime:wastingTime,
            url:url,
            title:title
        };
        sendContent("reset", info);
    }

    function makeTabVIP(tab) {
        clearTimeout(tempVIPtimer);
        finishTab = false;
        VIPtab = tab || tabId;
    }

    function VIP(tab) {
        makeTabVIP(tab);
        tempVIPstartTime = 0;
        timeLeftOutput();
    }

    //VIP until pagechange
    function finish(tab) {
        wasteStreak++;
        VIP(tab);
        //startTime only changes on newPage
        finishTab = true;
    }

    function tempVIP() {
        //so that you can't auto finish from temps
        refreshTimeline();
        makeTabVIP();
        tempVIPstartTime = +new Date();
        tempVIPtimer = setTimeout(function() {
            VIPtab = -1;
            tempVIPstartTime = 0;
        }, settings.VIPlength);
        timeLeftOutput();
    }

    // change wastingTime, supposed to be for when afk on a page
    function change(timeLineIndex) {
        if (timeLineIndex === -1) {
            if (new Date() - startTime < settings.minChange) {
                return;
            }
            if (wastingTime) {
                //change the current one and restart counter
                sendContent("change", [timeLineIndex, wastingTime]);
                wastingTime = 0;
                refreshTimeline();
            }
        } else {
            if (timeLine[timeLineIndex] < settings.minChange) {
                return;
            }
            modifyTimeLine("change", timeLineIndex);
        }
        returnTime();
        timeLeftOutput();
        wasteStreak++;
    }

    function zero() {
        var now = +new Date();
        var currentNo = checkNoBlock(now);
        var end = now + settings.zeroLength;
        //if not a schedule block
        if (isFinite(currentNo[0]) && !currentNo[2]) {
            //extend current no block
            currentNo[1] = end;
        } else {
            addNoBlock(now, now + settings.zeroLength);
        }
        timeLeftOutput();
        noBlockReminder();
    }

    function antizero() {
        var now = +new Date();
        var currentNo = checkNoBlock(now);
        //if not a schedule block
        if (isFinite(currentNo[0]) && !currentNo[2]) {
            currentNo[1] = now;
            //TODO better way to do this, for now redo entire thing
            sendContent("stopNoBlock", noBlocks);
        }
        timeLeftOutput();
        noBlockReminder();
    }
});
