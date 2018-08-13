chrome.runtime.getBackgroundPage(function(background) {
    var blockId = "chromeTools_block";
    blockScreen = $("<div id='" + blockId + "' class='display'></div>");
    $("body").append(blockScreen);
    keyPressInit(blockScreen);
    var time = timeLineInit(blockScreen, background);
    var ifr = iframe(blockScreen, background);
    $(window).resize(function() {
        time.resize();
        ifr.resize();
    });
});
