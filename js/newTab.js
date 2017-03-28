chrome.runtime.getBackgroundPage(function(background) {
	var blockId = "chromeTools_block";
    blockScreen = $("<div id='" + blockId + "' class='display'></div>");
    $("body").append(blockScreen);
    keyPressInit(blockScreen);
    timeLineInit(blockScreen,background);
    iframe(blockScreen,background);
});