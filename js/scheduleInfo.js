var scheduleInfo;
var date = new Date();
var today;
var timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
setScheduleInfo();

addMessageListener({
    "resetSchedule": setScheduleInfo,
    "weekSchedule": function(a,b,c) {
        weekSchedule(a.input,c);
    }
});


var scheduleListeners = [];
function addScheduleListener(funct) {
    scheduleListeners.push(funct);
}

function setScheduleInfo() {
    chrome.storage.sync.get("scheduleInfo", function(items) {
        if (chrome.runtime.lastError) {
            log(chrome.runtime.lastError);
        }
        if (items.scheduleInfo) {
            scheduleInfo = items.scheduleInfo;
            today = todaySchedule(date);
        } else {
            scheduleInfo = [];
            today = [];
        }
        for (var i = 0 ; i < scheduleListeners.length ; i++) {
            scheduleListeners[i](today);
        }
    });
}

var todaySchedule = (function() {
    return todaySchedule;
    function todaySchedule(date) {
        var today = [];
        for (var i = 0 ; i < scheduleInfo.length ; i++) {
            var course = scheduleInfo[i];
            var types = course[1];
            for (var j = 0 ; j < types.length ; j++) {
                var type = types[j];
                var classes = type[1];
                for (var k = 0 ; k < classes.length ; k++) {
                    var cls = classes[k];
                    if (sameDOW(date,cls[1][0])&&isInRange(date,cls[2])) {
                        today.push([cls[0],cls[1],course[0],type[0]]);
                    }
                }
            }
        }
        today.sort(sort_by_date);
        return today;
    }

    function sameDOW(date,DOW) { //same day of week
        var dayOfWeek = (new Date(date)).getDay();
        return DOW.indexOf(dayOfWeek) > -1;
    }

    function isInRange(date,range) {
        // convert from date/timestamp to YYYY-MM-DD
        var da = new Date(date-timezoneOffset).toISOString().split("T")[0];
        // this is an alphabetic compare
        return (da >= range[0] && da <= range[1]);
    }

    function newCall(Cls) {
        return new (Function.prototype.bind.apply(Cls, arguments));
    }

    function sort_by_date(a,b) {
        if (a[1][1] < b[1][1]) return -1;
        if (a[1][1] > b[1][1]) return 1;
        return 0;
    }
})();

function weekSchedule(dates,callback) {
    var ret = [];
    for (var i = 0 ; i < dates.length ; i++) {
        ret.push(todaySchedule(dates[i]));
    }
    callback(ret);
}
