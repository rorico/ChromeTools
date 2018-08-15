var p;
youtubeNewPage();

//youtube is special in that new urls don't actual reload page
//http://stackoverflow.com/a/18398921
document.addEventListener('transitionend', function(e) {
    if (e.target.id === 'progress') {
        // do stuff
        youtubeNewPage();
    }
});

function youtubeNewPage() {
    p = window.document.getElementsByTagName("video")[0];
    if (p) {
        p.onended = function() {
            //if was just an ad, won't pause it
            setTimeout(function() {
                if (p.paused) {
                    sendRequest("youtubeEnd");
                }
            }, 100);
        };
    }
}

function skipAd() {
    var adSkip = document.getElementsByClassName("videoAdUiSkipButton")[0];
    if (adSkip) {
        adSkip.click();
        return true;
    }
    return false;
}

function pause() {
    if (!p.paused) {
        p.pause();
        return true;
    }
    return false;
}

function play() {
    if (p.paused) {
        p.play();
        return true;
    }
    return false;
}

function changeTime(dir) {
    //simulate youtube j and l keys
    p.currentTime = p.currentTime + dir*10;
}

// not this doesn't change volume bar
function changeVolume(dir) {
    p.volume = p.volume + dir*0.05;
}

function getState() {
    if (p.paused) {
        return "pause";
    }
    return "play";
}

function listen(c) {
    p.onplay = function() {
        c();
        p.onplay = null;
        window.onbeforeunload = null;
    };
    //don't really need to undo this, its right as the page ends
    window.onbeforeunload = c;
}

chrome.runtime.onMessage.addListener(function listener(a, b, c) {
    switch (a.action) {
        case "pause":
            c(pause());
            break;
        case "play":
            c(play());
            break;
        case "skipAd":
            c(skipAd());
            break;
        case "forward":
            changeTime(1);
            break;
        case "back":
            changeTime(-1);
            break;
        case "getState":
            c(getState());
            break;
        case "listen":
            listen(c);
            return true;
        case "changeVolume":
            changeVolume(a.input);
            break;
    }
});

//send requests to background
function sendRequest(action, input) {
    chrome.runtime.sendMessage({
        from: "content",
        action: action,
        input: input
    });
}