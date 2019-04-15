function randomWord(minLength, maxLength) {
    if (arguments.length === 1) {
        maxLength = minLength;
    }
    var lowerBound = minLength < 3 ? 0 : words.lengths[minLength - 1] || words.words.length;
    var upperBound = words.lengths[maxLength] || words.words.length;
    var randomIndex = Math.floor(Math.random() * (upperBound - lowerBound)) + lowerBound;
    return words.words[randomIndex];
}

addDefault("useTickTickRandom", false, "bool");


addMessageListener({
    "randomWord": function(a, b, c) {
        // getWasteStreak from siteBlocker
        var num = a.input[2] + (a.input[3] ? getWasteStreak() : 0);
        if (settings.useTickTickRandom) {
            getTickTick().then((tasks) => {
                if (!tasks.length) {
                    tasks = ["add a todo"];
                }
                // shuffle before copy so that you don't same prompt twice in a row
                shuffle(tasks);
                while (tasks.length < num) {
                    tasks = tasks.concat(tasks);
                }
                if (tasks.length > num) {
                    tasks = tasks.slice(0, num);
                }
                c(tasks);
            // jquery is special
            }).fail((e) => {
                log(e);
                randomWords();
            })
        } else {
            randomWords();
        }

        function randomWords() {
            var ret = [];
            for (var i = 0 ; i < num ; i++) {
                ret.push(randomWord(a.input[0], a.input[1]));
            }
            c(ret);
        }
        return true;
    }
});


function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getTickTick() {
    // not official api - this gets all open tasks
    // also assumed cookies exist that are logged in
    return $.ajax('https://ticktick.com/api/v2/batch/check/0').then((data) => {
        var now = new Date();
        return data.syncTaskBean.update.filter(a => compareDate(new Date(a.dueDate), now)).map(a => a.title)
    });

    function compareDate(day1, day2) {
        return day1.getDate() <= day2.getDate() &&
        day1.getMonth() <= day2.getMonth() && 
        day1.getYear() <= day2.getYear();
    }
}
