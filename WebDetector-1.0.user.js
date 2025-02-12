// ==UserScript==
// @name         Web Detector
// @namespace    yolosint
// @version      1.0
// @description  Monitor web pages for specified keywords and log occurrences, consolidating logs into a single file
// @author       thesavant42
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = "webGrepLogs";
    const LOG_FILE_KEY = "webGrepLogFile";
    let lastLoggedURL = "";

    function getUserKeywords() {
        try {
            return JSON.parse(localStorage.getItem("userKeywords")) || [".amazoncognito.com", "access_token", "client_secret", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
        } catch (e) {
            console.error("Error reading user keywords", e);
            return [".amazoncognito.com", "access_token", "client_secret", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
        }
    }

    function saveUserKeywords(keywords) {
        if (!keywords.length) return;
        localStorage.setItem("userKeywords", JSON.stringify(keywords));
    }

    function getSnippet(text, keyword) {
        const index = text.indexOf(keyword);
        if (index === -1) return "";
        const snippetSize = 50;
        return text.slice(Math.max(0, index - snippetSize), index + keyword.length + snippetSize);
    }

    function logMatches(matches) {
        try {
            let logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            let logFile = JSON.parse(localStorage.getItem(LOG_FILE_KEY) || "[]");
            const logEntry = {
                url: window.location.href,
                timestamp: new Date().toISOString(),
                matches
            };

            if (!logs.some(entry => entry.url === logEntry.url)) {
                if (logs.length >= 1000) logs.shift();
                logs.push(logEntry);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
            }

            logFile.push(logEntry);
            localStorage.setItem(LOG_FILE_KEY, JSON.stringify(logFile));
        } catch (e) {
            console.error("Failed to store logs in localStorage", e);
        }
    }

    function createUI() {
        if (document.getElementById("webGrepLoggerUI")) return;

        const ui = document.createElement("div");
        ui.id = "webGrepLoggerUI";
        ui.style.display = "none";
        ui.innerHTML = `
            <div style="position:fixed;bottom:10px;right:10px;background:white;padding:10px;border:1px solid black;z-index:10000;max-width:400px;">
                <h3>Web Grep Logger</h3>
                <div id="logList" style="max-height:200px;overflow:auto;border:1px solid gray;padding:5px;"></div>
                <button id="exportLogs">Export Logs</button>
                <button id="clearLogs">Clear Logs</button>
                <button id="closeUI">Close</button>
            </div>
        `;
        document.body.appendChild(ui);
        document.getElementById("exportLogs").addEventListener("click", exportLogs);
        document.getElementById("clearLogs").addEventListener("click", clearLogs);
        document.getElementById("closeUI").addEventListener("click", () => ui.style.display = "none");
    }

    function showUI() {
        const ui = document.getElementById("webGrepLoggerUI");
        if (ui) {
            ui.style.display = "block";
            updateLogDisplay();
        }
    }

    function updateLogDisplay() {
        const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        const logList = document.getElementById("logList");
        if (logList) {
            logList.innerHTML = logs.map(log => {
    return `<div>
        <b>${log.timestamp}</b><br>
        ${log.url}<br>
        ${log.matches.map(m => `Keyword: ${m.keyword}, Snippet: ${m.snippet}`).join("<br>")}
    </div><hr>`;
}).join("");
        }
    }

    function exportLogs() {
        const logs = localStorage.getItem(STORAGE_KEY);
        if (!logs) return;
        const blob = new Blob([logs], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "web_grep_logs.json";
        a.click();
    }

    function clearLogs() {
        localStorage.removeItem(STORAGE_KEY);
        updateLogDisplay();
    }

    function scanDocument() {
        if (!document.body) return;
        const bodyText = document.body.innerText.toLowerCase();
        const keywords = getUserKeywords().map(k => k.toLowerCase());
        let foundMatches = [];

        keywords.forEach(keyword => {
            if (bodyText.includes(keyword)) {
                const snippet = getSnippet(bodyText, keyword);
                foundMatches.push({ keyword, snippet });
            }
        });

        if (foundMatches.length > 0 && window.location.href !== lastLoggedURL) {
            logMatches(foundMatches);
            lastLoggedURL = window.location.href;
            createUI();
            showUI();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scanDocument);
    } else {
        scanDocument();
    }
})();
