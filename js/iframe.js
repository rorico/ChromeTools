var iframe;
(function() {
    var iframeId = "chromeTools_iframe";
    var loading = [];
    var width;
    var loadingTime = 2000; //2 secs
    var ASPECT_RATIO = [16,12];
    iframe = init;

    function init(container,background) {
        var iframeInfo = background.iframeInfo;
        //create foundation for iframes
        var html = "<div id='" + iframeId + "'>";
        for (var i = 0 ; i < iframeInfo.length ; i++) {
            html += "<div id='frame" + i + "'></div>";
        }
        html += "</div>";
        container.append(html);
        updateIframes(iframeInfo,true);
        resize();
        return {
            resize: resize,
            update: update
        };

        function resize() {
            var iframe = $("#" + iframeId + " .iframe");
            var iframeHolder = $("#" + iframeId);
            var maxWidth = Math.min(container.width()/iframeInfo.length - 60,450);
            width = roundTo(maxWidth,ASPECT_RATIO[1]);
            var height = width / ASPECT_RATIO[1] * ASPECT_RATIO[0];
            //this sets up max height
            iframeHolder.css("flex-basis",(height + 60) + "px");
            var trueHeight = iframe.height();
            if (trueHeight < height) {
                height = roundTo(trueHeight,ASPECT_RATIO[0]);
                iframeHolder.css("flex-basis",(height + 60) + "px");
                width = height / ASPECT_RATIO[0] * ASPECT_RATIO[1];
            }
            iframe.width(width);
        }

        function roundTo(num,round) {
            var div = num % round;
            return num - div;
        }
    }

    function update(background) {
        updateIframes(background.iframeInfo,background.delay);
    }

    //second argument can be empty
    function updateIframes(iframeInfo,time) {
        //hide first, then when they are loaded, move them up
        for (var i = 0 ; i < iframeInfo.length ; i++) {
            if (!loading[i]) {
                updateUrl(iframeInfo[i],i,time);
            }
        }
    }

    //time is earliest time until block
    function updateUrl(info,i,time) {
        var url = info.url;
        var reload = info.reload;
        //hide until loaded, unless nothing there in the first place
        var holder = $("#frame" + i);
        var first = !holder.children().length;
        if (!first && !reload) {
            return;
        }
        var cls = first ? "" : " hidden";

        var ele = $("<iframe class='iframe" + cls + "' src=" + url + " tabindex='-1' sandbox='allow-same-origin allow-popups allow-forms allow-scripts' scrolling='no' ></iframe>");
        holder.append(ele);

        loading[i] = true;
        if (first) {
            ele.load(function() {
                stopIframeFocus(ele);
                loading[i] = false;
            });
        } else {
            var loadTime = Math.max(loadingTime,time);
            //the reason I don't go off the event, is that some internal js still runs to load page
            //run on the last of the two
            var loaded = false;
            var check = function() {
                if (!loaded) {
                    loaded = true;
                    return;
                }
                loading[i] = false;
                $("#frame" + i).children().each(function() {
                    if (this === ele.get()[0]) {
                        ele.removeClass("hidden").width(width);
                    } else {
                        this.remove();
                    }
                });
            };
            ele.load(function() {
                stopIframeFocus(ele);
                check();
            });
            setTimeout(check,loadTime);
        }
    }

    var stopIframeFocus = (function() {
        var list;// = {};
        var waiting = false;
        //some iframes take control once they load, stop that
        //http://stackoverflow.com/a/28932220
        function stopIframeFocus(ele) {
            if (!list) {
                init();
            }
            var url = ele.attr("src");
            list[url] = false;
            ele.click(function() {
                list[url] = true;
            });
        }

        function init() {
            list = {};

            $(document).on("focusout",function(e) {
                //when we call focus, we trigger another focusout, ignore it
                if (waiting) {
                    waiting = false;
                    return;
                }
                var old = e.target;
                setTimeout(function() {
                    var ele = document.activeElement;
                    if (ele instanceof HTMLIFrameElement) {
                        var url = ele.getAttribute("src");
                        if (!list[url]) {
                            if (old.hasAttribute("tabindex")) {
                                old.focus();
                            } else {
                                old.setAttribute("tabindex", "-1");
                                old.focus();
                                old.removeAttribute("tabindex");
                            }
                            //just in case of errors or something
                            waiting = true;
                            setTimeout(function() {
                                waiting = false;
                            },100);
                        }
                    }
                },0);
            });
        }
        return stopIframeFocus;
    })();
})();
