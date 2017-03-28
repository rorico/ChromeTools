chrome.runtime.getBackgroundPage(function (backgroundPage) {
    var ringingAlarms = [];
    var background = backgroundPage;
    var typeColors = backgroundPage.typeColors;
    var defaultColor = backgroundPage.defaultColor;
    var alarms = background.alarms;
    var numMaxAlarms = background.numMaxAlarms;

    var html = "";
    for (var i = 0 ; i < numMaxAlarms ; i++) {
        html += "<div id='alarm" + i + "' class='alarm notSet'><div class='alarmTitle'>" + (i + 1) + "</div><div id='alarmText" + i + "' class='alarmData'>Not Set</div></div>";
    }
    $("#alarms").html(html);

    for (var i = 0 ; i < alarms.length ; i++) {
        var alarm = alarms[i];
        if (alarm && alarm.state) {
            showAlarm(alarm.alarmTime,i,alarm.type);
            if (alarm.state == 2) {
                showRinging(i);
            }
        }
    }

    keyPressInit($("body"));
    timeLineInit($("#timeLineH"),background);

    //last one isn't really alarms, but grouping here
    var alarmPhrases = [["S",setAlarmKey],["A",stopAllAlarms],["X",snooze]];
    addPhrases(alarmPhrases);

    addNumberListener(function(num) {
        removeAlarm(num - 1);  //0 index
    },"D");
    addNumberListener(changeTimer);

    alertLogs();

    var youtubeButton;
    youtubeDisplay();

    //automatically close window after a period of time
    //due to alt tabbing out of game to close alarm multiple times and expecting it not to be open
    //if browserAction becomes more than alarm, remove this
    //consider also making a certain time after last action
    setTimeout(function() {
        window.close();
    },60000);//1 minute

    //list entries in format [ele, enable] or ele, depending on enable
    function topButton(list,symbol,side,enable,clickCallback) {
        var obj = {
            list:list,
            cnt:0,
            state:1,
            destructor:destructor,
            restart:fullDisplay
        };
        var cls = "";
        if (side === "right") {
            cls = " right";
        }
        var button = $("<div class='topButton block" + cls + "'>" + symbol + "</div>");
        $("body").prepend(button);
        button.width(button.height());
        button.click(function(e) {
            e.stopPropagation();
            if (obj.state === 1) {
                fullDisplay();
            } else if (obj.state === 2) {
                closeDisplay();
            }
        });
        $("body").click(function() {
            if (obj.state === 2) {
                closeDisplay();
            }
        });

        return obj;

        function fullDisplay() {
            obj.state = 2;
            var allEle = $("<div></div>");
            obj.cnt = 0;
            for (var i = 0 ; i < obj.list.length ; i++) {
                var info;
                if (enable) {
                    if (obj.list[i][1]) {
                        info = obj.list[i][0];
                    } else {
                        continue;
                    }
                } else {
                    info = obj.list[i];
                }
                var ele = $("<div class='log block'>" + info + "</div>");
                setClick(ele,i);
                allEle.append(ele);
                obj.cnt++;
            }
            button.html(allEle);
            //20 is 2 * margin
            button.outerWidth($("body").width() - 20);
        }

        function closeDisplay() {
            obj.state = 1;
            button.html(symbol);
            button.width(button.height());
        }

        function setClick(ele,i) {
            ele.click(function(e){
                e.stopPropagation();
                clickCallback(i);
                this.remove();
                obj.cnt--;
                if (!obj.cnt) {
                    destructor();
                }
            });
        }

        function destructor() {
            obj.state = 0;
            button.remove();
        }
    }

    function alertLogs() {
        var logs = background.allLogs;
        var numUnread = background.numUnread;
        if (numUnread) {
            topButton(logs,"!","left",true,function(index) {
                sendRequest("removeLog",i);
            })
        }
    }

    function youtubeDisplay() {
        var youtube = background.youtubeVideoNames;
        if (youtubeButton) {
            youtubeButton.list = youtube;
            if (youtube.length) {
                if (youtubeButton.state === 2) {
                    youtubeButton.restart();
                }
            } else {
                youtubeButton.destructor();
                youtubeButton = null;
            }
        } else {
            if (youtube.length) {
                //play symbol, may want to change
                youtubeButton = topButton(youtube,"&#9658;","right",false,function(index) {
                    sendRequest("youtube",index);
                });
            }
        }
    }

    ////////////////////////events//////////////////////////////
    $("#timerButton").click(setTimer);
    function setTimer() {
        var delay = +$("#setTimer").val();
        setAlarm(delay);
    }

    var time = new Date();
    var currentTimer = "";
    function changeTimer(digit) {
        var now = new Date();
        if (now-time < 1000) {
            currentTimer += digit.toFixed(0);
            //limit to 3 digits
            if (currentTimer.length > 3) {
                currentTimer = currentTimer.substring(1);
            }
            $("#setTimer").val(currentTimer);
        } else {
            currentTimer = digit;
            $("#setTimer").val(currentTimer);
        }
        time = new Date();
    }

    function setAlarmKey() {
        setAlarm(+$("#setTimer").val());
    }

    function setAlarm(delay) {
        sendRequest("setAlarm",delay);
    }

    function removeAlarm(alarmNumber) {
        if (alarmNumber >= 0 && alarmNumber < 5) {
            sendRequest("removeAlarm",alarmNumber);
        }
    }

    function stopAllAlarms() {
        sendRequest("stopAllAlarms");
    }

    function snooze() {
        sendRequest("snooze");
    }

    //send requests to background
    function sendRequest(action,input) {
        chrome.runtime.sendMessage({
            from: "browserAction",
            action: action,
            input: input,
        });
    }

    //get from background to display
    chrome.runtime.onMessage.addListener(function(a, b, c) {
        if (a.from === "background") {
            switch(a.action) {
                case "setAlarm":
                    var input = a.input;
                    showAlarm(new Date(input[1]),input[0],input[2]);
                    break;
                case "removeAlarm":
                    var input = a.input;
                    showRemove(input[0],input[1]);
                    break;
                case "ringing":
                    showRinging(a.input);
                    break;
                case "youtube":
                    youtubeDisplay();
                    break;
            }
        }
    });

    function showAlarm(date,alarmNumber,type) {
        var time = date.toLocaleTimeString();
        $("#alarmText" + alarmNumber).html("Alarm at " + time);
        $("#alarm" + alarmNumber).removeClass("notSet").css({"color":typeColors[type],"border-color":typeColors[type]}).bind("click",function() {
            removeAlarm(alarmNumber);
        });
    }

    function showRemove(alarmNumber,type) {
        $("#alarmText" + alarmNumber).html("Not Set").css("visibility","visible");
        clearInterval(ringingAlarms[alarmNumber]);
        $("#alarm" + alarmNumber).addClass("notSet").unbind("click").css({"color":defaultColor,"border-color":defaultColor});
    }

    function showRinging(alarmNumber) {
        var visibility = "hidden";
        ringingAlarms[alarmNumber] = setInterval(function() {
            visibility = (visibility === "hidden" ? "visible" : "hidden");
            $("#alarmText" + alarmNumber).css("visibility",visibility);
        },300);
    }
});
