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

function key(keyCode) {
    var e = new KeyboardEvent("keydown", {
        keyCode: keyCode,
        which: keyCode
    })
    document.getElementById("movie_player").dispatchEvent(e);
}

chrome.runtime.onMessage.addListener(function listener(a, b, c) {
    switch (a.action) {
        case "getState":
            c(getState());
            break;
        case "key":
            key(a.input);
            break;
        case "skipAd":
            c(skipAd());
            break;
        case "listen":
            listen(c);
            return true;
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