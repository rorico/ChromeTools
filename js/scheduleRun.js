chrome.runtime.getBackgroundPage(function(background) {
    scheduleInit($("body"),background);
});
