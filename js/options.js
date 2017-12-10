chrome.runtime.getBackgroundPage(function (backgroundPage) {
    var processRedirect;
    var processTimeLine;
    (function() {
        var hourAmount = 3600000; //num of millisec
        var defaultZoom = 604800000; //1 week
        processRedirect = function(typeData,level) {
            var series = [];
            var zoom = [];
            var options = {
                title: {
                    text: "Redirects"
                },
                yAxis: {
                    title: {
                        text: "Number of Redirects"
                    }
                }
            };
            if (typeData && typeData.length) {
                var indexes = {};
                var index = 0;

                for (var j = 0 ; j < typeData.length ; j++) {
                    var name = getWebsiteName(typeData[j][1],level);
                    var hour = nearestHour(typeData[j][0]);
                    var curIndex = indexes[name];
                    if (curIndex === undefined) {
                        curIndex = index++;
                        indexes[name] = curIndex;
                        //add a 0 before start of data
                        var newData = [[hour - hourAmount,0]];
                        series.push({name:name,data:newData});
                    }
                    var data = series[curIndex].data;
                    addRedirectEntry(data,hour);
                }
                var last = -Infinity;
                //add a 0 aftet end of data
                for (var i = 0 ; i < series.length ; i++) {
                    var data = series[i].data;
                    var lastEntry = data[data.length-1][0];
                    data.push([lastEntry + hourAmount, 0]);
                    if (lastEntry > last) {
                        last = lastEntry;
                    }
                }
                zoom = [last - defaultZoom,last];
            }
            return {series:series,zoom:zoom,options:options};
        };

        function addRedirectEntry(data,hour) {
            var pastTime = data[data.length-1][0];
            if (hour === pastTime) {
                data[data.length-1][1]++;
            } else {
                if (hour-pastTime > hourAmount) {
                    data.push([pastTime + hourAmount,0]);
                    data.push([hour - hourAmount,0]);
                }
                pastTime = hour;
                data.push([hour,1]);
            }
        }

        processTimeLine = function(typeData,level) {
            var series = [];
            var zoom = [];

            var options = {
                title: {
                    text: "TimeLine Wasting Time"
                },
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
            if (typeData && typeData.length) {
                var indexes = {};
                var index = 0;

                for (var j = 0 ; j < typeData.length ; j++) {
                    var timestamp = typeData[j][4];
                    if (!timestamp) {
                        continue;
                    }
                    var name = level === 3 ? "Wasting Level " + typeData[j][1] : getWebsiteName(typeData[j][2],level);
                    var curIndex = indexes[name];
                    if (curIndex === undefined) {
                        curIndex = index++;
                        indexes[name] = curIndex;
                        //add a 0 before start of data
                        var newData = [[nearestHour(timestamp) - hourAmount,0]];
                        series.push({name:name,data:newData});
                    }
                    var data = series[curIndex].data;
                    addTimeLineEntry(data,timestamp,typeData[j][0]);
                }
                var last = -Infinity;
                //add a 0 aftet end of data
                for (var i = 0 ; i < series.length ; i++) {
                    var data = series[i].data;
                    var lastEntry = data[data.length-1][0];
                    data.push([lastEntry + hourAmount, 0]);
                    if (lastEntry > last) {
                        last = lastEntry;
                    }
                }
                zoom = [last - defaultZoom,last];
            }
            return {series:series,zoom:zoom,options:options};
        };

        function addTimeLineEntry(data,time,amount) {
            do {
                var hour = nearestHour(time);
                var nextHour = hour + hourAmount;
                var thisHour;
                if (time + amount > nextHour) {
                    thisHour = nextHour - time;
                } else {
                    thisHour = amount;
                }

                var pastTime = data[data.length-1][0];
                if (hour === pastTime) {
                    data[data.length-1][1] += thisHour;
                } else {
                    if (hour-pastTime > hourAmount) {
                        data.push([pastTime + hourAmount,0]);
                        data.push([hour - hourAmount,0]);
                    }
                    pastTime = hour;
                    data.push([hour,thisHour]);
                }

                amount -= thisHour;
            } while (amount);
        }

        function getWebsiteName(name,nameLevel) {
            name = (typeof name === "string" ? name : "unnamed");
            var ret = name;
            switch(nameLevel) {
                case 2:
                    ret = getBaseUrl(name);
                    break;
                case 1:
                    var base = getBaseUrl(name);
                    var lookFor = "reddit.com/r/";
                    var index = name.indexOf(lookFor);
                    if (index !== -1) {
                        var rest = name.substring(index + lookFor.length);
                        var slashIndex = rest.indexOf("/");
                        var subreddit = rest.substring(0,(slashIndex === -1 ? rest.length : slashIndex));
                        ret = base + " -> " + subreddit;
                    } else {
                        ret = base;
                    }
                    break;
                case 0:
                    ret = name;
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
        {name:"timeLine",maxLevel:3,processData:processTimeLine},
        {name:"redirect",maxLevel:2,processData:processRedirect}
    ];
    var level;

    //set timezone offset for all graphs
    Highcharts.setOptions({
        global: {
            timezoneOffset: (new Date()).getTimezoneOffset()
        }
    });

    if (dataTypes.length) {
        var typeOptions;
        for (var i = 0 ; i < dataTypes.length ; i++) {
            var type = dataTypes[i].name;
            typeOptions += "<option value='" + i + "'>" + type + "</option>";
        }
        $("#dataType").html(typeOptions).change(function() {
            setChartType(dataTypes[this.value]);
        });

        setChartType(dataTypes[0]);
    }


    //for iframe urls
    var iframeInfo = backgroundPage.iframeInfo;
    var scheduleInfo = backgroundPage.scheduleInfo;

    function submitSchedule(data) {
        chrome.storage.sync.set({"scheduleInfo": data});
        backgroundPage.setScheduleInfo();
    }
    liveChange("class",scheduleInfo,parseSchedule,submitSchedule);
    liveChange("iframe",iframeInfo,parseIframe,submitIframe);

    function liveChange(baseId,data,parser,submitCallback) {
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
                }
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
            getData(type.name,function(items) {
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
        var res = type.processData(type.data,level);
        setChartData(res.series,res.zoom,res.options);
    }

    function setChartData(series,zoom,dataOptions) {
        if (series) {
            var options = {
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
                chart.xAxis[0].setExtremes(zoom[0],zoom[1]);
                chart.showResetZoom();
            }
        }
    }
    function MinutesSecondsFormat(milli) {
        var secs = Math.floor(milli/1000);
        return Math.floor(secs/60)  + ":" + ("0" + Math.floor(secs%60)).slice(-2);
    }
});