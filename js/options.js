chrome.runtime.getBackgroundPage(function(backgroundPage) {
    var processRedirect;
    var processTimeLine;
    var minuteAmount = 60000; //num of millisec
    (function() {
        var defaultZoom = 604800000; //1 week
        processRedirect = function(typeData, level, interval) {
            var series = histogram(typeData, (t) => {
                return [
                    nearestInterval(t[0], interval),
                    getWebsiteName(t[1], level, t[2])
                ];
            }, interval);

            var options = {
                series: series,
                yAxis: {
                    title: {
                        text: "Number of Redirects"
                    }
                }
            };
            return options;
        };

        processTimeLine = function(typeData, level, interval) {
            var series = histogram(typeData, (t) => {
                return [
                    t[0],
                    level === 3 ? "Wasting Level " + t[2] : getWebsiteName(t[3], level, t[4]),
                    t[1]
                ];
            }, interval);

            var options = {
                series: series,
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

            return options;
        };

        function histogram(data, getProps, interval) {
            var series = [];
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
                        hist[name] = [[nearestInterval(time, interval) - interval, 0]];
                    }
                    if (amount) {
                        addTimeLineEntry(hist[name], time, amount, interval);
                    } else {
                        addEntry(hist[name], time, 1, interval);
                    }
                });

                series = Object.keys(hist).map((name) => {
                    var d = hist[name];
                    //add a 0 after end of data
                    var lastEntry = d[d.length-1][0];
                    d.push([lastEntry + interval, 0]);
                    return {name:name, data:d};
                });
            }
            return series;
        }

        function addEntry(data, hour, amount, interval) {
            var pastTime = data[data.length-1][0];
            if (hour === pastTime) {
                data[data.length-1][1] += amount;
            } else {
                if (hour-pastTime > interval) {
                    data.push([pastTime + interval, 0]);
                    data.push([hour - interval, 0]);
                }
                data.push([hour, amount]);
            }
        }

        function addTimeLineEntry(data, time, amount, interval) {
            var hour = nearestInterval(time, interval);
            var nextHour = hour + interval;

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
                hour += interval;
                nextHour += interval;
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

        function nearestInterval(utc, interval) {
            var minInterval = Math.floor(interval / minuteAmount);
            var date = new Date(utc);
            date.setMinutes(date.getMinutes() - (date.getMinutes() % minInterval));
            date.setSeconds(0);
            date.setMilliseconds(0);
            return +date;
        }
    })();


    //start
    var getData = backgroundPage.getData;

    //set timezone offset for all graphs
    Highcharts.setOptions({
        global: {
            timezoneOffset: (new Date()).getTimezoneOffset()
        }
    });

    // maintain zoom between different graphs
    var zoom = [,];

    var dataTypes = [
        {name:"Wasting Time", key:"wasting", maxLevel:3, processData:processTimeLine},
        {name:"Site Blocks", key:"block", maxLevel:2, processData:processRedirect}
    ];
    // for now these have to evenly divide an hour
    var frequencyOptions = [60, 30, 20, 10, 5];
    var levels = [3, 2, 1, 0];
    var options = {
        type:0,
        level:0,
        frequency:0
    }

    function addOption(id, name, values, onChange) {
        $(id).html(
            values.map(
                (f, i) => "<option value='" + i + "' " + (i === values[name] ? " selected" : "") + ">" + f + "</option>"
            ).join()
        ).off("change").change(function() {
            options[name] = +this.value;
            onChange && onChange();
            setChart(
                dataTypes[options.type],
                levels[options.level],
                frequencyOptions[options.frequency] * minuteAmount
            );
        });
    }

    addOption("#frequencyLevel", "frequency", frequencyOptions);
    if (dataTypes.length) {
        addOption("#dataType", "type", dataTypes.map((d) => d.name), () => {
            setChartType(dataTypes[options.type]);
        });

        setChartType(dataTypes[0]);
    }

    setChart(dataTypes[options.type], levels[options.level], frequencyOptions[options.frequency] * minuteAmount);

    function setChartType(type) {
        levels = [];
        for (var i = type.maxLevel ; i >= 0 ; i--) {
            levels.push(i);
        }
        options.level = 0;
        addOption("#nameLevel", "level", levels);
    }

    function setChart(type, level, frequency) {
        var process = () => {
            // TODO lazy loading
            var options = type.processData(type.data, level, frequency);
            setChartData(options);
        }
        if (type.data) {
            process();
        } else {
            getData(type.key, function(items) {
                var thisData = [];
                Object.keys(items).sort().forEach(function(i) {
                    thisData = thisData.concat(items[i]);
                });
                type.data = thisData;
                process();
            });
        }
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

    function setChartData(dataOptions) {
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
                type: "datetime",
                events: {
                    setExtremes: (e) => {
                        zoom = [e.min, e.max];
                    }
                }
            },
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
        if (zoom[0] && zoom[1]) {
            chart.xAxis[0].setExtremes(zoom[0], zoom[1], true, false);
            chart.showResetZoom();
        }
    }

    function MinutesSecondsFormat(milli) {
        var secs = Math.floor(milli/1000);
        return Math.floor(secs/60)  + ":" + ("0" + Math.floor(secs%60)).slice(-2);
    }
});
