//wrapper for the setTimeout, especially for long delays
//setTimeout doesn't seem to work when computer sleeps, or if the computer is slow,
//chrome.alarms doesn't seem to have these problems

var timerThreshold = 300000; // 5 minutes
var timerQueue = [];
var curTimerId = 0;
var timerHandlers = [];

function setTimer(funct,delay) {
    if (!delay || delay < timerThreshold) {
        timerHandlers[++curTimerId] = [0,setTimeout(funct,delay)];
        return curTimerId;
    } else {
        var index = 0;
        var runTime = +new Date() + delay;
        for (var i = 0 ; i < timerQueue.length ; i++) {
            if (runTime < timerQueue[i][1]) {
                break;
            } else {
                index++;
            }
        }
        timerQueue.splice(index,0,[++curTimerId,runTime,funct]);
        if (!index) {
            //if using alarms for anything else, change clearAll
            chrome.alarms.clearAll();
            chrome.alarms.create("timer",{when:runTime});
        }
        timerHandlers[curTimerId] = [1];
        return curTimerId;
    }
}

function clearTimer(handlerId) {
    var thisHandle = timerHandlers[handlerId];
    if (thisHandle) {
        if (thisHandle[0]) {
            //want a better way to do this
            //can use another array, but will likely have more overhead due to low use of this
            for (var i = 0 ; i < timerQueue.length ; i++) {
                if (handlerId === timerQueue[i][0]) {
                    timerQueue.splice(i,1);
                    if (i === 0 && timerQueue.length) {
                        chrome.alarms.clearAll();
                        chrome.alarms.create("timer",{when:timerQueue[0][1]});
                    }
                    break;
                }
            }
        } else {
            clearTimeout(thisHandle[1]);
        }
    }
}

chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name === "timer") {
        var threshold = +new Date() + timerThreshold;
        var cnt = 0;
        for (var i = 0 ; i < timerQueue.length ; i++) {
            if (timerQueue[i][1] < threshold) {
                //change the handler to how it would be when creating a timeout, so it can be cleared properly
                timerHandlers[timerQueue[i][0]] = [0,setTimeout(timerQueue[i][2],timerQueue[i][1] - new Date())];
                cnt++;
            } else {
                break;
            }
        }
        timerQueue.splice(0,cnt);
        if (timerQueue.length) {
            chrome.alarms.create("timer",{when:timerQueue[0][1]});
        }
    }
});