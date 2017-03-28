var allLogs = [];
var numUnread = 0;

addMessageListener({
    "removeLog": function(a) {
        removeLog(a.input);
    }
});

//for logging information, and display to console. Only takes in 1 argument
function log(arg) {
    //should only contain strings
    addLog(JSON.stringify(arg));
    console.log(arg);
}

function addLog(message) {
    allLogs.push([message,true]);
    numUnread++;
}

function removeLog(index) {
    if (allLogs[index][1]) {
        allLogs[index][1] = false;
        numUnread--;
    }
}

//this doesn't actually seem to work, but doesn't harm
window.onerror = function(message, source, lineno, colno, error){
    addLog(message);
};