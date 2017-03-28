chrome.commands.onCommand.addListener(function(command) {
    switch(command) {
        case "open_schedule":
            window.open(chrome.extension.getURL("/html/schedule.html"));
            break;
        case "open_options":
            window.open(chrome.extension.getURL("/html/options.html"));
            break;
    }
});