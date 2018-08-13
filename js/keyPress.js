var keyPressInit;
var addPhrase;
var addPhrases;
var addNumberListener;
(function() {
    var holderId = "#chromeTools_keyPress";
    var phrases = [];
    var numberListeners = [];

    var currentPhrase = 0;
    var phraseIndex = 0;
    var allowMistakes = false;

    keyPressInit = function(container) {
        phrases = [];
        container.prepend("<div id='chromeTools_keyPress'></div>");

        container.attr("tabindex", 1).keydown(function(e) {
            e.stopPropagation();
            // ignore if ctrl or alt are being pressed (for outside shortcuts)
            if (e.ctrlKey || e.altKey) {
                return;
            }
            if (currentPhrase) {
                //get ascii value of next part
                if (e.keyCode === currentPhrase[0].charCodeAt(phraseIndex)) {
                    showHotkey(phraseIndex, true);
                    if (++phraseIndex === currentPhrase[0].length) {
                        $("#phrase").addClass("done");
                        var fnc = currentPhrase[1];
                        var waste = currentPhrase[3];
                        var num = currentPhrase[2] ? 1 : 0;
                        var size = currentPhrase[2] || currentPhrase[0].length;
                        clearHotkey();
                        if (waste || num) {
                            double(fnc, size, num, waste);
                        } else {
                            fnc();
                        }
                        disappearHotkey(1200);
                    }
                } else {
                    if (e.keyCode === 27 || e.keyCode === 13) {
                        //esc key or enter key
                        disappearHotkey();
                    } else {
                        showHotkey(phraseIndex, false);
                        if (!allowMistakes) {
                            clearHotkey();
                        }
                    }
                }
            } else  {
                var found = false;
                for (var i = 0 ; i < phrases.length ; i++) {
                    if (e.keyCode === phrases[i][0].charCodeAt(0)) {
                        if (phrases[i][0].length === 1) {
                            phrases[i][1]();
                        } else {
                            currentPhrase = phrases[i];
                            startShowHotkey(phrases[i][0], true);
                            phraseIndex = 1;
                        }
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    var num;
                    //check if is number key
                    if ((num = e.keyCode - 48, e.keyCode >= 48 && e.keyCode <= 57) ||
                        (num = e.keyCode - 96, e.keyCode >= 96 && e.keyCode <= 105)) {
                        for (var i = 0 ; i < numberListeners.length ; i++) {
                            if (!numberListeners[i][2]) {
                                numberListeners[i][0](num);
                                break;
                            }
                        }
                    } else {
                        for (var i = 0 ; i < numberListeners.length ; i++) {
                            if (numberListeners[i][1] && e.keyCode === numberListeners[i][1].charCodeAt(0)) {
                                numberListeners[i][2] = 0;
                                break;
                            }
                        }
                    }
                }
            }
        }).keyup(function(e) {
            for (var i = 0 ; i < numberListeners.length ; i++) {
                if (numberListeners[i][1] && e.keyCode === numberListeners[i][1].charCodeAt(0)) {
                    numberListeners[i][2] = 1;
                    break;
                }
            }
        });
    };

    //order matters in terms of what gets checked first
    //keep letters capitalized
    addPhrase = function(phrase, funct, hard) {
        phrases.push([phrase, funct, hard]);
    };

    addPhrases = function(array) {
        phrases = phrases.concat(array);
    };

    addNumberListener = function(funct, combo) {
        if (combo) {
            numberListeners.push([funct, combo, 1]);
        } else {
            numberListeners.push([funct]);
        }
    };

    function startShowHotkey(phrase, start) {
        var front = "<div id='phraseFront'>";
        var back = "<div id='phraseBack'>";
        for (var i = 0 ; i < phrase.length ; i++) {
            front += "<div id='phrase" + i + "' class='phrasePart'>" + phrase[i] + "</div>";
            back += "<div class='phrasePart'>" + phrase[i] + "</div>";
        }
        front += "</div>";
        back += "</div>";
        var html = "<div id='phrase'>" + front + back + "</div>";

        var holder = $(holderId);
        var parent = holder.parent();
        holder.html(html);
        var fontSize = 100;
        var widthMargin = 40;    //don't want text to hug the sides
        var maxWidth = parent.width() - widthMargin;
        if (maxWidth < holder.width()) {
            fontSize = Math.floor(fontSize / (holder.width() / maxWidth));
            $(".phrasePart").css("font-size", fontSize);
        }
        //center display
        var leftOffset = (parent.innerWidth() - holder.outerWidth())/2;
        var topOffset = (parent.innerHeight() - holder.outerHeight())/2;
        //can use css transforms to center, but that makes it blurry
        holder.css("left", leftOffset).css("top", topOffset);

        if (start) {
            $("#phrase0").addClass("filled");
        }
        disappearHotkey(1200);
    }

    function showHotkey(index, correct) {
        if (correct) {
            $("#phrase" + index).addClass("filled").removeClass("failed");
            disappearHotkey(1200);
        } else {
            $("#phrase" + index).addClass("failed");
            disappearHotkey(800);
        }
    }

    var disappearInterval;
    var disappearTimeout;
    function disappearHotkey(time) {
        clearInterval(disappearInterval);
        clearTimeout(disappearTimeout);
        if (time > 0) {
            var opacity = 0.8;
            $("#phrase").css("opacity", opacity);
            if (!allowMistakes) {
                var disapperTime = 500;
                //start disappearing after 0.5 secs
                disappearTimeout = setTimeout(function() {
                    if (time > disapperTime) {
                        var delay = (time - disapperTime) / opacity / 100;
                        disappearInterval = setInterval(function() {
                            opacity -= 0.01;
                            $("#phrase").css("opacity", opacity);
                            if (opacity <= 0) {
                                clearInterval(disappearInterval);
                                removeHotkey();
                            }
                        }, delay);
                    } else {
                        removeHotkey();
                    }
                }, disapperTime);
            }
        } else {
            removeHotkey();
        }
    }

    function removeHotkey() {
        $("#phrase").remove();
        clearHotkey();
    }

    function clearHotkey() {
        currentPhrase = 0;
        phraseIndex = 0;
        allowMistakes = false;
    }

    function double(funct, length, num, waste) {
        //add another test
        sendRequest("randomWord", [length - 2, length + 2, num, waste], function(random) {
            var rec = () => {
                if (random.length) {
                    var phrase = random.pop().toUpperCase();
                    currentPhrase = [phrase, rec];
                    startShowHotkey(phrase, false);
                } else {
                    funct();
                }
            };
            rec();
        });
    }

    //send requests to background
    function sendRequest(action, input, callback) {
        chrome.runtime.sendMessage({
            from: "browserAction",
            action: action,
            input: input
        }, callback);
    }
})();
