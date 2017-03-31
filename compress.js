//Creates a copy of Chrome Tools while minifying the js and css
const UglifyJS = require("uglify-js");
const Uglifycss = require("uglifycss");
const fs = require("fs");
const ncp = require("ncp");

var minifiedFolder = "minified";
var jsFolder = "js";
var cssFolder = "css";
var htmlFolder = "html";

//very important minifiedFolder is here, or will get infinite recursive folder
var special = [htmlFolder,cssFolder,jsFolder,minifiedFolder,"Chrome Tools.zip","compress.js","build.bat","README.md"];

//makes minifiedFolder
mkdir("",function() {
    readFile(htmlFolder + "/background.html",function(data) {
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

        mkdir(jsFolder,function() {
            //like to set mangle:{toplevel:true}, but can't due to browserAction and schedule requesting specific variables
            var result = UglifyJS.minify(filenames,{output:{ascii_only:true}});
            writeFile(jsFolder + "/" + backgroundFileName,result.code);

            //minify and move the rest of the js files
            readdir(jsFolder,function(files) {
                for (var i = 0 ; i < files.length ; i++) {
                    var filepath = jsFolder + "/" + files[i];
                    if (!inArray(filepath,filenames)) {
                        var mini = UglifyJS.minify(filepath,{output:{ascii_only:true}});
                        writeFile(filepath,mini.code);
                    }
                }
            });
        });

        mkdir(htmlFolder,function() {
            contents = contents.substring(0,startIndex) + "<script src=\"/" + jsFolder + "/" + backgroundFileName + "\"></script>\n" + contents.substring(startIndex);
            writeFile(htmlFolder + "/background.html",contents);
            //copy all the html files that aren't background.html
            readdir(htmlFolder,function(files) {
                for (var i = 0 ; i < files.length ; i++) {
                    if (files[i] !== "background.html") {
                        copyFile(htmlFolder + "/" + files[i]);
                    }
                }
            });
        });
    });
    readdir(cssFolder,function(files) {
        mkdir(cssFolder,function() {
            for (var i = 0 ; i < files.length ; i++) {
                var mini = Uglifycss.processFiles([cssFolder + "/" + files[i]]);
                writeFile(cssFolder + "/" + files[i],mini);
            }
        });
    });
    //handle the rest of the not special files
    readdir(".",function(files) {
        for (var i = 0 ; i < files.length ; i++) {
            if (!inArray(files[i],special)) {
                copyRecursive(files[i]);
            }
        }
    });
});

function inArray(obj,arr) {
    return (arr.indexOf(obj) !== -1);
}

function readFile(file,callback) {
    fs.readFile(file,function(err,data) {
        checkError(err);
        callback(data);
    });
}

function readdir(dir,callback) {
    fs.readdir(dir,function(err,files) {
        checkError(err);
        for (var i = 0 ; i < files.length ; i++) {
            //remove hidden files
            if (/^\./.test(files[i])) {
                files.splice(i,1);
                i--;
            }
        }
        callback(files);
    });
}

//output files will all be in the minified folder
function output(name) {
    return minifiedFolder + "/" + name;
}

function writeFile(file,data) {
    fs.writeFile(output(file),data,checkError);
}

function mkdir(name,callback) {
    fs.mkdir(output(name),function(err) {
        checkError(err);
        callback();
    });
}

function copyFile(filename) {
    fs.createReadStream(filename).pipe(fs.createWriteStream(output(filename)));
}

function copyRecursive(dir) {
    ncp(dir,output(dir),checkError);
}

function checkError(err) {
    if (err) {
        console.error(err);
        process.exit(1);
        return;
    }
}