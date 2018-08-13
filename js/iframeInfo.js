var iframeInfo;
setIframeInfo();
function setIframeInfo() {
    chrome.storage.sync.get("iframeInfo", function(items) {
        if (chrome.runtime.lastError) {
            log(chrome.runtime.lastError);
        }
        if (items.iframeInfo) {
            iframeInfo = items.iframeInfo;
            var urls = [];
            for (var i = 0 ; i < iframeInfo.length ; i++) {
                urls.push(iframeInfo[i].url);
            }

            //workaround for sameorigin problem
            chrome.webRequest.onHeadersReceived.addListener(function(e) {
                var headers = e.responseHeaders || [];
                for (var i = headers.length - 1 ; i >= 0 ; i--) {
                    var header = headers[i].name.toLowerCase();
                    if (header === "x-frame-options" || header === "frame-options") {
                        headers.splice(i, 1);
                    }
                }
                return {
                    responseHeaders: headers
                };
            }, {
                urls: urls,
                types: ["sub_frame"]
            }, ["blocking", "responseHeaders"]);
        } else {
            iframeInfo = [];
        }
    });
}
