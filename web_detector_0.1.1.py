// ==UserScript==
// @name         web_detector
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  Observes JavaScript, JSON, and other web data for specified keywords.
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configurable keyword list
    const keywords = [
        ".amazoncognito.com",
        "access_token",
        "client_secret",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "OPENAI_API_KEY"
    ];

    // Configurable database name
    const dbName = "WebDetectorDB";
    const storeName = "logs";
    let db;
    let logPanelVisible = false;
    let logFontSize = 12; // Default font size

    function initDB() {
        let request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = function(event) {
            let db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = function(event) {
            db = event.target.result;
        };
        request.onerror = function(event) {
            console.error("IndexedDB error:", event.target.errorCode);
        };
    }

    function logMatch(url, key, value) {
        if (!db) return;
        let transaction = db.transaction([storeName], "readwrite");
        let store = transaction.objectStore(storeName);
        let entry = { timestamp: new Date().toISOString(), url, key, value };
        store.add(entry);
    }

    function retrieveLogs() {
        if (!db) {
            console.warn("Database not initialized yet.");
            return;
        }
        let transaction = db.transaction([storeName], "readonly");
        let store = transaction.objectStore(storeName);
        let request = store.getAll();
        request.onsuccess = function(event) {
            displayLogs(event.target.result);
        };
    }

    function displayLogs(logs) {
        let logPanel = document.getElementById("logPanel");
        if (!logPanel) {
            logPanel = document.createElement("div");
            logPanel.id = "logPanel";
            logPanel.style.position = "fixed";
            logPanel.style.bottom = "10px";
            logPanel.style.right = "10px";
            logPanel.style.width = "400px";
            logPanel.style.height = "300px";
            logPanel.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
            logPanel.style.color = "white";
            logPanel.style.overflowY = "scroll";
            logPanel.style.padding = "10px";
            logPanel.style.borderRadius = "5px";
            logPanel.style.display = "none";
            logPanel.style.fontSize = logFontSize + "px";
            document.body.appendChild(logPanel);
        }
        logPanel.innerHTML = `<h3 style="font-size:${logFontSize + 2}px">Detected Logs</h3>` + 
            logs.map(log => `<div style="font-size:${logFontSize}px"><strong>${log.key}</strong>: ${log.value} <br><small>${log.url}</small></div>`).join("<hr>");
        logPanel.style.display = logPanelVisible ? "block" : "none";
    }

    document.addEventListener("keydown", function(event) {
        if (event.ctrlKey && event.key === "l") {
            logPanelVisible = !logPanelVisible;
            retrieveLogs();
            document.getElementById("logPanel").style.display = logPanelVisible ? "block" : "none";
        }
        if (event.ctrlKey && event.key === "+") {
            logFontSize += 1;
            document.getElementById("logPanel").style.fontSize = logFontSize + "px";
            retrieveLogs();
        }
        if (event.ctrlKey && event.key === "-") {
            logFontSize = Math.max(8, logFontSize - 1);
            document.getElementById("logPanel").style.fontSize = logFontSize + "px";
            retrieveLogs();
        }
    });

    function scanDOM() {
        let textContent = document.documentElement.innerHTML;
        keywords.forEach(keyword => {
            let regex = new RegExp(`['"]?(${keyword})['"]?\s*[:=]\s*['"]?([^'"\s]+)['"]?`, "gi");
            let matches;
            while ((matches = regex.exec(textContent)) !== null) {
                logMatch(window.location.href, matches[1], matches[2]);
                console.log("Match found:", matches[1], "=", matches[2]);
            }
        });
    }

    function observeMutations() {
        const observer = new MutationObserver(scanDOM);
        observer.observe(document, { childList: true, subtree: true, characterData: true });
    }

    function init() {
        initDB();
        scanDOM();
        observeMutations();
    }

    window.addEventListener("load", init);
})();
