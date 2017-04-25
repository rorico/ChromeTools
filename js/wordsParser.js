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
        c(randomWord(a.input[0],a.input[1]));
    }
});
