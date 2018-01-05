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
    var content = text.substring(text.indexOf(beginning) + beginning.length,text.indexOf(end));
    var lines = content.split("\n");
    var courseInfo = [];
    var courseName = [];
    var currentInfo = [];
    var type = "";
    var index = 0;
    for (var i = 0 ; i < lines.length ; i++) {
        line = lines[i];
        // looking for the line below the course code
        if (/^Status/.test(line)){
            var course = lines[i-1]
            var courseParts = course.split(" - ");
            var courseCode = courseParts[0];
            var courseDescription = " - " + courseParts[1];

            if (currentInfo.length) {
                courseInfo.push([type,currentInfo]);
                currentInfo = [];
            }
            if (courseInfo.length) {
                info.push([courseName,courseInfo]);
            }

            courseName = [courseCode,courseDescription];
            courseInfo = [];
            currentInfo = [];
            type = "";
            index = 0;
        } else if (classTypes[line]) {
            if (currentInfo.length) {
                courseInfo.push([type,currentInfo]);
                currentInfo = [];
            }
            type = line;
        } else if (/^[MTWTFh]{1,6} \d{1,2}:.+$/.test(lines[i])) {
            currentInfo.push([getClassLength(lines[i]),lines[i+1],parseDate(lines[i+3])])
            i += 4;
        }
    }
    if (currentInfo.length) {
        courseInfo.push([type,currentInfo]);
        currentInfo = [];
    }
    if (courseInfo.length) {
        info.push([courseName,courseInfo]);
    }
    return info;
}
//remember to reset
function parseDate(date) {
    var returnValues = [];
    var dates = date.split(" - ");
    for (var i = 0 ; i < dates.length ; i++) {
        var dateparts = dates[i].split("/");
        //MM/DD/YYYY
        if (i==1) {
            returnValues.push(+new Date(dateparts[2],dateparts[0]-1,dateparts[1],23,59,59,999));
        } else {
            returnValues.push(+new Date(dateparts[2],dateparts[0]-1,dateparts[1]));
        }
    }
    return returnValues;
}

function getClassLength(range) {
    var words = range.split(" ");
    var startValue = parseTime(words[1]);
    var endValue = parseTime(words[3]);
    return [words[0],startValue,endValue];
}

function parseTime(time) {
    var timeParts = time.split(":");
    var hour = timeParts[0] - 0;
    if (timeParts[1].indexOf("PM")>-1 && hour!="12") {
        hour += 12;
    }
    minutes = timeParts[1].slice(0,-2) - 0; //remove pm/am
    return (60 * hour) + minutes;
}

//send requests to background
function sendRequest(action,input) {
    chrome.runtime.sendMessage({
        from: "options",
        action: action,
        input: input
    });
}