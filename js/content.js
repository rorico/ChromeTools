var blockId = "chromeTools_block";
var hidden = false;
var blockObj;
var oldFocus;
var removeTimer;

var blockScreen = $("<div id='" + blockId + "'></div>");
$("body").append(blockScreen);
$(document).on("webkitfullscreenchange", function() {
    if (!hidden) {
        move(document.webkitFullscreenElement || document.getElementsByTagName("body")[0]);
    }
});

function prepare(type, info) {
    if (currentType(type, info)) {
        blockObj.prepare(info);
    }
}

// can be many tabs with this open, delete after a while to lessen load
// shouldn't be noticeable for blocking
function setRemove() {
    clearTimeout(removeTimer);
    removeTimer = setTimeout(() => {
        if (hidden) {
            remove();
        } else {
            setRemove();
        }
    // hardcode 10 minutes for now
    }, 10 * 60 * 1000);
}

function remove() {
    blockScreen.empty().off();
    blockObj = null;
}

function block(type, info, callback) {
    var appendTo;
    //assuming this is run on chrome
    var full = document.webkitFullscreenElement;
    if (full) {
        //can't append to iframes, so just force close fullscreen
        if (full.tagName === "IFRAME") {
            document.webkitExitFullscreen();
        } else {
            appendTo = full;
        }
    } else {
        appendTo = document.getElementsByTagName("body")[0];
    }
    move(appendTo);

    if (currentType(type, info)) {
        blockObj.update(info);
    }
    //hold focus to give back when unblocking
    oldFocus = document.activeElement;
    blockScreen.addClass("display").focus();
    hidden = false;
    callback(true);
    return false;
}

function move(toContainer) {
    if (blockScreen.parent().get()[0] !== toContainer) {
        blockScreen.detach().appendTo(toContainer).focus();
        //blockObj may not have been initialized yet
        blockObj && blockObj.resize();
    }
}

function currentType(type, info) {
    if (blockObj && blockObj.type === type) {
        return true;
    } else {
        init(type, info);
        return false;
    }
}

function init(type, info) {
    clearTimeout(removeTimer);
    blockScreen.empty().off();
    blockObj = {type:type};
    var nullFunct = function() {};
    if (type === "time") {
        if (typeof timeLineInit === "undefined" || typeof keyPressInit === "undefined" || typeof iframe === "undefined") {
            console.log(type + " content script missing");
        } else {
            var key = keyPressInit(blockScreen);
            var time = timeLineInit(blockScreen, info);
            var frame = iframe(blockScreen, info);
            blockObj.update = function(info) {
                time.update(info);
            };
            blockObj.prepare = function(info) {
                frame.update(info);
            };
            blockObj.resize = function() {
                time.resize();
                frame.resize();
            };
        }
    } else {
        if (typeof scheduleInit === "undefined") {
            console.log(type + " content script missing");
        } else {
            info.weekSchedule = weekSchedule;
            var obj = scheduleInit(blockScreen, info);
            blockObj.update = nullFunct;
            blockObj.prepare = nullFunct;
            blockObj.resize = obj.resize;
        }
    }
    $(window).resize(blockObj.resize);
}

function unblock() {
    blockScreen.removeClass("display").blur();
    if (oldFocus) {
        oldFocus.focus();
    }
    hidden = true;
    setRemove();
}

//same paramaters as background, works the same
function weekSchedule(dates, callback) {
    sendRequest("weekSchedule", dates, callback);
}

chrome.runtime.onMessage.addListener(function listener(a, b, c) {
    switch (a.action) {
        case "prepare":
            prepare(a.type, a.info);
            break;
        case "block":
            return block(a.type, a.info, c);
        case "unblock":
            unblock();
            c(true);
            break;
        case "ping":
            var blockTypes = {
                time:typeof timeLineInit !== "undefined",
                schedule:typeof scheduleInit !== "undefined"
            };
            c(blockTypes);
            break;
    }
});

//send requests to background
function sendRequest(action, input, callback) {
    chrome.runtime.sendMessage({
        from: "content",
        action: action,
        input: input
    }, callback);
}
