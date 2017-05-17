//alarms in the form of {state, alarm time, type, destructor}
//types : 0 - regular
//        1 - sleep alarm
//        2 - block alert
var alarms = [];
var numMaxAlarms = 3;

var typeColors = ["#0000FF","#33FFFF","#FF0000"];   //["blue","teal","red"];
var defaultColor = "#000000";   //black
var alarmCnt = 0;
var ringingCnt = 0;
var alarmTypeCnt = [0,0,0];
var alarmTypeMax = -1;
var audio = new Audio("/alarm.mp3");
audio.loop = true;
var playAlarmCheck = false;   //true if any alarm is currently ringing

chrome.browserAction.setBadgeBackgroundColor({color:defaultColor});

//set alarm for every half hour after 10pm
//sets alarm when it rings so can't stop before
var sleepAlarmStart = 22;   //10pm
var sleepAlarmEnd = 6;      //6am
setSleepAlarm();

addMessageListener({
    "stopAllAlarms": stopAllAlarms,
    "snooze": snooze,
    "setAlarm": function(a) {
        setAlarm(a.input,0);
    },
    "removeAlarm": function(a) {
        removeAlarm(a.input);
    }
});

function setSleepAlarm() {
    var date = new Date();
    date.setSeconds(0);
    date.setMinutes(Math.floor(date.getMinutes()/30)*30 + 30);
    if (date.getHours()<sleepAlarmStart && date.getHours()>sleepAlarmEnd) {
        date.setHours(sleepAlarmStart);
        date.setMinutes(0);
    }
    setTimer(function() {
        setAlarm(0,1);
        setSleepAlarm();
    },date - new Date());
}

function setAlarm(delay,type) {
    for (var i = 0 ; i < numMaxAlarms ; i++) {
        var alarm = alarms[i];
        if (!alarm) {
            var alarmTime = new Date();
            alarmTime.setMinutes(alarmTime.getMinutes() + delay);
            var alarmObj = {
                state: 1,
                alarmTime: alarmTime,
                type: type
            };
            setRing(alarmObj,i,delay);

            alarmCnt++;
            alarmTypeCnt[type]++;

            //display highest type color
            if (type > alarmTypeMax) {
                chrome.browserAction.setBadgeBackgroundColor({color:typeColors[type]});
                alarmTypeMax = type;
            }
            alarms[i] = alarmObj;
            sendRequest("setAlarm",[i,+alarmTime,type]);
            return;
        }
    }
}

function setRing(alarmObj,alarmNumber,delay) {
    var timeout;    //hold this outside for destructor
    var ringer = setTimer(function() {
        ringingCnt++;
        alarmObj.state = 2;
        playAlarmCheck = true;
        sendRequest("ringing",alarmNumber);
        //don't ring if chrome is closed
        //likely want to change the way this is done later
        chrome.windows.getAll(function(windows) {
            if (windows.length) {
                audio.play();

                //sleep auto snoozes
                if (alarmObj.type === 1) {
                    timeout = setTimeout(function() {
                        removeAlarm(alarmNumber,alarmObj.type);
                        setAlarm(5,1);
                    },5000);//5 seconds
                } else if (alarmObj.type === 2) {
                    timeout = setTimeout(function() {
                        removeAlarm(alarmNumber,alarmObj.type);
                    },audio.duration * 1000);
                }
            }
        });
    },delay * 60000);
    alarmObj.destructor = function() {
        clearTimer(ringer);
        clearTimeout(timeout);
    };
}

//returns true if alarm is removed
function removeAlarm(alarmNumber,type) {
    //unspecified type is a catchall,
    //type 2 needs specific call
    var alarm = alarms[alarmNumber];
    if (alarm && ((typeof type === "undefined" && alarm.type !== 2) || alarm.type == type)) {
        // this should be alarm.type
        alarmTypeCnt[type]--;
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
        sendRequest("removeAlarm",[alarmNumber,alarm.type]);
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
                ret |= removeAlarm(i,type);
            }
        }
    }
    return ret;
}

function snooze() {
    //if any alarms are stopped, set another in 5 minutes;
    if (stopAllAlarms()) {
        setAlarm(5,0);
    }
}
