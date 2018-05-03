var timeLineInit;
(function(){
    var timeLineId = "chromeTools_timeLine";
    var timeLeft;
    var startTime;
    var wastingTime;
    var url;
    var title;
    var timeCurrent;
    var noBlocks;
    var countDownTimer = -1;
    var SMALL = 2;

    var timeLine;
    var timeLineLength;
    var parentWidth = 360;      //keep unchanged
    var timeLineLeft = parentWidth;
    var offset = 0;
    var currentTimePiece = -1;
    var timeLineOffset = 0;
    var updateTimeLineInterval = -1;
    var timeCurrentInterval = -1;

    var find;

    //for setup key presses
    var keyPhrases = [["RESET",resetTimeLine,20,true],
                    ["VIP",VIP,18,true],
                    ["FINISH",finish,15,true],
                    ["CHANGE",change,10,true],
                    ["TEMP",tempVIP,0,true],
                    ["NO",zero],
                    ["MO",antizero,8],
                    ["P",skipAd],
                    ["K",youtubeK],
                    ["J",youtubeJ],
                    ["L",youtubeL]];

    //this is the global scope
    timeLineInit = init;

    function init(container,background) {
        var start = new Date();
        find = function(sel) {
            return container.find(sel);
        }

        parentWidth = calcWidth(container.width());

        var top = "<div id='axisTop' class='axisHold'>";
        var bot = "<div id='axisBot' class='axisHold'>";
        for (var i = 0 ; i < 6 ; i++) {
            top += "<div class='axisPart'></div>";
            bot += "<div class='axisPart'></div>";
        }
        top += "</div>";
        bot += "</div>";

        var center = "<div id='timeLine'>";
        //0 is last, so its on top
        for (var i = 2 ; i >= 0 ; i--) {
            center += "<div id='timeLines-" + i + "'></div>";
        }
        center += "</div>";
        var html = "<div id='" + timeLineId + "'><div id='timeLeft'></div><div id='timeLineHolder'>" + top + center + bot + "</div><div id='info'></div></div>";
        container.append(html);

        find(".axisPart").outerWidth(parentWidth/6);

        timeLineLength = background.settings.timeLineLength;
        setTimeLine(background);
        countDown(timeLeft);

        // setup keypress
        addPhrases(keyPhrases);

        //need this when modal is moved
        timeLineResize = function() {
            var newWidth = calcWidth(container.width());
            if (newWidth !== parentWidth) {
                parentWidth = newWidth;
                find(".axisPart").outerWidth(parentWidth/6);
                find("#timeLine > div").empty();
                timeLineCreate();
            }
        };


        //get from background to display
        chrome.runtime.onMessage.addListener(function(a, b, c) {
            if (a.from === "background") {
                switch(a.action) {
                    case "timer":
                        countDown(a.input);
                        break;
                    case "change":
                        var input = a.input;
                        changeTimeLine(input[0],input[1]);
                        break;
                    case "reset":
                        setTimeLine(a.input);
                        break;
                    case "newPage":
                        newPage(a.input);
                        break;
                    case "addNoBlock":
                        changeNoBlock(a.input);
                        break;
                    case "stopNoBlock":
                        changeNoBlock(a.input);
                        break;
                }
            }
        });
        return {
            resize: timeLineResize,
            update: setTimeLine
        };
    }

    function calcWidth(width) {
        //add some padding, and make multiple of 60
        return Math.floor((width - 30) / 60) * 60;
    }

    function setTimeLine(background) {
        timeLeft = background.timeLeft;
        startTime = background.startTime;
        wastingTime = background.wastingTime;
        url = background.url;
        title = background.title;
        noBlocks = background.noBlocks || [];
        timeCurrent = new Date() - startTime;
        //if empty, assume reset
        //deep copy to not affect it outside of function call
        timeLine = background.timeLine ? JSON.parse(JSON.stringify(background.timeLine)) : [];
        find("#timeLine > div").empty();
        timeLineCreate();
    }

    function timeLineCreate() {
        var now = new Date();
        var oldest = now - timeLineLength;
        timeLineLeft = parentWidth;
        offset = 0;
        currentTimePiece = -1;
        timeLineOffset = 0;
        timeCurrent = new Date() - startTime;
        var $timeLine = find("#timeLines-0");
        var timelineHtml = ""

        if (add(-1,startTime,timeCurrent,wastingTime)) {
            var last;
            for (var i = 0; i < timeLine.length ; i++) {
                if (!add(i,timeLine[i][4],timeLine[i][0],timeLine[i][1])) {
                    last = timeLine[i][4];
                    break;
                }
            }
            if (!last) {
                var lastTime = timeLine[timeLine.length-1];
                //only really happens if no timeline
                last = lastTime ? lastTime[4] : now;
            }
            if (last > oldest) {
                //fill in rest
                add(-2,oldest,last - oldest);
            }
        }
        find("#timeLines-2").append(timelineHtml);
        addNoBlocks();
        displayInfo(-1);
        updateTimeLine();

        //returns true if not done
        function add(index,start,time,wastingTime) {
            var ret = true;
            if (start < oldest) {
                time +=  start - oldest;
                ret = false;
            }
            timelineHtml = (addTimeLine(index,time,wastingTime,false,true) || "") + timelineHtml;
            return ret;
        }
    }
    //returns true if not done
    function addTimeLine(index,time,wastingTime,first,html) {
        var classes = (index === -2 ? "" : "wasting" + wastingTime);
        var block = getBlock(index,time,classes,getTimeLineId(index));

        if (block) {
            var copy = $(block).removeAttr("id").addClass("placeholder");
            if (index !== -2) {
                setClick(copy,getIndex(index));
                copy.removeClass(classes);
            }
            appendBlock(find("#timeLines-0"),copy,first);
            if (html) {
                return block;
            } else {
                appendBlock(find("#timeLines-2"),block,first);
            }
        }
    }

    function addBlock(holder,index,time,classes,id,first) {
        var block = $(getBlock(index,time,classes,id));
        appendBlock(holder,block,first);
        return block;
    }

    function getBlock(index,time,classes,id) {
        // add a rounding error of 0.1
        var width = timeToWidth(time) + offset + 0.1;
        offset = width % 1 - 0.1;
        width = Math.floor(width);
        //if smaller than 1px, don't bother adding, unless at very start or end (these will change size)
        if (width < 1 && index !== -1) {
            return;
        }

        classes = classes ? classes + " timeLine" : "timeLine";
        if (width >= SMALL) {
            classes += " timeLineBlock";
        }
        return "<div style='width:" + width + "px;' class='" + classes + (id ? "' id='" + id : "") + "'></div>";
    }

    function appendBlock(holder,entry,first) {
        if (first) {
            holder.append(entry);
        } else {
            holder.prepend(entry);
        }
    }

    function timeToWidth(time) {
        return time/timeLineLength * parentWidth;
    }

    function getIndex(index) {
        return index - timeLineOffset;
    }

    function getTimeLineId(index) {
        return (index === -2 ? "timeLineP" : "timeLine" + getIndex(index));
    }

    function setClick(ele,i) {
        ele.click(function() {
            currentTimePiece = i + timeLineOffset;
            displayInfo(currentTimePiece);
        });
        ele.hover(function() {
            displayInfo(i + timeLineOffset);
        },function() {
            displayInfo(currentTimePiece);
        });
    }

    function displayInfo(i,repeat) {
        clearTimeout(timeCurrentInterval);
        var info = "";
        if (i === -1) {
            timeCurrent = new Date() - startTime;
            var delay = 1000 - (timeCurrent%1000);
            if (repeat) {
                find("#timeSpend").html(MinutesSecondsFormat(timeCurrent,true));
            } else {
                info = formatInfo(url,timeCurrent,title);
                find("#info").html(info);
            }
            timeCurrentInterval = setTimeout(function() {
                displayInfo(i,true);
            },delay);
        } else {
            info = formatInfo(timeLine[i][2],timeLine[i][0],timeLine[i][3]);
            find("#info").html(info);
        }
    }

    function changeTimeLine(index,prev) {
        find("#" + getTimeLineId(index)).removeClass("wasting" + prev).addClass("wasting0");
    }

    function addNoBlocks() {
        if (noBlocks.length) {
            offset = 0;
            var $timeLine = find("#timeLines-1").addClass("offset");
            var now = new Date();
            var start = now - timeLineLength;
            var end = start;
            var first = noBlocks[0];
            if (first[0] < start) {
                $timeLine.css("left","-" + timeToWidth(start - first[0]) + "px");
                start = first[0];
            } else {
                $timeLine.css("left",0);
            }
            for (var i = 0; i < noBlocks.length ; i++) {
                var block = noBlocks[i];
                if (start < block[0]) {
                    addBlock($timeLine,-1,block[0] - start,"placeholder","",true);
                    start = block[0];
                    end = block[1];
                } else if (start < block[1]) {
                    end = block[1];
                } else {
                    //this means its envelopped in another block
                    continue;
                }
                var ele = addBlock($timeLine,-1,end - start,"noBlock","",true);
                var color = "blue";
                var info = block[2];
                if (info) {
                    //TODO: change this based on class later
                    color = "red";
                    var startI = 2;
                    do {
                        var text = info[2].slice(0,startI).join(" - ");
                        ele.html(text);
                        startI--;
                        //if text is too large for div
                    } while(ele[0].scrollWidth > ele.width());
                }
                ele.css({"border-color":color});
                start = end;
            }
        }
    }

    function changeNoBlock(nos) {
        noBlocks = nos;
        find("#timeLines-1").empty();
        addNoBlocks();
    }

    function newPage(input) {
        startTime = input.startTime;
        wastingTime = input.wastingTime;
        url = input.url;
        title = input.title;
        timeLine.unshift(input.newest);
        timeLineOffset++;
        addTimeLine(-1,0,wastingTime,true);
        displayInfo(-1);
    }

    function countDown(timeLeft) {
        if (wastingTime) {
            timeLeft -= new Date() - startTime;
        }
        if (timeLeft < 0) {
            timeLeft = 0;
        }
        clearTimeout(countDownTimer);
        countDownFunction(timeLeft);
    }

    //not exactly accurate, not too important
    function countDownFunction(time) {
        find("#timeLeft").html(MinutesSecondsFormat(time,false));
        if (wastingTime && time>0) {
            var delay = (time-1)%1000+1;
            countDownTimer = setTimeout(function() {
                countDownFunction(time - delay);
            },delay);
        }
    }

    function updateTimeLine() {
        clearInterval(updateTimeLineInterval);
        //this is used for sort of caching, making sure that overall changes are affected by small errors
        var oldestEles = [];
        var oldestWidths = [];
        var newestEles = [];
        var newestWidths = [];
        var delay = timeLineLength/parentWidth;
        //TODO Fix if the entire thing is 1 thing
        // use outerwidth, width doesn't seem to account for border-box
        updateTimeLineInterval = setInterval(function() {
            var timeLines = find("#timeLine > div");
            for (var j = 0 ; j < timeLines.length ; j++) {
                var holder = $(timeLines[j]);
                var timeLine = holder.children();
                if (holder.hasClass("offset")) {
                    //assume in px
                    holder.css("left",parseInt(holder.css("left")) - 1);
                } else if (timeLine.length) {
                    //get first and last element, and they widths
                    for (var i = 0 ; i < timeLine.length ; i++) {
                        var oldest = $(timeLine[i]);
                        if (!oldest.is(oldestEles[j])) {
                            oldestEles[j] = oldest;
                            oldestWidths[j] = oldestEles[j].outerWidth();
                        }
                        if (oldestWidths[j]) {
                            break;
                        } else {
                            oldest.remove();
                        }
                    }
                    var newest = timeLine.last();
                    if (!newest.is(newestEles[j])) {
                        newestEles[j] = newest;
                        newestWidths[j] = newestEles[j].outerWidth();
                    }

                    //if the entire thing is 1 block, don't change anything, size stays constant
                    if (!oldestEles[j].is(newestEles[j])) {
                        oldestWidths[j]--;
                        oldestEles[j].outerWidth(oldestWidths[j]);
                        if (oldestEles[j].hasClass("timeLineBlock") && oldestEles[j].width() < SMALL) {
                            oldestEles[j].removeClass("timeLineBlock");
                        }
                        newestWidths[j]++;
                        newestEles[j].outerWidth(newestWidths[j]);
                        if (!newestEles[j].hasClass("timeLineBlock") && newestWidths[j] >= SMALL) {
                            newestEles[j].addClass("timeLineBlock");
                        }
                    }
                }
            }
        },delay);
    }

    function formatInfo(url,time,title) {
        return "<div class='ellipsis'>" + title + "</div>" + 
                "<div class='ellipsis'>" + url + "</div>" + 
                "Time spent: <span id='timeSpend'>" + MinutesSecondsFormat(time,true) + "</span>";
    }

    function MinutesSecondsFormat(milli,up) {
        var secs = up ? Math.floor(milli/1000) : Math.ceil(milli/1000);
        return Math.floor(secs/60)  + ":" + ("0" + Math.floor(secs%60)).slice(-2);
    }

    function resetTimeLine() {
        sendRequest("resetTime");
    }

    function VIP() {
        sendRequest("VIP");
    }
    
    function finish() {
        sendRequest("finish");
    }

    function change() {
        sendRequest("change",currentTimePiece);
    }

    function tempVIP() {
        sendRequest("temp");
    }

    function zero() {
        sendRequest("zero");
    }

    function antizero() {
        sendRequest("antizero");
    }

    function youtubeJ() {
        sendRequest("youtube","J");
    }
    function youtubeK() {
        sendRequest("youtube","K");
    }
    function youtubeL() {
        sendRequest("youtube","L");
    }

    function skipAd() {
        sendRequest("skipAd");
    }

    //send requests to background
    function sendRequest(action,input) {
        chrome.runtime.sendMessage({
            from: "browserAction",
            action: action,
            input: input
        });
    }
})();