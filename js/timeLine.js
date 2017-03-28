var timeLineInit;
(function(){
    var timeLineId = "chromeTools_timeLine";
    var timeLeft;
    var startTime;
    var wastingTime;
    var url;
    var title;
    var timeCurrent;
    var countDownTimer = -1;

    var timeLine;
    var timeLineLength;
    var parentWidth = 360;      //keep unchanged
    var timeLineLeft = parentWidth;
    var offset = 0;
    var currentTimePiece = -1;
    var timeLineOffset = 0;
    var updateTimeLineInterval = -1;
    var timeCurrentInterval = -1;

    //for setup key presses
    keyPhrases = [["ZYXWVUTSRQPONMLKJIHGFEDCBA",resetTimeLine],
                    ["VIP",VIP,18],
                    ["FINISH",finish,10],
                    ["CHANGE",change,6],
                    ["TEMP",tempVIP],
                    ["NO",zero],
                    ["MO",antizero,8],
                    ["O",skipAd],
                    ["P",youtube]];

    //this is the global scope
    timeLineInit = init;

    function init(container,background) {
        parentWidth = calcWidth(container.width());

        var top = "<div id='axisTop'>";
        var bot = "<div id='axisBot'>";
        for (var i = 0 ; i < 6 ; i++) {
            top += "<div class='axisPart top" + (i === 5 ? " end" : "") + "'></div>";
            bot += "<div class='axisPart bot" + (i === 5 ? " end" : "") + "'></div>";
        }
        top += "</div>";
        bot += "</div>";
        var html = "<div id='" + timeLineId + "'><div id='timeLeft'></div><div id='timeLineHolder'>" + top + "<div id='timeLine'></div>" + bot + "</div><div id='info'></div></div>";
        container.append(html);

        $(".axisPart").outerWidth(parentWidth/6);

        timeLineLength = background.timeLineLength;
        setTimeLine(background);
        countDown(timeLeft);

        // setup keypress
        addPhrases(keyPhrases);

        //need this when modal is moved
        timeLineResize = function() {
            var newWidth = calcWidth(container.width());
            if (newWidth !== parentWidth) {
                parentWidth = newWidth;
                $(".axisPart").outerWidth(parentWidth/6);
                $("#timeLine").empty();
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
        timeCurrent = new Date() - startTime;
        //if empty, assume reset
        //deep copy to not affect it outside of function call
        timeLine = background.timeLine ? JSON.parse(JSON.stringify(background.timeLine)) : [];
        $("#timeLine").empty();
        timeLineCreate();
    }

    function timeLineCreate() {
        timeLineLeft = parentWidth;
        offset = 0;
        currentTimePiece = -1;
        timeLineOffset = 0;
        timeCurrent = new Date() - startTime;

        if (addTimeLine(-1,false,timeCurrent,wastingTime)) {
            for (var i = 0; i < timeLine.length ; i++) {
                if (!addTimeLine(i,false,timeLine[i][0],timeLine[i][1])) {
                    break;
                }
            }
            //fill in rest
            addTimeLine(-2,false);
        }
        displayInfo(-1);
        updateTimeLine();
    }

    //returns true if not done
    function addTimeLine(index,first,time,wastingTime) {
        var width = 0;
        if (index === -2) {
            width = timeLineLeft;
        } else {
            width = time/timeLineLength * parentWidth + offset;
        }
        offset = width % 1;
        width = Math.floor(width);
        //if smaller than 1px, don't bother adding, unless at very start or end (these will change size)
        if (width < 1 && index !== -1) {
            offset += width;
            return true;
        }
        var ret = true;
        if (width >= timeLineLeft) {
            width = timeLineLeft;
            timeLineLeft = 0;
            ret = false;
        } else {
            timeLineLeft -= width;
        }

        var classes = "timeLine";
        if (index !== -2) {
            classes += " wasting" + wastingTime;
            if (width >= 3) {
                classes += " timeLineBlock";
            }
        }

        var timeLineEntry = $("<div style='width:" + width + "px;' class='" + classes + "' id='" + getTimeLineId(index) + "'></div>");
        if (first) {
            $("#timeLine").append(timeLineEntry);
        } else {
            $("#timeLine").prepend(timeLineEntry);
        }

        if (index !== -2) {
            setClick(timeLineEntry,getIndex(index));
        }
        return ret;
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
                $("#timeSpend").html(MinutesSecondsFormat(timeCurrent,true));
            } else {
                info = formatInfo(url,timeCurrent,title);
                $("#info").html(info);
            }
            timeCurrentInterval = setTimeout(function() {
                displayInfo(i,true);
            },delay);
        } else {
            info = formatInfo(timeLine[i][2],timeLine[i][0],timeLine[i][3]);
            $("#info").html(info);
        }
    }

    function changeTimeLine(index,prev) {
        $("#" + getTimeLineId(index)).removeClass("wasting" + prev).addClass("wasting0");
    }

    function newPage(input) {
        startTime = input.startTime;
        wastingTime = input.wastingTime;
        url = input.url;
        title = input.title;
        timeLine.unshift(input.newest);
        timeLineOffset++;
        addTimeLine(-1,true,new Date() - startTime,wastingTime);
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
        $("#timeLeft").html(MinutesSecondsFormat(time,false));
        if (wastingTime && time>0) {
            var delay = (time-1)%1000+1;
            countDownTimer = setTimeout(function() {
                countDownFunction(time - delay);
            },delay);
        }
    }

    function updateTimeLine() {
        clearInterval(updateTimeLineInterval);
        var delay = timeLineLength/parentWidth;
        updateTimeLineInterval = setInterval(function() {
            var newEle = $("#timeLine div:last-child");
            newEle.width(newEle.width() + 1);
            if (!newEle.hasClass("timeLineBlock") && newEle.width() >= 3) {
                newEle.addClass("timeLineBlock");
            }
            var oldestEle = $("#timeLine div:first-child");
            //oldest has 0 width, remove
            //note if div has no children (ie removed), need length check, or will run into infinite loop
            while(oldestEle.length && oldestEle.width() <= 0) {
                oldestEle.remove();
                oldestEle = $("#timeLine div:first-child");
            }
            oldestEle.width(oldestEle.width() - 1);
            if (oldestEle.hasClass("timeLineBlock") && oldestEle.width() < 3) {
                oldestEle.removeClass("timeLineBlock");
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

    function youtube() {
        sendRequest("youtube");
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