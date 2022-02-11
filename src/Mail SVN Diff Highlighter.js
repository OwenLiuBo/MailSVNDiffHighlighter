// ==UserScript==
// @name            Mail SVN Diff Highlighter
// @namespace       http://liubingrui.com/gSVNHighlighter
// @description     Highlights svn diff
// @author          Owen Liu
// @version         0.6.1
// @match           http://mail.google.com/*
// @match           https://mail.google.com/*
// @match           http://*.mail.google.com/*
// @match           https://*.mail.google.com/*
// @match           http://mail.kasoftware.cn/*
// @match           https://mail.kasoftware.cn/*
// @match           https://qiye.aliyun.com/alimail/*
// @match           https://work.aliyun.com/alimail/*
// @match           https://outlook.office.com/*
// ==/UserScript==

//
// Add to gmail
//
document.addEventListener(
  'click',
  function(){
    setTimeout(highlightDiff, 600);
  },
  true
);

document.addEventListener(
  'load',
  function(){
    setTimeout(highlightDiff, 100);
  },
  true
);

function highlightDiff(){
  var nodes = getNodesByTagNameAndClass(document.body, "div", "ii gt");
  var gmail = true;
  if (!nodes || nodes.length <= 0) {
    nodes = getNodesByTagNameAndClass(document.body, "div", "node_plain_body");
    if (!nodes || nodes.length <= 0) {
      nodes = getNodesByTagNameAndClass(document.body, "div", "PlainText");
    }
    gmail = false;
  }

  for(var i = 0; i < nodes.length; i++) {
    var dMsg = nodes[i];
    dMsg.setAttribute('style', 'white-space: pre;');
    var content = gmail && dMsg.textContent || dMsg.innerText;
//    console.log();
    if(dMsg && isDiff(content)){
      var diff = parseDiff(content);
      if(diff){
        dMsg.innerHTML = formatDiff(diff, dMsg.innerHTML);
        document.getElementById("odiff-switch").addEventListener('change', function(){odiffSwitch(this);});
      }
      if (gmail) break;
    }
  }
}

//
// Diff methods
//

function Diff() {
  // diff header
  this.author = "unknown";
  this.date = new Date().toString();
  this.comments = "";

  // files
  this.files = new Array();

  // end
  this.others = "";
}
Diff.prototype.getFile = function(name){
  for(var i=0;i<this.files.length;i++){
    if(this.files[i].name == name) return this.files[i];
  }
  return null;
}

// regex
Diff.REX_REGION = /^\s*-{57}/;
Diff.REX_FILE_TYPE = /^(U|A|D)\s+(.+)/;
Diff.REX_FILE_HEADER = /^(Modified|Deleted|Added|Copied):\s+(\S+)/;
Diff.REX_FILE_REGION = /^={67}/;
Diff.REX_FILE_OLD = /^-{3}\s+.+\s+.+\s+\(rev\s([0-9]+)\)/;
Diff.REX_FILE_NEW = /^\+{3}\s+.+\s+.+\s+\(rev\s([0-9]+)\)/;
Diff.REX_FILE_LN = /^@@\s+-([0-9]+),[0-9]+\s+\+([0-9]+),[0-9]+\s+@@/;
// state
Diff.S_BEGIN = 0;
Diff.S_H_AUTHOR = 1;
Diff.S_H_DATE = 2;
Diff.S_H_COMMENT = 3;
Diff.S_F_LIST = 4;
Diff.S_F_SPACE = 5;
Diff.S_F_FILE = 6;
Diff.S_E_OTHER = 7;

function DiffFile(type, name) {
  this.type = type;
  this.name = name;
  this.oldRev = "";
  this.newRev = "";
  this.blocks = new Array();
}

function DiffBlock(oln, nln) {
  this.oldLN = oln;
  this.newLN = nln;
  this.lines = new Array();
}
DiffBlock.prototype.getSBSLines = function(){
  var sslines = new Array();
  var index = 0;
  for(var i=0;i<this.lines.length;i++){
    var line = this.lines[i];
    if(line.type == '-') {
      index++;
    } else if(line.type == '+') {
      if(index) {
        var rline = this.lines[i-index];
        if(rline.type == '-') {
          rline.line2 = line.line;
          continue;
        }
      }
      index = 0;
    } else {
      index = 0;
    }
    sslines.push(line);
  }
  return sslines;
}

function DiffLine(type, line) {
  this.type = type;
  this.line = line;
  this.line2 = null; // for side by side
}

function countLine(lines) {
  var count = 0;
  for(var i=0;i<lines.length;i++) {
    var line = lines[i];
    if(line.type == '-' || line.type == '+') {
      count++;
    }
  }
  return count;
}

function isDiff(diff) {
  if(!diff || diff.length <= 0) return false;
  diff = diff.trim();
  if(!Diff.REX_REGION.test(diff)) return false;
  return true;
}

function parseDiff(src) {
  if(!src || src.length <= 0) return null;
  var lines = src.split('\n');
  if(!lines || lines.length <= 5) return null;
  var state = Diff.S_BEGIN;
  var i, m, f, c;
  var diff = new Diff();
  for (i=0;i<lines.length;i++) {
    var line = lines[i];
    switch(state){
      case Diff.S_BEGIN:
        if(Diff.REX_REGION.test(line)) state = Diff.S_H_AUTHOR;
        break;
      case Diff.S_H_AUTHOR:
        diff.author = line;
        state = Diff.S_H_DATE;
        break;
      case Diff.S_H_DATE:
        diff.date = line;
        state = Diff.S_H_COMMENT;
        lines.shift(); // skip length
        break;
      case Diff.S_H_COMMENT:
        if(Diff.REX_REGION.test(line)) {
          state = Diff.S_F_LIST;
        } else {
          if(diff.comments) diff.comments += "\n";
          diff.comments += line;
        }
        break;
      case Diff.S_F_LIST:
        if(Diff.REX_REGION.test(line)) {
          state = Diff.S_F_SPACE;
        } else if(m = Diff.REX_FILE_TYPE.exec(line)) {
          diff.files.push(new DiffFile(m[1], m[2]));
        }
        break;
      case Diff.S_F_SPACE:
        if(Diff.REX_REGION.test(line)) state = Diff.S_F_FILE;
        break;
      case Diff.S_F_FILE:
        if(Diff.REX_REGION.test(line)) {
          state = Diff.S_E_OTHER;
        } else {
          if(m = Diff.REX_FILE_HEADER.exec(line)) {
              f = diff.getFile(m[2]);
          } else if(f) {
            if(m = Diff.REX_FILE_REGION.exec(line)) {
              continue;
            } else if(m = Diff.REX_FILE_OLD.exec(line)) {
              f.oldRev = m[1];
            } else if(m = Diff.REX_FILE_NEW.exec(line)) {
              f.newRev = m[1];
            } else if(m = Diff.REX_FILE_LN.exec(line)) {
              c = new DiffBlock(m[1], m[2]);
              f.blocks.push(c);
            } else if(c) {
              if(line.charAt(0) == '\\') continue;
              c.lines.push(new DiffLine(line.charAt(0), line.substring(1)));
            }
          }
        }
        break;
      case Diff.S_E_OTHER:
        if(diff.others) diff.others += "\n";
        diff.others += line;
        break;
    }
  }
  return diff;
}

function formatDiff(diff, original) {
  var html = "<div>"
  // switch
  html += "<div class='odiff-switch'>";
  html += "<input type='checkbox' class='odiff-switch-checkbox' id='odiff-switch' checked>";
  html += "<label class='odiff-switch-label' for='odiff-switch'>";
  html += "<div class='odiff-switch-inner'>";
  html += "<div class='odiff-switch-active'>Hightlight View</div>";
  html += "<div class='odiff-switch-inactive'>Raw View</div>";
  html += "</div>";
  html += "<div class='odiff-switch-switch'></div>";
  html += "</label>";
  html += "</div><br/>";
  // highlighter
  html += "<div id='odiffHighlight'><div class='odiff-header'><div class='odiff-info'>";
  // header
  html += "<p class='odiff-author'><span>Author:&nbsp;</span><b>" + diff.author;
  html += "</b><span class='odiff-date'>" + diff.date + "</span>";
  html += "&nbsp;&nbsp;<span class='odiff-count odiff-filecount'>Files: _FILE_COUNT_PLACEHOLDER_</span>";
  html += "&nbsp;&nbsp;<span class='odiff-count odiff-linecount'>Lines: _LINE_COUNT_PLACEHOLDER_</span>";
  html += "</p></div>";
  html += "<div class='odiff-comments'><pre>" + htmlEscape(diff.comments) + "</pre></div></div>";
  // file list
  html += "<div class='odiff-lists'><h2>Affected files</h2><ul>";
  var i,j,k;
  for(i=0;i<diff.files.length;i++){
    var file = diff.files[i];
    html += "<li>" + file.type + "&nbsp;&nbsp;&nbsp;" + file.name + "</li>"
  }
  html += "</ul></div>"

  var modificationLineCount = 0;

  // files
  for(i=0;i<diff.files.length;i++){
    var file = diff.files[i];
    html += "<h3 class='odiff-filepath'>" + file.name + "</h3>"
    html += "<div class='odiff-filediv'><table cellpadding='0' cellspacing='0' class='odiff-file'><col width='30'><col width='*'><col width='30'>";
    html += "<thead><tr class='odiff-filerev'><th></th><th>" + file.oldRev + "</th><th></th><th>" + file.newRev + "</th></tr></thead>";
    for(j=0;j<file.blocks.length;j++){
      var block = file.blocks[j];
      var oln = block.oldLN;
      var nln = block.newLN;
      var lines = block.getSBSLines();
      modificationLineCount += countLine(lines);
      if(j) html += "<tbody><tr class='odiff-code-ignore'><th>...</th><td></td><th>...</th><td></td></tr></tbody>";
      for(k=0;k<lines.length;k++){
        var line = lines[k];
        var rcode="",lcode="";
        var rln = "",lln="";
        var type = "";
        if(line.type == '-') {
          type = "odiff-code-d";
          lcode = line.line;
          lln = oln++;
          if(line.line2){
            type = "odiff-code-m";
            rln = nln++;
            rcode = line.line2;
            if(lcode && rcode) {
              var ms = 0, me = 0;
              while(rcode[ms] == lcode[ms] && rcode[ms] && lcode[ms]) ms++;
              while(rcode[rcode.length-me-1] == lcode[lcode.length-me-1] && rcode[rcode.length-me-1] && lcode[lcode.length-me-1] && rcode.length-me-1 >= ms && lcode.length-me-1 >= ms) me++;
              var tmp = htmlEscape(rcode.substring(0,ms)) + "<span class='odiff-code-m-new'>";
              tmp += htmlEscape(rcode.substring(ms,rcode.length-me)) + "</span>";
              tmp += htmlEscape(rcode.substring(rcode.length-me, rcode.length));
              rcode = tmp;
              tmp = htmlEscape(lcode.substring(0,ms)) + "<span class='odiff-code-m-old'>";
              tmp += htmlEscape(lcode.substring(ms,lcode.length-me)) + "</span>";
              tmp += htmlEscape(lcode.substring(lcode.length-me, lcode.length));
              lcode = tmp;
            } else {
              rcode = htmlEscape(rcode);
              lcode = htmlEscape(lcode);
            }
          } else {
            lcode = htmlEscape(lcode);
          }
        } else if(line.type == '+') {
          type = "odiff-code-a";
          rcode = htmlEscape(line.line);
          rln = nln++;
        } else {
          type = "odiff-code";
          lcode = rcode = htmlEscape(line.line);
          lln = oln++;
          rln = nln++;
        }
        if(file.type == "D") {
          rln = rcode = ""
        } else if(file.type == "A") {
          lln = lcode = ""
        }
        html += "<tbody class='" + type + "'><tr><th>"+lln+"</th>";
        html += "<td><pre>"+lcode+"</pre></td>";
        html += "<th>"+rln+"</th><td><pre>"+rcode+"</pre></td></tr></tbody>";
      }
    }
    html += "</table></div>"
  }
  // ends
  if (diff.others) {
    html += "<br><div class='odiff-others'><pre>" + diff.others + "</pre></div>";
  }
  html += "</div>";
  // original
  html += "<div style='display:none;' id='odiffOriginal'>" + original + "</div></div>";
  html = html.replace(": _FILE_COUNT_PLACEHOLDER_", ": " + diff.files.length);
  html = html.replace(": _LINE_COUNT_PLACEHOLDER_", ": " + modificationLineCount);
  return html;
}

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

//
// Add style
//

(function() {
var css = ".odiff-header{ \
  -webkit-border-radius: 5px; \
  border: solid 1px #CCC; \
  padding-left: 10px; \
  background-color: #F4F7FB; \
  font-size: 12px; \
} \
.odiff-comments pre { \
  font-size: 11px; \
  font-family: Consolas,monaco,monospace; \
} \
.odiff-others{ \
  -webkit-border-radius: 5px; \
  border: solid 1px #CCC; \
  padding-left: 10px; \
  background-color: #ffffe0; \
  font-size: 12px; \
} \
.odiff-info{ \
  color: #666; \
} \
.odiff-date{ \
  padding-left: 10px; \
  font-size: 10px; \
} \
.odiff-count{ \
  -webkit-border-radius: 2px; \
  border: solid 1px #CCC; \
  padding-left: 5px; \
  padding-right: 5px; \
  font-size: 12px; \
  font-size: 10px; \
} \
.odiff-filecount{ \
  background-color: #e0ffe0; \
} \
.odiff-linecount{ \
  background-color: #ffffe0; \
} \
.odiff-lists h2{ \
  font-size: 15px; \
} \
.odiff-lists ul{ \
  font-size: 12px; \
  list-style: none; \
  margin: 0px; \
  padding: 0px; \
} \
.odiff-lists li{ \
  height: 21px; \
  border-bottom-color: #E6E6E6; \
  border-bottom-style: solid; \
  border-bottom-width: 1px; \
} \
.odiff-filepath{ \
  font-size: 13px; \
  background-color: #F8F8F8; \
  border: solid 1px #E0E0E0; \
  border-bottom-width: 0px; \
  height: 18px; \
  padding: 7px; \
  margin: 10px 0px 0px 0px; \
  color: #15478C; \
} \
.odiff-filediv{ \
  overflow-x: auto; \
} \
.odiff-file{ \
  font-family: Arial, Helvetica, 'Liberation Sans', FreeSans, sans-serif; \
  border-collapse: collapse; \
  width: 100%; \
} \
.odiff-file tr{ \
  border-color: #EEE; \
  border-style: solid; \
  border-width: 1px 0px 1px 0px; \
} \
.odiff-file tr:hover{ \
  background-color: #C0C0C0; \
} \
.odiff-file th{ \
  font-weight: normal; \
  font-size: 10px; \
  padding: 0px 3px 5px 3px; \
  color: #888888; \
  background-color: #F8F8F8; \
  border-color: #EEE; \
  border-style: solid; \
  border-width: 0px 1px 0px 1px; \
  word-break: normal; \
} \
.odiff-file td{ \
  border-right-color: #EEE; \
  border-right-style: solid; \
  border-right-width: 1px; \
  width: 47%; \
} \
.odiff-file pre{ \
  text-align: left; \
  vertical-align: baseline; \
  white-space: pre-wrap; \
  word-wrap: break-word; \
  font-size: 12px; \
  margin: 0px; \
  font-family: Consolas,monaco,monospace; \
} \
.odiff-filerev th{ \
  font-size: 12px; \
  padding: 5px 0px; \
  color: #15478C; \
  background-color: #F4F7FB; \
} \
.odiff-code-ignore{ \
  background-color: #F8F8F8; \
}\
.odiff-code-a,.odiff-code-m-new \
{ \
  background-color:#C5F2D0; \
} \
.odiff-code-d,.odiff-code-m-old{ \
  background-color:#FFDDDD; \
} \
.odiff-code-m{ \
  background-color:#FEFED8; \
} \
.odiff-switch { \
  position: relative; width: 150px; \
  -webkit-user-select:none; \
} \
.odiff-switch-checkbox { \
  display: none; \
} \
.odiff-switch-label { \
  display: block; overflow: hidden; cursor: pointer; \
  border: 1px solid #999999; border-radius: 5px; \
} \
.odiff-switch-inner { \
  width: 200%; margin-left: -100%; \
  -webkit-transition: margin 0.3s ease-in 0s; \
} \
.odiff-switch-inner > div { \
  float: left; width: 50%; height: 30px; padding: 0; line-height: 30px; \
  font-size: 14px; color: white; font-family: Trebuchet, Arial, sans-serif; font-weight: bold; \
  -webkit-box-sizing: border-box; \
} \
.odiff-switch-inner .odiff-switch-active { \
  padding-left: 10px; \
  background-color: #4F99FF; color: #FFFFFF; \
} \
.odiff-switch-inner .odiff-switch-inactive { \
  padding-right: 10px; \
  background-color: #EEEEEE; color: #999999; \
  text-align: right; \
} \
.odiff-switch-switch { \
  width: 18px; margin: 6px; \
  background: #FFFFFF; \
  border: 1px solid #999999; border-radius: 20px; \
  position: absolute; top: 0; bottom: 0; right: 116px; \
  -webkit-transition: all 0.3s ease-in 0s; \
} \
.odiff-switch-checkbox:checked + .odiff-switch-label .odiff-switch-inner { \
  margin-left: 0; \
} \
.odiff-switch-checkbox:checked + .odiff-switch-label .odiff-switch-switch { \
  right: 0px; \
}";
if (typeof GM_addStyle != "undefined") {
  GM_addStyle(css);
} else if (typeof PRO_addStyle != "undefined") {
  PRO_addStyle(css);
} else if (typeof addStyle != "undefined") {
  addStyle(css);
} else {
  var heads = document.getElementsByTagName("head");
  if (heads.length > 0) {
    var node = document.createElement("style");
    node.type = "text/css";
    node.appendChild(document.createTextNode(css));
    heads[0].appendChild(node);
  }
}
})();

//
// Add script
//

(function() {
  var js = "function odiffSwitch(switcher) { \
  var hlDiv = document.getElementById('odiffHighlight'); \
  var oDiv = document.getElementById('odiffOriginal'); \
  if(switcher.checked) { \
    hlDiv.style.display = 'block'; \
    oDiv.style.display = 'none'; \
  } else { \
    hlDiv.style.display = 'none'; \
    oDiv.style.display = 'block'; \
  } \
}";
  var heads = document.getElementsByTagName("head");
  if (heads.length > 0) {
    var node = document.createElement("script");
    node.type = "application/javascript";
    node.appendChild(document.createTextNode(js));
    heads[0].appendChild(node);
  }
})();

//
// The following code has been copied/adapted from some various other GM scripts
//

function getNodesByTagNameAndClass(rootNode, tagName, className) {
  var expression = ".//" + tagName + "[contains(concat(' ', @class, ' '), ' " + className + " ')]";
  return evalXPath(expression, rootNode);
}

function evalXPath(expression, rootNode) {
  try {
    var xpathIterator = rootNode.ownerDocument.evaluate(
      expression,
      rootNode,
      null,
      XPathResult.ORDERED_NODE_ITERATOR_TYPE,
      null);
  } catch (err) {
    GM_log("Error when evaluating XPath expression '" + expression + "': " + err);
    return null;
  }
  var results = [];
  for (var xpathNode = xpathIterator.iterateNext();
    xpathNode;
    xpathNode = xpathIterator.iterateNext()) {
    results.push(xpathNode);
  }
  return results;
}
