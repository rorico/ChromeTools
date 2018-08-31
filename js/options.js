chrome.runtime.getBackgroundPage(function(backgroundPage) {
    var processRedirect;
    var processTimeLine;
    (function() {
        var hourAmount = 3600000; //num of millisec
        var defaultZoom = 604800000; //1 week
        processRedirect = function(typeData, level) {
            var options = {
                yAxis: {
                    title: {
                        text: "Number of Redirects"
                    }
                }
            };

            var res = histogram(typeData, (t) => {
                return [
                    nearestHour(t[0]),
                    getWebsiteName(t[1], level, t[2])
                ];
            });

            var series = res[0];
            var zoom = res[1];
            return {series:series, zoom:zoom, options:options};
        };

        processTimeLine = function(typeData, level) {
            var options = {
                yAxis: {
                    title: {
                        text: "Time Spent"
                    },
                    labels: {
                        formatter: function() {
                            return MinutesSecondsFormat(this.value);
                        }
                    }
                },
                tooltip: {
                    pointFormatter: function() {
                        //copied from default with value format changed
                        return "<span style='color:" + this.color + "'>\u25CF</span> " + this.series.name + ": <b>" + MinutesSecondsFormat(this.y) + "</b><br/>";
                    }
                }
            };
            var res = histogram(typeData, (t) => {
                return [
                    t[0],
                    level === 3 ? "Wasting Level " + t[2] : getWebsiteName(t[3], level, t[4]),
                    t[1]
                ];
            });

            var series = res[0];
            var zoom = res[1];
            return {series:series, zoom:zoom, options:options};
        };

        function histogram(data, getProps) {
            var series = [];
            var zoom = [];
            if (data && data.length) {
                var hist = {};
                data.map((a) => getProps(a)).sort((a, b) => {
                    if (a[0] > b[0]) {
                        return 1;
                    }
                    return -1;
                }).forEach((t) => {
                    var time = t[0];
                    var name = t[1];
                    var amount = t[2];

                    if (!hist[name]) {
                        hist[name] = [[nearestHour(time) - hourAmount, 0]];
                    }
                    if (amount) {
                        addTimeLineEntry(hist[name], time, amount);
                    } else {
                        addEntry(hist[name], time, 1);
                    }
                });

                var last = -Infinity;
                var first = Infinity;
                series = Object.keys(hist).map((name) => {
                    var d = hist[name];
                    //add a 0 after end of data
                    var lastEntry = d[d.length-1][0];
                    d.push([lastEntry + hourAmount, 0]);

                    if (lastEntry > last) {
                        last = lastEntry;
                    }

                    var firstEntry = d[0][0];
                    if (firstEntry < first) {
                        first = firstEntry;
                    }

                    return {name:name, data:d};
                });
                zoom = [first < last - defaultZoom ? last - defaultZoom : first, last];
            }
            return [series, zoom];
        }

        function addEntry(data, hour, amount) {
            var pastTime = data[data.length-1][0];
            if (hour === pastTime) {
                data[data.length-1][1] += amount;
            } else {
                if (hour-pastTime > hourAmount) {
                    data.push([pastTime + hourAmount, 0]);
                    data.push([hour - hourAmount, 0]);
                }
                data.push([hour, amount]);
            }
        }

        function addTimeLineEntry(data, time, amount) {
            var hour = nearestHour(time);
            var nextHour = hour + hourAmount;

            while (amount > 0) {
                var thisAmount;
                if (time + amount > nextHour) {
                    thisAmount = nextHour - time;
                } else {
                    thisAmount = amount;
                }
                addEntry(data, hour, thisAmount);
                amount -= thisAmount;
                time = nextHour;
                hour += hourAmount;
                nextHour += hourAmount;
            }
        }

        function getWebsiteName(url, level, title) {
            url = (typeof url === "string" ? url : "unnamed");
            var ret = url;
            switch(level) {
                case 2:
                    ret = getBaseUrl(url);
                    break;
                case 1:
                    var base = getBaseUrl(url);
                    var lookFor = "reddit.com/r/";
                    var index = url.indexOf(lookFor);
                    if (index !== -1) {
                        var rest = url.substring(index + lookFor.length);
                        var slashIndex = rest.indexOf("/");
                        var subreddit = rest.substring(0, (slashIndex === -1 ? rest.length : slashIndex));
                        ret = base + " -> " + subreddit;
                    } else if (url.indexOf("youtube.com") !== -1 && title) {
                        ret = base + " -> " + title;
                    } else {
                        ret = base;
                    }
                    break;
                case 0:
                    ret = url;
                    break;
            }
            return ret;
        }

        function getBaseUrl(url) {
            var parts = url.split("/");
            if (parts[2]) {
                var subparts = parts[2].split(".");
                if (subparts[subparts.length - 2]) {
                    return subparts[subparts.length - 2];
                }
                return parts[2];
            }
            return url;
        }

        function nearestHour(utc) {
            var date = new Date(utc);
            date.setMinutes(0);
            date.setSeconds(0);
            date.setMilliseconds(0);
            return +date;
        }
    })();


    //start
    var getData = backgroundPage.getData;

    var dataTypes = [
        {name:"Wasting Time", key:"wasting", maxLevel:3, processData:processTimeLine},
        {name:"Site Blocks", key:"block", maxLevel:2, processData:processRedirect}
    ];
    var level;

    //set timezone offset for all graphs
    Highcharts.setOptions({
        global: {
            timezoneOffset: (new Date()).getTimezoneOffset()
        }
    });

    if (dataTypes.length) {
        var typeOptions = "";
        for (var i = 0 ; i < dataTypes.length ; i++) {
            var type = dataTypes[i].name;
            typeOptions += "<option value='" + i + "'>" + type + "</option>";
        }
        $("#dataType").html(typeOptions).change(function() {
            setChartType(dataTypes[this.value]);
        });

        // TODO lazy loading
        setChartType(dataTypes[0]);
    }


    //for iframe urls
    var iframeInfo = backgroundPage.iframeInfo;
    var scheduleInfo = backgroundPage.scheduleInfo;

    function submitSchedule(data) {
        chrome.storage.sync.set({"scheduleInfo": data});
        backgroundPage.setScheduleInfo();
    }
    liveChange("class", scheduleInfo, parseSchedule, submitSchedule);
    liveChange("iframe", iframeInfo, parseIframe, submitIframe);

    // other settings
    var defaults = backgroundPage.defaults;
    var settings = backgroundPage.settings;
    var userSettings = backgroundPage.userSettings;


    var $settings = $("#settings");
    for (var u in userSettings) {
        $settings.append(settingRow(u, userSettings[u]));
    }
    $settings.append(settingRow());

    function settingRow(setting, val) {
        var ele = $("<div></div>");
        var html = "<select class='setting'>";
        if (!setting) {
            html += "<option selected disabled></option>";
        }
        for (var d in defaults) {
            html += "<option value='" + d + "'" + (d === setting ? " selected" : "") + ">" + defaults[d][2] + "</option>";
        }
        html += "</select>";
        var select = $(html);
        ele.append(select);
        var input = $("<input type='text' class='val'" + (val ? " value='" + JSON.stringify(val) + "'" : "") + ">");
        ele.append(input);
        var notEmpty = () => {
            var del = $("<input type='button' class='del' value='&#10006;'>");
            ele.prepend(del.clone().addClass("placeholder"));
            del.click(function() {
                ele.remove();
            });
            ele.append(del);
        };
        var empty = !setting;
        if (!empty) {
            notEmpty();
        }
        select.change(function() {
            var key = select.val();
            if (defaults[key]) {
                var placeholder = defaults[key][1] == "json" ? JSON.stringify(defaults[key][0]) : defaults[key][0];
                if (empty) {
                    notEmpty();
                    input.attr("value", placeholder);
                    $("#settings").append(settingRow());
                }
                empty = false;
                input.attr("placeholder", placeholder);
            } else {
                input.removeAttr("placeholder");
            }
        });

        return ele;
    }
    $("#settings-submit").click(() => {
        var set = {};
        $("#settings").children().each(function() {
            var $this = $(this);
            var key = $($this.find(".setting")).val();
            var val = $($this.find(".val")).val();
            if (key && val) {
                var cast;
                switch (defaults[key][1]) {
                    case "int":
                    cast = +val;
                    break;
                    case "str":
                    cast = "" + val;
                    break;
                    case "json":
                    cast = JSON.parse(val);
                    break;
                    default:
                    cast = val;
                    break;
                }
                set[key] = cast;
            }
        });
        backgroundPage.updateSettings(set);
    });

    function liveChange(baseId, data, parser, submitCallback) {
        var before = $("#" + baseId + "-before");
        var after = $("#" + baseId + "-after");
        var submit = $("#" + baseId + "-submit");
        after.val(data ? JSON.stringify(data, null, 4) : "");
        before.change(function() {
            data = parser(before.val());
            after.val(JSON.stringify(data, null, 4));
        });
        submit.click(function() {
            var message;
            try {
                data = JSON.parse(after.val());
                submitCallback(data);
                message = "Submitted successfully";
            } catch(e) {
                message = "Error submitting";
            }
            //show it worked
            before.val(message);
        });
    }

    function parseIframe(text) {
        var each = text.split("\n");
        var ret = [];
        for (var i = 0 ; i < each.length ; i++) {
            var row = each[i].trim();
            var cols = row.split(" ");
            if (cols[0]) {
                var item = {
                    url: cols[0],
                    reload: cols[1] === "reload"
                };
                ret.push(item);
            }
        }
        return ret;
    }

    function submitIframe(data) {
        chrome.storage.sync.set({"iframeInfo": data});
        backgroundPage.setIframeInfo();
    }

    function setChartType(type) {
        level = type.maxLevel;
        var levelOptions = "";
        for (var i = 0 ; i <= level ; i++) {
            var selected = level === i ? " selected" : "";
            levelOptions += "<option value='" + i + "'" + selected + ">" + i + "</option>";
        }
        $("#nameLevel").html(levelOptions).off("change").change(function() {
            level = parseInt(this.value);
            getChartData(type);
        });

        if (type.data) {
            getChartData(type);
        } else {
            getData(type.key, function(items) {
                var thisData = [];
                Object.keys(items).sort().forEach(function(i) {
                    thisData = thisData.concat(items[i]);
                });
                type.data = thisData;
                getChartData(type);
            });
        }
    }

    function getChartData(type) {
        var res = type.processData(type.data, level);
        setChartData(res.series, res.zoom, res.options);
    }

    function setChartData(series, zoom, dataOptions) {
        if (series) {
            var options = {
                title: {
                    text: null
                },
                chart: {
                    renderTo: "highcharts",
                    zoomType: "x",
                    type: "column"
                },
                xAxis:{
                    type: "datetime"
                },
                series: series,
                plotOptions: {
                    area: {
                        fillColor: {
                            linearGradient: {
                                x1: 0,
                                y1: 0,
                                x2: 0,
                                y2: 1
                            },
                            stops: [
                                [0, Highcharts.getOptions().colors[0]],
                                [1, Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get("rgba")]
                            ]
                        },
                        marker: {
                            radius: 2
                        },
                        lineWidth: 1,
                        states: {
                            hover: {
                                lineWidth: 1
                            }
                        },
                        threshold: null
                    },
                    column: {
                        stacking: "normal",
                        pointPadding: 0,
                        borderWidth: 0
                    }
                }
            };
            for (var option in dataOptions) {
                options[option] = dataOptions[option];
            }
            var chart = new Highcharts.Chart(options);
            if (zoom) {
                chart.xAxis[0].setExtremes(zoom[0], zoom[1]);
                chart.showResetZoom();
            }
        }
    }
    function MinutesSecondsFormat(milli) {
        var secs = Math.floor(milli/1000);
        return Math.floor(secs/60)  + ":" + ("0" + Math.floor(secs%60)).slice(-2);
    }
});
