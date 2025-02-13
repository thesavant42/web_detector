// ==UserScript==
// @name         web_detector
// @namespace    https://tampermonkey.net/
// @version      1.2.0
// @description  Monitor web pages for specified keywords and log occurrences, including JSON responses, XML, iframes, hidden content, React apps, direct .js file views, and JavaScript variables, consolidating logs into a single file
// @author       thesavant42
// @match        *://*/*
// @match        *://*/*.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = "webGrepLogs";
    const LOG_FILE_KEY = "webGrepLogFile";
    let lastLoggedURL = "";

    function getUserKeywords() {
        try {
            return JSON.parse(localStorage.getItem("userKeywords")) || [".amazoncognito.com", "access_token", "client_secret", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "OPENAI_API_KEY"];
        } catch (e) {
            console.error("Error reading user keywords", e);
            return [".amazoncognito.com", "access_token", "client_secret", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "OPENAI_API_KEY"];
        }
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

    function scanResponseText(text) {
        const keywords = getUserKeywords().map(k => k.trim().toLowerCase()).filter(Boolean);
        let foundMatches = [];

        keywords.forEach(keyword => {
            if (text.toLowerCase().includes(keyword)) {
                const snippet = getSnippet(text, keyword);
                foundMatches.push({ keyword, snippet });
            }
        });

        if (foundMatches.length > 0) {
            logMatches(foundMatches);
        }
    }

    function scanJSVariables() {
        try {
            if (window.process && window.process.env) {
                const envVars = JSON.stringify(window.process.env);
                scanResponseText(envVars);
            }
        } catch (e) {
            console.error("Error scanning JavaScript variables:", e);
        }
    }

    function scanJSFile() {
        if (document.contentType === "application/javascript") {
            scanText(document.documentElement.innerText);
        }
    }

    function scanIframes() {
        document.querySelectorAll("iframe").forEach(iframe => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    scanText(iframeDoc.body.innerText || "");
                }
            } catch (error) {
                console.error("Error accessing iframe content:", error);
            }
        });
    }

    function scanHiddenContent() {
        document.querySelectorAll("[style*='display: none'], [style*='visibility: hidden']").forEach(element => {
            scanText(element.innerText || "");
        });
    }

    function scanText(text) {
        if (!text) return;
        const keywords = getUserKeywords().map(k => k.trim().toLowerCase()).filter(Boolean);
        let foundMatches = [];

        keywords.forEach(keyword => {
            if (text.toLowerCase().includes(keyword)) {
                const snippet = getSnippet(text, keyword);
                foundMatches.push({ keyword, snippet });
            }
        });

        if (foundMatches.length > 0) {
            logMatches(foundMatches);
        }
    }

    function observeDOMChanges() {
        const observer = new MutationObserver(() => scanDocument());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function scanDocument() {
        if (!document.body) return;
        scanText(document.body.innerText);
        scanIframes();
        scanHiddenContent();
        scanJSFile();
        scanJSVariables();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scanDocument);
    } else {
        scanDocument();
    }

    observeDOMChanges();
})();
