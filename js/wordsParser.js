function randomWord(minLength, maxLength) {
	if (arguments.length === 1) {
		maxLength = minLength;
	}
	var lowerBound = minLength < 3 ? 0 : words.lengths[minLength - 1] || words.words.length;
	var upperBound = words.lengths[maxLength] || words.words.length;
	var randomIndex = Math.floor(Math.random() * (upperBound - lowerBound)) + lowerBound;
	return words.words[randomIndex];
}

addMessageListener({
    "randomWord": function(a,b,c) {
    	// getWasteStreak from siteBlocker
    	var ret = [];
    	for (var i = 0 ; i < a.input[2] + (a.input[3] ? getWasteStreak() : 0) ; i++) {
    		ret.push(randomWord(a.input[0],a.input[1]))
    	}
        c(ret);
    }
});
