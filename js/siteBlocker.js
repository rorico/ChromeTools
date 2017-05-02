//set global variables, these are likely used by browserAction
var startTime = new Date();
var wastingTime = false;
var url = "";
var title = "";
var timeLeft = 0;
var timeLine = [];
var timeLineLength;

//functions
var isBlocked;

(function(){
    var tabId = -2;
    var windowId = -3;
    var returnTimer;
    var VIPtab = -1;
    var tempVIPtimer = -1;
    var tempVIPstartTime = 0;
    var finishTime = 0;
    var zeroMode = false;
    var zeroTimer = -1;
    var nextTime = 0;
    var classes = [];
    var classStart = Infinity;
    //sites that will block after time spent
    var urls = [[
        "*://reddit.com/*","*://*.reddit.com/*",
        "http://threesjs.com/"
    ],
    //sites that will spend time but not actively block
    [
        "*://*.youtube.com/*",
        "*://imgur.com/*","*://*.imgur.com/*"
    ]];

    timeLineLength = 1800000; // 30 mins
    var startingTimeLeft = 300000; // 5 mins
    var secondLimit = 300000; //5 mins
    var VIPlength = 20000; // 20s
    var zeroLength = 1800000; // 30 mins
    var tolerance = 2000; // 2s
    var quickTabTime = 400; // 0.4s
    if (0) { // if in testing mode
        timeLineLength = 120000; // 2 mins
        startingTimeLeft = 60000; // 1 mins
    }
    timeLeft = startingTimeLeft;
    
    //functions in their own closure
    var blockTab;
    var unblockSite;
    var sendContent;
    var getBlockedUrl;

    addMessageListener({
        "VIP": VIP,
        "finish": finish,
        "resetTime": resetTime,
        "change": function(a) {
            change(a.input);
        },
        "temp": tempVIP,
        "zero": zero,
        "antizero": antizero
    });
    addScheduleListener(setupClass);

    //set-up first time when opened
    startTimeLine();

    //gets run when schedule gets loaded in ScheduleInfo.js
    function setupClass(today) {
        var now = new Date();
        var position = UTCtoMilitary(now);
        for (var i = 0 ; i < today.length ; i++) {
            if (position < today[i][0][2]) {
                classes.push([today[i][0][1],today[i][0][2]]);
            }
        }
        if (classes.length) {
            classStart = militaryToUTC(classes[0][0]);
            classReminder(classStart - now - startingTimeLeft);
        }
    }

    //for before class, show how much time left
    function classReminder(delay) {
        if (classes.length) {
            setTimer(function() {
                var time = classStart - new Date() - timeLeft;
                //if timing is off
                if (time > 0) {
                    classReminder(time);
                } else {
                    var keepGoing = true;
                    var now = new Date();
                    var position = UTCtoMilitary(now);
                    if (position > classes[0][1]) {
                        classes.splice(0,1);
                        if (classes.length) {
                            classStart = militaryToUTC(classes[0][0]);
                            time = classStart - now - startingTimeLeft;
                        } else {
                            //could go to next day, for now, don't do that
                            classStart = Infinity;
                            keepGoing = false;
                        }
                    } else {
                        time = militaryToUTC(classes[0][1]) - now;
                    }
                    timeLeftOutput();
                    if (keepGoing) {
                        classReminder(time);
                    }
                }
            },delay);
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

    function UTCtoMilitary(time) {
        return time.getHours()*60 + time.getMinutes();
    }

    function startTimeLine() {
        chrome.tabs.query({active:true}, function(tabs) {
            if (tabs.length) {
                var activeTab = tabs[0];
                tabId = activeTab.id;
                windowId = activeTab.windowId;
                handleNewPage(activeTab.url,activeTab.title);
            }
        });
    }

    chrome.tabs.onActivated.addListener(function(activeInfo) {
        tabId = activeInfo.tabId;
        chrome.tabs.get(activeInfo.tabId, function(tab) {
            handleNewPage(tab.url,tab.title);
        });
    });

    chrome.tabs.onUpdated.addListener(function(id, changeInfo, tab) {
        if (tabId === id && changeInfo) {
            if (changeInfo.status === "loading") {
                handleNewPage(tab.url,tab.title);
            } else if (changeInfo.title) {
                title = changeInfo.title;
            }
        }
    });


    chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId) {
        if (removedTabId === VIPtab) {
            VIPtab = addedTabId;
        }
    });

    chrome.windows.onFocusChanged.addListener(function(id) {
        //due to browserAction triggering this, gonna have to workaround it
        if (id === chrome.windows.WINDOW_ID_NONE) {
            //handleNewPage("","Outside Chrome");
        } else {
            if (windowId !== id) {
                chrome.tabs.query({windowId:id,active:true}, function(tabs) {
                    if (tabs.length) {
                        var activeTab = tabs[0];
                        tabId = activeTab.id;
                        handleNewPage(activeTab.url,activeTab.title);
                    } else {
                        log("window empty tab");
                    }
                });
            }
            windowId = id;
        }
    });

    function handleNewPage(newUrl,newTitle) {
        //handle previous page
        var newWasting = matchesURL(newUrl);
        var timeSpent = new Date() - startTime;
        //if small time spent on wasting, don't count
        if (timeSpent < tolerance) {
            wastingTime = 0;
        }
        var newest = [timeSpent,wastingTime,url,title,+startTime];
        modifyTimeLine("add",newest);
        if (wastingTime) {
            changeTimeLeft(-timeSpent);
            //don't want to slow down event handler
            setTimeout(function() {
                storeData("timeLine",newest);
            },0);
        }
        //handle new page
        startTime = new Date();     //consider converting to integer right here
        wastingTime = newWasting;
        url = newUrl;
        title = newTitle;
        timeLeftOutput();

        //to browserAction, doesn't happen often, but can happen
        var info = {
            newest:newest,
            startTime:+startTime,
            wastingTime:wastingTime,
            url:url,
            title:title
        };
        sendContent("newPage",info);

        //check for returnTime to be more up to date
        if (startTime > nextTime + tolerance) {
            returnTime();
        }
    }

    //checks all levels and returns the level of url if matched, 0 if none
    function matchesURL(url) {
        for (var lvl = 0 ; lvl < urls.length ; lvl++) {
            for (var i = 0 ; i < urls[lvl].length ; i++) {
                if (new RegExp("^" + urls[lvl][i].replace(/\./g,"\\.").replace(/\*/g, ".*") + "$").test(url)) {
                    return lvl + 1;
                }
            }
        }
        return 0;
    }

    //timeLine acts as an object
    function modifyTimeLine(action,load) {
        if (action === "add") {
            timeLine.unshift(load);
        } else if (action === "remove") {
            timeLine.splice(load[0],load[1]);
        } else if (action === "change") {
            if (load < timeLine.length || load < 0) {
                if (timeLine[load][1]) {
                    sendContent("change",[load,timeLine[load][1]]);
                    timeLine[load][1] = 0;
                    changeTimeLeft(timeLine[load][0]);
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
            sendContent("timer",timeLeft);
            var displayTime = timeLeft - (wastingTime ? new Date() - startTime : 0);
            //give wastingTime 2 more time, but do not show in badge
            //note the returntime isn't optimized to for this, but that should be fine.
            //also, need to handle blocked pages
            var thisWasting = isBlocked() ? matchesURL(getBlockedUrl()) : wastingTime;
            var time = displayTime + (thisWasting === 2 ? secondLimit : 0);
            var endTime = 0;
            var countDown = wastingTime;
            var blockType = "time";

            if (VIPtab === tabId && !tempVIPstartTime && !(finishTime && !checkFinish())) {
                //if tempVIPstartTime is not set, VIP isn't temp
                //if finishTime is set, but checkFinish is false, isn't actually VIP
                displayTime = time = Infinity;
                countDown = false;
            } else if (time > classStart - new Date()) {
                displayTime = time = classStart - new Date();
                countDown = true;
                blockType = "schedule";
            } else if (zeroMode) {
                displayTime = time = 0;
            }

            //don't even bother if more time left than limit
            var VIPtimeLeft = VIPlength - new Date() + tempVIPstartTime;
            if (VIPtab === tabId && time < VIPtimeLeft) {
                //if not wasting time, vip will countDown, but stop when reach timeLeft
                if (!countDown && !wastingTime && time > endTime) {
                    endTime = time;
                }
                displayTime = time = VIPtimeLeft;
                countDown = true;
                //when this turns to 0, will not show actual time left, may want to fix this later
            }
            blockTab(time,countDown,blockType);
            countDownTimer(displayTime,endTime,countDown);
        }

        function countDownTimer(time,endTime,countDown) {
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
                        },1000);
                    }
                },delay);
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
                return Math.floor(secs/60)  + ":" + ("0" + Math.floor(secs%60)).slice(-2);
            }
        }
    })();

    (function() {
        var blockTimer = -1;
        var blockedTab = -2;
        var blocked = false; //hold whether the tab should currently be blocked
        var blockType;
        var blockedUrl;
        var blockedTitle;

        //sets a reminder when timeLeft reaches 0, and blocks site
        blockTab = function(time,countDown,blockType) {
            //do not unblock the site if tab hasn't changed and still no timeLeft
            if (tabId !== blockedTab || time > 0) {
                unblockSite();
            }
            clearTimeout(blockTimer);
            if (countDown && wastingTime) {
                if (time < tolerance) {
                    time = tolerance;
                }
                block(tabId,time,blockType);
            }
        };

        function block(tabId,time,blockType) {
            var start = +new Date();
            var delay = Math.max(time - tolerance,quickTabTime);
            blockTimer = setTimeout(function() {
                //note, won't inject if already injected
                injectScripts(tabId,blockType,function(ready) {
                    if (ready) {
                        var elapsed = +new Date() - start;
                        blockSite(tabId,blockType,time - elapsed);
                    }
                });
            },delay);
        }

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
            function injectScripts(tab,blockType,callback) {
                //see if the page is already injected, and what type
                var data = {action:"ping"};
                chrome.tabs.sendMessage(tab,data,function(blockTypes) {
                    var injectTypes;
                    if (blockTypes) {
                        //if there, but wrong block type
                        if (!blockTypes[blockType]) {
                            injectTypes = [blockType];
                        }
                    } else {
                        //if not there, inject
                        //want content.js to be last, jquery order doesn't matter until files are called
                        injectTypes = ["all",blockType];
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
                                injectScripts(tab,blockType,callback);
                            });
                        } else {
                            injecting = true;
                            addContentScript(tab,list,0,function(ready) {
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

            function addContentScript(tab,list,i,callback) {
                var file = list[i];
                var inject = file.substring(file.lastIndexOf(".")) === ".js" ? chrome.tabs.executeScript : chrome.tabs.insertCSS;
                inject(tab,{file:file},function() {
                    if (chrome.runtime.lastError) {
                        //this happens a lot due to closing of tab
                        //don't show front end
                        console.log(chrome.runtime.lastError);
                        callback(false);
                        return;
                    }
                    i++;
                    if (list.length === i) {
                        callback(true);
                    } else {
                        addContentScript(tab,list,i,callback);
                    }
                });
            }
        })();

        function blockSite(tab,type,blockTime) {
            if (tab === tabId) {
                //iframes need time to load, load beforehand if can
                var info = {};
                if (type === "time") {
                    info = {
                        //just for setup
                        timeLineLength: timeLineLength,
                        iframeInfo: iframeInfo,
                        delay: blockTime
                    };
                }
                var data = {action:"prepare",info:info,type:type};
                chrome.tabs.sendMessage(tab,data);

                blockTimer = setTimeout(function() {
                    //if in the time to block, tab changes, don't block
                    if (tab === tabId) {
                        blockedTab = tab;
                        blocked = true;
                        blockType = type;
                        if (blockType === "time") {
                            info = {
                                timeLeft: timeLeft,
                                startTime: +startTime,
                                wastingTime: wastingTime,
                                url: url,
                                title: title,
                                timeLine: timeLine,
                                timeLineLength: timeLineLength
                            };
                        }
                        data = {action:"block",info:info,type:type};
                        chrome.tabs.sendMessage(tab,data,function(blocked) {
                            //when page is actually blocked, update timeline
                            if (blocked && tab === tabId) {
                                blockedUrl = url;
                                blockedTitle = title;
                                handleNewPage("Blocked","Blocked");
                                storeData("redirect",[+new Date(),url]);
                            }
                        });
                    }
                },blockTime);
            }
        }

        unblockSite = function() {
            if (blockedTab !== -2) {
                sendContent("unblock",null,true);
                blockedTab = -2;
                blocked = false;

                if (isBlocked()) {
                    handleNewPage(blockedUrl,blockedTitle);
                }
            }
        };

        sendContent = function(action,input,content) {
            //only send to content scripts
            if (!content) {
                sendRequest(action,input);
            }
            if (blockedTab !== -2) {
                chrome.tabs.sendMessage(blockedTab,sendFormat(action,input));
            }
        };

        isBlocked = function() {
            //I'm just gonna assume there is no usual url named "Blocked"
            return url === "Blocked";
        }

        getBlockedUrl = function() {
            return blockedUrl;
        }
    })();

    function returnTime() {
        var date = new Date() - timeLineLength;
        var endingIndex = -1;
        var cnt = 0;
        var timeTotal = 0;
        var currentTimeInterval = new Date() - startTime;
        var currentTimeOffset = (wastingTime ? currentTimeInterval : 0);
        //remove anything after limit
        for (var i = timeLine.length - 1 ; i != -1 ; i--) {
            //endtime is same as next starttime
            var endTime = (i ? timeLine[i-1][4] : +timeLine[i][4] + timeLine[i][0]);
            if (date > endTime) {
                if (timeLine[i][1]) {
                    timeLeft += timeLine[i][0];
                }
                cnt++;
            } else {
                //note if going through entire array, this will never run
                timeTotal = timeLine[i][4] - date; //negative
                endingIndex = i;
                break;
            }
        }
        if (endingIndex === -1) {
            timeTotal = startTime - date; //negative
        }

        if (cnt) {
            modifyTimeLine("remove",[endingIndex + 1,cnt]);
        }

        //return time and calculate when to call function again
        //ideally check again when can return time again
        var completed = false;
        for (var i = endingIndex ; i != -1 ; i--) {
            if (timeLine[i][1]) {
                //note timeLeft can be negative
                if (timeLeft - currentTimeOffset > timeTotal) {
                    modifyTimeLine("change",i);
                } else {
                    completed = true;
                    break;
                }
            }
            timeTotal += timeLine[i][0];
        }
        //if reach end of the list, add current time
        if (!completed) {
            timeTotal += currentTimeInterval;
        }
        timeLeftOutput();
        //upper limit can be passed if currently in very long wastingTime
        var nextDelay = Math.min(timeTotal - timeLeft + currentTimeOffset,timeLineLength - startingTimeLeft);
        //used to make sure that this is called at appropriate times
        nextTime = +new Date() + nextDelay;
        clearTimer(returnTimer);
        returnTimer = setTimer(returnTime,nextDelay);
    }

    ///////////// Requests from outside ///////////
    function resetTime() {
        startTime = new Date();
        timeLeft = startingTimeLeft;
        timeLine = [];
        startTimeLine();

        var info = {
            timeLeft:timeLeft,
            startTime:+startTime,
            wastingTime:wastingTime,
            url:url,
            title:title
        };
        sendContent("reset",info);
    }

    function makeCurrentTabVIP() {
        clearTimeout(tempVIPtimer);
        finishTime = 0;
        VIPtab = tabId;
    }

    function VIP() {
        makeCurrentTabVIP();
        tempVIPstartTime = 0;
        timeLeftOutput();
    }

    //VIP until pagechange
    function finish() {
        VIP();
        //startTime only changes on newPage
        finishTime = startTime;
    }

    function checkFinish() {
        if (finishTime === startTime) {
            return true;
        } else {
            finishTime = 0;
            VIPtab = -1;
            return false;
        }
    }

    function tempVIP() {
        makeCurrentTabVIP();
        tempVIPstartTime = +new Date();
        tempVIPtimer = setTimeout(function() {
            VIPtab = -1;
            tempVIPstartTime = 0;
        },VIPlength);
        timeLeftOutput();
    }

    function change(timeLineIndex) {
        if (timeLineIndex === -1) {
            if (wastingTime) {
                //change the current one and restart counter
                sendContent("change",[timeLineIndex,wastingTime]);
                wastingTime = 0;
                handleNewPage(url,title);
            }
        } else {
            modifyTimeLine("change",timeLineIndex);
        }
        returnTime();
        timeLeftOutput();
    }

    function zero() {
        clearTimer(zeroTimer);
        zeroMode = true;
        timeLeftOutput();
        zeroTimer = setTimer(function() {
            zeroMode = false;
        },zeroLength);
    }

    function antizero() {
        clearTimer(zeroTimer);
        zeroMode = false;
        timeLeftOutput();
    }
})();