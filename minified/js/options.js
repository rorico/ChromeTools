chrome.runtime.getBackgroundPage(function(t){function e(t,e,r,a){var n=$("#"+t+"-before"),i=$("#"+t+"-after"),o=$("#"+t+"-submit");i.val(e?JSON.stringify(e,null,4):""),n.change(function(){e=r(n.val()),i.val(JSON.stringify(e,null,4))}),o.click(function(){var t;try{e=JSON.parse(i.val()),a(e),t="Submitted successfully"}catch(e){t="Error submitting"}n.val(t)})}function r(t){for(var e=t.split("\n"),r=[],a=0;a<e.length;a++){var n=e[a].trim(),i=n.split(" ");if(i[0]){var o={url:i[0],reload:"reload"===i[1]};r.push(o)}}return r}function a(e){chrome.storage.sync.set({iframeInfo:e}),t.setIframeInfo()}function n(t){h=t.maxLevel;for(var e="",r=0;r<=h;r++){var a=h===r?" selected":"";e+="<option value='"+r+"'"+a+">"+r+"</option>"}$("#nameLevel").html(e).off("change").change(function(){h=parseInt(this.value),i(t)}),t.data?i(t):u(t.name,function(e){var r=[];Object.keys(e).sort().forEach(function(t){r=r.concat(e[t])}),t.data=r,i(t)})}function i(t){var e=t.processData(t.data,h);o(e.series,e.zoom,e.options)}function o(t,e,r){if(t){var a={chart:{renderTo:"highcharts",zoomType:"x",type:"column"},xAxis:{type:"datetime"},series:t,plotOptions:{area:{fillColor:{linearGradient:{x1:0,y1:0,x2:0,y2:1},stops:[[0,Highcharts.getOptions().colors[0]],[1,Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0).get("rgba")]]},marker:{radius:2},lineWidth:1,states:{hover:{lineWidth:1}},threshold:null},column:{stacking:"normal",pointPadding:0,borderWidth:0}}};for(var n in r)a[n]=r[n];var i=new Highcharts.Chart(a);e&&(i.xAxis[0].setExtremes(e[0],e[1]),i.showResetZoom())}}function s(t){var e=Math.floor(t/1e3);return Math.floor(e/60)+":"+("0"+Math.floor(e%60)).slice(-2)}var l,c;!function(){function t(t,e){var r=t[t.length-1][0];e===r?t[t.length-1][1]++:(e-r>i&&(t.push([r+i,0]),t.push([e-i,0])),r=e,t.push([e,1]))}function e(t,e,r){do{var a,o=n(e),s=o+i;a=e+r>s?s-e:r;var l=t[t.length-1][0];o===l?t[t.length-1][1]+=a:(o-l>i&&(t.push([l+i,0]),t.push([o-i,0])),l=o,t.push([o,a])),r-=a}while(r)}function r(t,e){t="string"==typeof t?t:"unnamed";var r=t;switch(e){case 2:r=a(t);break;case 1:var n=a(t),i="reddit.com/r/",o=t.indexOf(i);if(o!==-1){var s=t.substring(o+i.length),l=s.indexOf("/"),c=s.substring(0,l===-1?s.length:l);r=n+" -> "+c}else r=n;break;case 0:r=t}return r}function a(t){var e=t.split("/");if(e[2]){var r=e[2].split(".");return r[r.length-2]?r[r.length-2]:e[2]}return t}function n(t){var e=new Date(t);return e.setMinutes(0),e.setSeconds(0),e.setMilliseconds(0),+e}var i=36e5,o=6048e5;l=function(e,a){var s=[],l=[],c={title:{text:"Redirects"},yAxis:{title:{text:"Number of Redirects"}}};if(e&&e.length){for(var h={},u=0,f=0;f<e.length;f++){var v=r(e[f][1],a),g=n(e[f][0]),m=h[v];if(void 0===m){m=u++,h[v]=m;var p=[[g-i,0]];s.push({name:v,data:p})}var d=s[m].data;t(d,g)}for(var x=-(1/0),b=0;b<s.length;b++){var d=s[b].data,y=d[d.length-1][0];d.push([y+i,0]),y>x&&(x=y)}l=[x-o,x]}return{series:s,zoom:l,options:c}},c=function(t,a){var l=[],c=[],h={title:{text:"TimeLine Wasting Time"},yAxis:{title:{text:"Time Spent"},labels:{formatter:function(){return s(this.value)}}},tooltip:{pointFormatter:function(){return"<span style='color:"+this.color+"'>\u25cf</span> "+this.series.name+": <b>"+s(this.y)+"</b><br/>"}}};if(t&&t.length){for(var u={},f=0,v=0;v<t.length;v++){var g=t[v][4];if(g){var m=3===a?"Wasting Level "+t[v][1]:r(t[v][2],a),p=u[m];if(void 0===p){p=f++,u[m]=p;var d=[[n(g)-i,0]];l.push({name:m,data:d})}var x=l[p].data;e(x,g,t[v][0])}}for(var b=-(1/0),y=0;y<l.length;y++){var x=l[y].data,O=x[x.length-1][0];x.push([O+i,0]),O>b&&(b=O)}c=[b-o,b]}return{series:l,zoom:c,options:h}}}();var h,u=t.getData,f=[{name:"timeLine",maxLevel:3,processData:c},{name:"redirect",maxLevel:2,processData:l}];if(Highcharts.setOptions({global:{timezoneOffset:(new Date).getTimezoneOffset()}}),f.length){for(var v,g=0;g<f.length;g++){var m=f[g].name;v+="<option value='"+g+"'>"+m+"</option>"}$("#dataType").html(v).change(function(){n(f[this.value])}),n(f[0])}var p=t.iframeInfo,d=t.scheduleInfo;e("class",d,parseSchedule,submitSchedule),e("iframe",p,r,a)});