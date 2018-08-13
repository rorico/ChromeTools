var addMessageListener;
(function() {
    var messageListeners = {};

    addMessageListener = function(obj) {
        //this doesn't allow removal, but not needed at least for now
        for (var prop in obj) {
            //i'm gonna assume this is a function
            messageListeners[prop] = obj[prop];
        }
    };

    chrome.runtime.onMessage.addListener(function(a, b, c) {
        //just to make sure there is no infinite loop
        if (a.from !== "background") {
            var funct = messageListeners[a.action];
            if (typeof funct === "function") {
                funct(a, b, c);
            }
        }
    });
})();

function sendFormat(action, input) {
    return {
        from: "background",
        action: action,
        input: input
    };
}

//for displaying in an open browser action
function sendRequest(action, input) {
    chrome.runtime.sendMessage(sendFormat(action, input));
}
