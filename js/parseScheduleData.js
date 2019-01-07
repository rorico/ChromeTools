function parseSchedule(text) {
    var info = [];
    var beginning = "University of Waterloo";
    var end = "Printer Friendly Page";
    var classTypes = {
        "SEM": true,
        "TUT": true,
        "LAB": true,
        "LEC": true,
        "TST": true
    };
    var content = text.substring(text.indexOf(beginning) + beginning.length, text.indexOf(end));
    var lines = content.split("\n");
    var courseInfo = [];
    var courseName = [];
    var currentInfo = [];
    var type = "";
    var index = 0;
    for (var i = 0 ; i < lines.length ; i++) {
        var line = lines[i];
        // looking for the line below the course code
        if (/^Status/.test(line)){
            var course = lines[i-1];

            if (currentInfo.length) {
                courseInfo.push([type, currentInfo]);
                currentInfo = [];
            }
            if (courseInfo.length) {
                info.push([courseName, courseInfo]);
            }
            courseName = course.split(" - ");
            courseInfo = [];
            currentInfo = [];
            type = "";
            index = 0;
        } else if (classTypes[line]) {
            if (currentInfo.length) {
                courseInfo.push([type, currentInfo]);
                currentInfo = [];
            }
            type = line;
        } else if (/^[MTWTFh]{1,6} \d{1,2}:.+$/.test(lines[i])) {
            currentInfo.push([
                // classrooms have random spaces
                lines[i+1].replace(/ +/g, " "),
                getClassLength(lines[i]),
                parseDate(lines[i+3])
            ]);
            i += 4;
        }
    }
    if (currentInfo.length) {
        courseInfo.push([type, currentInfo]);
        currentInfo = [];
    }
    if (courseInfo.length) {
        info.push([courseName, courseInfo]);
    }
    return info;
}

function parseDate(dates) {
    return dates.split(" - ").map(date => {
        // MM/DD/YYYY to YYYY-MM-DD
        var parts = date.split("/");
        return new Date(parts[2], parts[0]-1, parts[1]).toISOString().split("T")[0];
    });
}

function getClassLength(range) {
    var words = range.split(" ");
    var startValue = parseTime(words[1]);
    var endValue = parseTime(words[3]);
    return [dayOfWeek(words[0]), startValue, endValue];
}

function dayOfWeek(str) { //same day of week
    var ret = "";
    if (str.indexOf("M") > -1) {
        ret += "1";
    }
    if (str.indexOf("T") > -1 && str[str.indexOf("T") + 1] !== "h") {
        ret += "2";
    }
    if (str.indexOf("W") > -1) {
        ret += "3";
    }
    if (str.indexOf("Th") > -1) {
        ret += "4";
    }
    if (str.indexOf("F") > -1) {
        ret += "5";
    }
    return ret;
}


function parseTime(time) {
    var timeParts = time.split(":");
    var hour = timeParts[0] - 0;
    if (timeParts[1].indexOf("PM")>-1 && hour!="12") {
        hour += 12;
    }
    var minutes = timeParts[1].slice(0, -2) - 0; //remove pm/am
    return (60 * hour) + minutes;
}

//send requests to background
function sendRequest(action, input) {
    chrome.runtime.sendMessage({
        from: "options",
        action: action,
        input: input
    });
}
