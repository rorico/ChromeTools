//alarms in the form of {state, alarm time, type, destructor}
//types : 0 - regular
//        1 - sleep alarm
//        2 - block alert
var alarms = [];
var numMaxAlarms = 3;

var typeColors = ["#0000FF", "#008000", "#FF0000"];   //["blue", "green", "red"];
var defaultColor = "#000000";   //black
var alarmCnt = 0;
var ringingCnt = 0;
var alarmTypeCnt = [0, 0, 0];
var alarmTypeMax = -1;
var audio = new Audio("/alarm.mp3");
audio.loop = true;
var playAlarmCheck = false;   //true if any alarm is currently ringing

chrome.browserAction.setBadgeBackgroundColor({color:defaultColor});

//set alarm for every half hour after 10pm
//sets alarm when it rings so can't stop before
var sleepAlarmStart = 22;   //10pm
var sleepAlarmEnd = 6;      //6am
var sleepAlarmTimer;
setSleepAlarm();

addMessageListener({
    "stopAllAlarms": function(a) {
        stopAllAlarms(a.input);
    },
    "snooze": snooze,
    "setAlarm": function(a) {
        setAlarm(a.input, 0);
    },
    "removeAlarm": function(a) {
        removeAlarm(a.input);
    }
});

function setSleepAlarm(five) {
    var newAlarm = new Date();
    newAlarm.setSeconds(0);
    newAlarm.setMinutes(toNearest(newAlarm.getMinutes(), five ? 5 : 30));
    if (!inSleepRange(newAlarm)) {
        newAlarm.setHours(sleepAlarmStart);
        newAlarm.setMinutes(0);
    }
    // show 5 minutes beforehand, allow user to cancel beforehand.
    var preTime = 5 * 60 * 1000;
    var delay = newAlarm - new Date() - preTime;

    clearTimer(sleepAlarmTimer);
    sleepAlarmTimer = setTimer(function() {
        // if computer sleeps or something, this runs a lot later, check if it's past end time
        var date = new Date();
        if (date < newAlarm && inSleepRange(newAlarm)) {
            setAlarm((newAlarm - date) / 60000, 1);
        }
    }, delay);
    function inSleepRange(date) {
        return date.getHours()>=sleepAlarmStart || date.getHours()<=sleepAlarmEnd;
    }
    function toNearest(num, quot) {
        return Math.floor(num / quot)*quot + quot
    }
}

// delay in minutes
function setAlarm(delay, type) {
    for (var i = 0 ; i < numMaxAlarms ; i++) {
        var alarm = alarms[i];
        if (!alarm) {
            var alarmTime = new Date();
            alarmTime = new Date(alarmTime + delay*60000);
            var alarmObj = {
                state: 1,
                alarmTime: alarmTime,
                type: type
            };
            setRing(alarmObj, i, delay);

            alarmCnt++;
            alarmTypeCnt[type]++;

            //display highest type color
            if (type > alarmTypeMax) {
                chrome.browserAction.setBadgeBackgroundColor({color:typeColors[type]});
                alarmTypeMax = type;
            }
            alarms[i] = alarmObj;
            sendRequest("setAlarm", [i, +alarmTime, type]);
            return;
        }
    }
}

function setRing(alarmObj, alarmNumber, delay) {
    var timeout;    //hold this outside for destructor
    var ringer = setTimer(function() {
        ringingCnt++;
        alarmObj.state = 2;
        playAlarmCheck = true;
        sendRequest("ringing", alarmNumber);
        //don't ring if chrome is closed
        //likely want to change the way this is done later
        chrome.windows.getAll(function(windows) {
            if (windows.length && alarms[alarmNumber] === alarmObj) {
                audio.play();

                //sleep auto snoozes
                if (alarmObj.type === 1) {
                    var date = new Date();
                    // alarm lasts longer the more into the night it goes
                    var amount = 5 * ((date.getHours() - sleepAlarmStart + 25) % 24);
                    amount += (date.getMinutes() % 30) / 5;

                    timeout = setTimeout(function() {
                        removeAlarm(alarmNumber, alarmObj.type);
                        setSleepAlarm(true);
                    }, amount * 1000);
                } else if (alarmObj.type === 2) {
                    timeout = setTimeout(function() {
                        removeAlarm(alarmNumber, alarmObj.type);
                    }, audio.duration * 1000);
                }
            }
        });
    }, delay * 60000);
    alarmObj.destructor = function() {
        // removing sleep alarm, set to next half hour
        if (alarmObj.type === 1) {
            setSleepAlarm();
        }
        clearTimer(ringer);
        clearTimeout(timeout);
    };
}

//returns true if alarm is removed
function removeAlarm(alarmNumber, type) {
    //unspecified type is a catchall,
    //type 2 needs specific call
    var alarm = alarms[alarmNumber];
    if (alarm && ((typeof type === "undefined" && alarm.type !== 2) || alarm.type == type)) {
        alarmTypeCnt[alarm.type]--;
        //if no alarms left
        if (!--alarmCnt) {
            alarmTypeMax = -1;
            chrome.browserAction.setBadgeBackgroundColor({color:defaultColor});
        } else {
            //update highest alarm color
            for (var i = alarmTypeMax ; i >= 0 ; i--) {
                if (alarmTypeCnt[i]) {
                    alarmTypeMax = i;
                    chrome.browserAction.setBadgeBackgroundColor({color:typeColors[i]});
                    break;
                }
            }
        }
        //check if ringing
        if (playAlarmCheck && alarm.state===2) {
            //if no alarms ringing, turn off sound
            if (!--ringingCnt) {
                playAlarmCheck = false;
                audio.pause();
                audio.currentTime = 0;
            }
        }

        alarm.destructor();
        alarms[alarmNumber] = undefined;
        sendRequest("removeAlarm", [alarmNumber, alarm.type]);
        return true;
    }
    return false;
}

//returns true if any alarms are stopped
function stopAllAlarms(type) {
    var ret = false;
    if (playAlarmCheck) {
        for (var i = 0 ; i < alarms.length ; i++) {
            if (alarms[i] && alarms[i].state === 2) {
                ret |= removeAlarm(i, type);
            }
        }
    }
    return ret;
}

function snooze() {
    //if any alarms are stopped, set another in 5 minutes;
    if (stopAllAlarms()) {
        setAlarm(5, 0);
    }
}
