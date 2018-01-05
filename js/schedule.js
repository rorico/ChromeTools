var scheduleInit = (function() {
    var now = new Date();
    var startTime = 7 * 60;        //7AM
    var endTime = 19 * 60;         //7PM
    var nowTimeOffset = 50;     //for showing now bar
    var pxPerHr = 50;
    var weekMode = false;
    var nowTimer = -1;
    var numDays = 5;
    var weekWidth;

    //function set by background on init
    var weekSchedule;
    var resize;

    function scheduleInit(container,background) {
        weekSchedule = background.weekSchedule;

        var header = "<div id='header'>" + 
                        "<input type='button' value='Prev' id='prev'>\n" + 
                        "<input type='text' id='datepicker'>\n" + 
                        "<input type='button' value='Next' id='next'>\n" + 
                        "<input type='button' value='Show Week' id='showWeek'>" + 
                        "</div>";

        var side = "<div class='timeline'>";
        var right1 = "<div class='timeline right'>";
        var right2 = "<div class='timeline right'>";
        for (var i = startTime ; i < endTime ; i += 60) {
            side += "<div class='timeslotBorder'></div>";
            right1 += "<div class='timeslotBorder'></div>";
            right2 += "<div class='half timeslotBorder'></div><div class='half halftimeslotBorder'></div>";
        }
        side += "<div class='bottom'></div></div>";
        right1 += "<div class='bottom'></div></div>";
        right2 += "<div class='bottom'></div></div>";

        var mid = "<div class='timeline number'><div class='half timeslotBorder'></div>";
        for (var i = (startTime/60) + 1 ; i < (endTime/60) ; i++) {
            mid += "<div>" + (i > 12 ? i - 12 : i) + "</div>";
        }
        mid += "<div class='half'></div><div class='bottom'></div></div>";

        var contain = "<div id='container'></div>";
        var holder = "<div id='holder'>" + side + mid + right1 + right2 + contain + "</div>";

        var html = "<div id='chromeTools_calendar'>" + header + holder + "</div>";
        container.html(html);

        container.attr("tabindex",1).focus().keydown(function(e) {
            e.stopPropagation();
            switch (e.keyCode) {
                case 78:        //n
                    setToday();
                    break;
                case 77:        //m
                    weekView();
                    break;
                case 188:        //,
                    prev();
                    break;
                case 190:        //.
                    next();
                    break;
            }
        });

        $("#showWeek").click(weekView);
        $("#next").click(next);
        $("#prev").click(prev);

        $("#datepicker").datepicker({
            onSelect: function(dateText) {
                if (weekMode) {
                    showWeek($("#datepicker").datepicker("getDate"));
                } else {
                    changeDate($("#datepicker").datepicker("getDate"));
                }
            },
            dateFormat: "DD MM d, yy"
        }).datepicker("setDate", now).datepicker("widget").detach().appendTo(container);
        //normally the widget is outside container, move inside

        resize = function() {
            if (weekMode) {
                var width = Math.floor((container.width() - 100) / numDays);

                $(".placeholder").outerWidth(width);
                $("#now").outerWidth(width);
            }
        }

        changeDate(now);
        return {
            resize: resize
        };
    }

    function changeDate(date) { //single day
        showSchedule([+date]);
    }

    function showWeek(date) {
        var dates = [];
        var start = date.getDay() - 1;
        date.setDate(date.getDate() - start);    //set to monday
        for (var i = 0 ; i < numDays ; i++) {
            dates.push(+date);
            date.setDate(date.getDate() + 1);
        }
        showSchedule(dates);
    }

    var showSchedule = (function() {
        var offset = 0;
        return showSchedule;
        function showSchedule(dates) {
            weekSchedule(dates,function(info) {
                var all = $("<div></div>");
                now = new Date();
                for (var j = 0 ; j < dates.length ; j++) {
                    var today = info[j];    //probably not the best variable name
                    var holder = $("<div class='day'></div>");
                    offset = 0;
                    if (sameDay(dates[j],now)) {
                        showNow(holder,weekMode);
                    }
                    if (!today.length) {
                        addTimeSlot(holder,"placeholder placeborder",endTime - startTime,["No Classes Today"]);
                        addTimeSlot(holder,"placeholder placeborder",1);
                    } else {
                        addPlaceholder(holder,startTime,today[0][1][1]);
                        // group together classes when occupying same timeslot
                        // not the most optimal with 3 overlapping, but that doesn't really happen
                        var groups = [[today[0]]];
                        var end = today[0][1][2];
                        for (var i = 1 ; i < today.length ; i++) {
                            var cls = today[i];
                            if (cls[1][1] < end) {
                                groups[groups.length - 1].push(cls);
                            } else {
                                groups.push([cls])
                            }
                            end = cls[1][2];
                        }
                        for (var k = 0 ; k < groups.length ; k++) {
                            var group = groups[k];
                            var groupStart = group[0][1][1];
                            var groupEnd = group[group.length - 1][1][2]
                            var groupHolder;
                            var thisHolder = groupHolder = holder;
                            var singleMode = group.length === 1;
                            if (!singleMode) {
                                groupHolder = thisHolder = $("<div class='placeholder'></div>");
                                holder.append(thisHolder);
                            }
                            // kinda sketchy, but will work for now. Consider changing to more functional
                            var holdOffset = offset;
                            for (var i = 0 ; i < group.length ; i++) {
                                offset = holdOffset;
                                var cls = group[i];
                                var start = cls[1][1];
                                var finish = cls[1][2];
                                var classType = cls[3];
                                var classCode = cls[2][0];
                                var className = cls[2][1];
                                var location = cls[0];

                                var height = finish - start;
                                var classTitle = [classCode];
                                var cssCls = "class " + classType
                                if (singleMode) {
                                    if (!weekMode) {
                                        classTitle.push(className);
                                    }
                                    classTitle.push(classType);
                                    cssCls += " placeholder"
                                } else {
                                    // classType shows when singleMode or weekmode, not both
                                    if (!weekMode) {
                                        classTitle.push(classType);
                                    }
                                    thisHolder = $("<div style='display:inline;'></div>");
                                    groupHolder.append(thisHolder);
                                }

                                var classInfo = [classTitle.join(" - "), location];
                                addPlaceholder(thisHolder,groupStart,start);
                                addTimeSlot(thisHolder,cssCls,height,classInfo,group.length);
                                addPlaceholder(thisHolder,finish,groupEnd);
                            }
                            var end = k === groups.length - 1 
                                ? endTime
                                : groups[k+1][0][1][1];
                            addPlaceholder(thisHolder,groupEnd,end);
                        }
                        addTimeSlot(holder,"placeholder placeborder",0);
                    }
                    all.append(holder).append("<div id='side'></div>");
                }
                $("#container").html(all);
                resize();
            });
        }

        function addPlaceholder(container,start,end) {
            while (start < end) {
                var nextHour = Math.floor((start + 60)/60) * 60;
                var next = nextHour < end ? nextHour : end;
                var length = next - start;
                var cls = "placeholder";
                if (start % 60 === 0) {
                    cls += " placeborder";
                }
                addTimeSlot(container,cls,length);
                start += length;
            }
        }

        function addTimeSlot(container,classType,time,content,share) {
            //do no need to account for border as using box-sizing:border-box
            var height = time/(60/pxPerHr);
            var thisHeight = height + offset;
            offset = thisHeight % 1;
            thisHeight = Math.floor(thisHeight);

            var thisContent = "";
            if (content && content.length) {
                thisContent = "<p style='top:" + (thisHeight - 15.2 * content.length)/2 + "px'>" + content.join("<br />") + "</p>";
            }
            var style = "height:" + thisHeight + "px;" + (share > 1 ? "width:" + (100/share) + "%;" : "")
            container.append("<div class='" + classType + "' style='" + style + "'>" + thisContent + "</div>");
        }

        function sameDay(day1,day2) {
            var date1 = new Date(day1);
            var date2 = new Date(day2);
            return date1.getDate()==date2.getDate()&&date1.getMonth()==date2.getMonth()&&date1.getYear()==date2.getYear();
        }
    })();

    function showNow(container,weekMode) {
        clearTimeout(nowTimer);
        var holder = $("<div id='nowHolder'></div>");
        var ele = $("<div id='now'></div>");
        holder.html(ele);
        container.prepend(holder);
        nowTimeOffset = 50 * !weekMode;
        holder.css("left",-nowTimeOffset);
        moveNow();

        function moveNow() {
            now = new Date();
            if (now.getHours() < startTime/60 || now.getHours() >= endTime/60) {
                holder.css("display","none");
            } else {
                var text = (now.getHours())+":"+("0"+now.getMinutes()).slice(-2)+"AM";
                if (now.getHours()>=13) {
                    text = (now.getHours()-12)+":"+("0"+now.getMinutes()).slice(-2)+"PM";
                } else if (now.getHours()==12) {
                    text = (now.getHours())+":"+("0"+now.getMinutes()).slice(-2)+"PM";
                }
                var position = Math.floor((now.getHours() - (startTime)/60) * 50 + now.getMinutes()/1.2);
                ele.text(text);
                holder.css("display","block").css("top",position);
                var delay = 60000 - now.getSeconds()*1000 - now.getMilliseconds();
                nowTimer = setTimeout(function() {
                    moveNow();
                },delay);
            }
        }
    }

    function weekView() {
        var date = $("#datepicker").datepicker("getDate");
        weekMode = !weekMode;
        if (weekMode) {
            $("#showWeek").val("Show Day");
            showWeek(date);
        } else {
            $("#showWeek").val("Show Week");
            changeDate(date);
        }
    }

    function next() {
        var date = $("#datepicker").datepicker("getDate");
        if (weekMode) {
            date.setDate(date.getDate() + 7);
            showWeek(date);
        } else {
            date.setDate(date.getDate() + 1);
            changeDate(date);
        }
        $("#datepicker").datepicker("setDate",date);
    }

    function prev() {
        var date = $("#datepicker").datepicker("getDate");
        if (weekMode) {
            date.setDate(date.getDate() - 7);
            showWeek(date);
        } else {
            date.setDate(date.getDate() - 1);
            changeDate(date);
        }
        $("#datepicker").datepicker("setDate",date);
    }

    function setToday() {
        now = new Date();
        $("#datepicker").datepicker("setDate",now);
        if (weekMode) {
            showWeek(now);
        } else {
            changeDate(now);
        }
    }
    return scheduleInit;
})();