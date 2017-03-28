//Creates a copy of Chrome Tools while minifying the js and css
const UglifyJS = require("uglify-js");
const Uglifycss = require("uglifycss");
const fs = require("fs");
const ncp = require("ncp");

var minifedFolder = "minified";
var jsFolder = "js";
var cssFolder = "css";
var htmlFolder = "html";

//very important minifiedFolder is here, or will get infinite recursive folder
var special = [htmlFolder,cssFolder,jsFolder,minifedFolder,"Chrome Tools.zip","compress.js","build.bat"];

//copy all files that don't need special attention
fs.readdir(".", function(err, files) {
	for (var i = 0 ; i < files.length ; i++) {
		if (!isSpecial(files[i])) {
			ncp(files[i], minifedFolder + "/" + files[i], function (err) {
				if (err) {
					return console.error(err);
				}
			});
		}
	}
	function isSpecial(file) {
		for (var i = 0 ; i < special.length ; i++) {
			if (special[i] === file) {
				return true;
			}
		}
		return false;
	}
});

//needs subfolders to be there
//combine all background files into one, and update reference in background.html
fs.readFile(htmlFolder + "/background.html", function (err, data) {
    if (err) {
    	return console.error(err);
    }
    var contents = data.toString();
    var index = 0;
    var filenames = [];
    var pattern = /<script src=\"(.*)\"><\/script>\r\n/;
    var backgroundFileName = "background.js"
    var result;
    var startIndex = 0;
    while (result = pattern.exec(contents)) {
        contents = contents.substring(0,result.index) + contents.substring(result.index + result[0].length);
        filenames.push(result[1].substring(1)); //remove leading slash
        startIndex = result.index;
    }
    //like to set mangle:{toplevel:true}, but can't due to browserAction and schedule requesting specific variables
    var result = UglifyJS.minify(filenames,{output:{ascii_only:true}});
    fs.writeFile(minifedFolder + "/" + jsFolder + "/" + backgroundFileName, result.code, function() {
        if (err) {
          return console.error(err);
        }
    });
    contents = contents.substring(0,startIndex) + "<script src=\"/" + jsFolder + "/" + backgroundFileName + "\"></script>\n" + contents.substring(startIndex);
    fs.writeFile(minifedFolder + "/" + htmlFolder + "/background.html", contents, function() {
        if (err) {
          return console.error(err);
        }
    });
    //minify and move the rest of the js files
    fs.readdir(jsFolder, function(err, files) {
        for (var i = 0 ; i < filenames.length ; i++) {
            for (var j = 0 ; j < files.length ; j++) {
                //remove leading js/ if jsFolder changes, change
                if (files[j] === filenames[i].substring(3)) {
                    files.splice(j,1);
                    break;
                }
            }
        }
        for (var i = 0 ; i < files.length ; i++) {
            var mini = UglifyJS.minify(jsFolder + "/" + files[i],{output:{ascii_only:true}});
            fs.writeFile(minifedFolder + "/" + jsFolder + "/" + files[i], mini.code, function() {
                if (err) {
                  return console.error(err);
                }
            });
        }
    });
    //copy all the html files that aren't background.html
    fs.readdir(htmlFolder, function(err, files) {
        for (var j = 0 ; j < files.length ; j++) {
            //remove leading js/ if jsFolder changes, change
            if (files[j] === "background.html") {
                files.splice(j,1);
                break;
            }
        }
        for (var i = 0 ; i < files.length ; i++) {
        	copyFile(htmlFolder + "/" + files[i],minifedFolder + "/" + htmlFolder + "/" + files[i]);
        }
    });
});

//minify and move the css files
fs.readdir(cssFolder, function(err, files) {
    for (var i = 0 ; i < files.length ; i++) {
        var mini = Uglifycss.processFiles([cssFolder + "/" + files[i]]);
        fs.writeFile(minifedFolder + "/" + cssFolder + "/" + files[i], mini, function() {
            if (err) {
              return console.error(err);
            }
        });
    }
});

function copyFile(f1,f2) {
	fs.createReadStream(f1).pipe(fs.createWriteStream(f2));
}