// ==UserScript==
// @name         Copy-Full-Path
// @version      0.1
// @description  copy full path
// @author       You
// @match        http://*/flows.rst
// @match        https://*/flows.rst
// @require http://code.jquery.com/jquery-3.4.1.min.js
// ==/UserScript==

(function() {
    'use strict';

    document.addEventListener(
        'load',
        function(){
            var root = window.localStorage.getItem("copyfullpath.root");
            console.log(root);
            if (!root) return;
            root = root.trim();
            if (!root) return;
            if (!root.endsWith("/") || !root.endswith("\\")) root += "/";
            $("strong.copy-to-clipboard").each(function(){
                if (!$(this).attr("fullpathpatched")) {
                    $(this).attr("fullpathpatched", "true");
                    $(this).text(root + $(this).text());
                }
            });
        },
        true
    );

    $(document).ready(function() {
        var a = $("<a href='javascript:void(0)'><i class='hidden-xs fa fa-folder' aria-hidden='true'></i><span class='visible-xs'>设置根路径</span></a>");
        a.on("click", function(){
            var root = window.localStorage.getItem("copyfullpath.root");
            root = prompt("输入数据根路径", root);
            if (!root) return;
            root = root.trim();
            if (!root) return;
            window.localStorage.setItem("copyfullpath.root", root);
        });
        $(".navbar-right").prepend($("<li class='main-nav' style='margin-bottom:0px;'></li>").append(a));
    });
})();