function parseSchedule(text) {
    var info = [];
    var beginning = "University of Waterloo";
    var end = "Printer Friendly Page";
    var classTypes = ["SEM","TUT","LAB","LEC","TST"];
    var content = text.substring(text.indexOf(beginning) + beginning.length,text.indexOf(end));
    var courses = content.split("Exam Information");
    //last one is empty
    for (var i = 0 ; i < courses.length - 1 ; i++) {
        var courseInfo = [];
        var lines = courses[i].split("\n");
        var courseName = [];
        var currentInfo = [];
        var type = "";
        var index = 0;
        for (var j = 0 ; j < lines.length ; j++){
            var line = lines[j];
            if (/^[A-Z].+$/.test(line)){
                var courseParts = line.split(" ");
                var courseCode = courseParts[0] + " " + courseParts[1];
                var courseDescription = line.substring(courseCode.length);
                courseName = [courseCode,courseDescription];
                break;
            }
        }
        for (var j = 0 ; j < lines.length ; j++) {
            for(var k = 0 ; k < classTypes.length ; k++) {
                if (lines[j] == classTypes[k]){
                    if(currentInfo.length) {
                        courseInfo.push([type,currentInfo]);
                        currentInfo = [];
                    }
                    type = classTypes[k];
                    break;
                }
            }
            if (/^[MTWTFh]{1,6} \d{1,2}:.+$/.test(lines[j])) {
                currentInfo.push([getClassLength(lines[j]),lines[j+1],parseDate(lines[j+3])])
                j+=4;
            }
        }
        if(currentInfo.length) {
            courseInfo.push([type,currentInfo]);
            currentInfo = [];
        }
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