// ==UserScript==
// @name         Bing Trending Auto & Next Word Search (No Repeats + Hybrid)
// @namespace    bing-auto-search
// @version      6.1
// @description  Bing search assistant that remembers searched words so they NEVER repeat, supports manual Next Word button & automated loop with safe delays.
// @author       dhruvsaini83
// @match        https://www.bing.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // CONFIGURATION & STORAGE KEYS
    // ==========================================
    const WORDS_URL = 'https://raw.githubusercontent.com/dhruvsaini83/bing-word-list/main/words.json';
    const STORAGE_KEY_SEARCHED = 'bing_hybrid_searched_list_v6';
    const STORAGE_KEY_DATE = 'bing_hybrid_searched_date_v6';
    const STORAGE_KEY_AUTO = 'bing_hybrid_auto_running_v6';
    const STORAGE_KEY_MIN_DELAY = 'bing_hybrid_min_delay_v6';
    const STORAGE_KEY_MAX_DELAY = 'bing_hybrid_max_delay_v6';
    const STORAGE_KEY_COLLAPSED = 'bing_hybrid_ui_collapsed_v6';

    const FALLBACK_WORDS = [
        "Amer Fort Jaipur", "Chittorgarh Fort", "Mehrangarh Fort Jodhpur",
        "Jaisalmer Fort", "Hawa Mahal", "City Palace Udaipur",
        "Umaid Bhawan Palace", "Ranthambore National Park", "Sariska Tiger Reserve",
        "Thar Desert Safari", "Pushkar Camel Fair", "Kumbhalgarh Wall",
        "Dal Baati Churma", "Ghoomar Folk Dance", "Kalbelia Dance",
        "Keoladeo Bird Sanctuary", "Chand Baori Abhaneri", "Dilwara Jain Temples",
        "Bikaner Junagarh Fort", "Mount Abu Guru Shikhar", "Brahma Temple Pushkar",
        "Blue Pottery Jaipur", "Bandhani Saree", "Pichwai Painting",
        "Ghevar Sweet", "Pyaaz Kachori", "Laal Maas", "Kathputli Puppet Show",
        "Shekhawati Havelis", "Bundi Stepwells", "Jantar Mantar Observatory",
        "Karni Mata Rat Temple", "Salasar Balaji", "Khatu Shyam Ji Temple",
        "Sambhar Salt Lake", "Chambal River Safari", "Mukundra Hills Tiger",
        "Great Indian Bustard", "Desert National Park", "Aravalli Mountain Range"
    ];

    let wordsList = [];
    let countdownTimer = null;
    let isNavigating = false;

    // ==========================================
    // HELPERS & NORMALIZE
    // ==========================================
    function normalizeText(txt) {
        return String(txt || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function getTodayDateStr() {
        return new Date().toISOString().slice(0, 10); // Format: YYYY-MM-DD
    }

    // ==========================================
    // SEARCHED WORDS TRACKER (NO REPEATS)
    // ==========================================
    function getSearchedWords() {
        const savedDate = localStorage.getItem(STORAGE_KEY_DATE);
        const today = getTodayDateStr();

        // If date has changed (new day), automatically reset search history
        if (savedDate !== today) {
            localStorage.setItem(STORAGE_KEY_DATE, today);
            localStorage.setItem(STORAGE_KEY_SEARCHED, JSON.stringify([]));
            return new Set();
        }

        try {
            const arr = JSON.parse(localStorage.getItem(STORAGE_KEY_SEARCHED) || '[]');
            return new Set(Array.isArray(arr) ? arr.map(w => normalizeText(w)) : []);
        } catch {
            return new Set();
        }
    }

    function markWordAsSearched(word) {
        if (!word) return;
        const norm = normalizeText(word);
        const set = getSearchedWords();
        if (!set.has(norm)) {
            set.add(norm);
            localStorage.setItem(STORAGE_KEY_DATE, getTodayDateStr());
            localStorage.setItem(STORAGE_KEY_SEARCHED, JSON.stringify(Array.from(set)));
        }
    }

    function clearSearchHistory() {
        localStorage.setItem(STORAGE_KEY_DATE, getTodayDateStr());
        localStorage.setItem(STORAGE_KEY_SEARCHED, JSON.stringify([]));
    }

    function getNextUnsearchedItem() {
        const searched = getSearchedWords();
        for (let i = 0; i < wordsList.length; i++) {
            const word = wordsList[i];
            if (!searched.has(normalizeText(word))) {
                return { word, index: i };
            }
        }
        return null; // All words completed
    }

    function isAutoRunning() {
        return localStorage.getItem(STORAGE_KEY_AUTO) === 'true';
    }

    function setAutoRunning(state) {
        localStorage.setItem(STORAGE_KEY_AUTO, state ? 'true' : 'false');
    }

    function getDelayRange() {
        const min = parseInt(localStorage.getItem(STORAGE_KEY_MIN_DELAY) || '5', 10);
        const max = parseInt(localStorage.getItem(STORAGE_KEY_MAX_DELAY) || '8', 10);
        return { min: Math.min(min, max), max: Math.max(min, max) };
    }

    function getRandomDelayMs() {
        const { min, max } = getDelayRange();
        const seconds = Math.floor(Math.random() * (max - min + 1)) + min;
        return seconds * 1000;
    }

    function getURLQuery() {
        const params = new URLSearchParams(window.location.search);
        return params.get('q') || '';
    }

    // ==========================================
    // FETCH WORDS LIST
    // ==========================================
    async function loadWords() {
        try {
            const resp = await fetch(WORDS_URL + '?t=' + Date.now(), { cache: 'no-store' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
                wordsList = data.map(w => String(w).trim()).filter(Boolean);
                return wordsList;
            }
        } catch (err) {
            console.warn('[Bing Assistant] Could not fetch online words, using fallback:', err);
        }
        wordsList = FALLBACK_WORDS;
        return wordsList;
    }

    // ==========================================
    // BING DOM INTERACTION
    // ==========================================
    function getSearchBox() {
        return document.querySelector('#sb_form_q, input[name="q"], textarea[name="q"]');
    }

    function fillSearchBox(text) {
        const input = getSearchBox();
        if (!input) return false;

        const proto = Object.getPrototypeOf(input);
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

        if (descriptor && descriptor.set) {
            descriptor.set.call(input, text);
        } else {
            input.value = text;
        }

        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function executeSearch(query) {
        if (isNavigating || !query) return;
        isNavigating = true;

        markWordAsSearched(query);
        fillSearchBox(query);

        // Try submitting form first; fallback to direct navigation
        const form = document.querySelector('#sb_form');
        if (form && typeof form.submit === 'function') {
            try {
                form.submit();
                return;
            } catch (e) {
                // fall through
            }
        }

        const targetUrl = 'https://www.bing.com/search?q=' + encodeURIComponent(query);
        window.location.href = targetUrl;
    }

    // ==========================================
    // SEARCH QUEUE ACTIONS
    // ==========================================
    function advanceToNextWord(doExecute) {
        if (!wordsList.length) return;

        const nextItem = getNextUnsearchedItem();

        if (!nextItem) {
            stopAutoRun();
            updateUIStatus();
            alert('🎉 Sabhi 40 trending words search ho chuke hain! Aaj ka quota pura ho gaya.');
            return;
        }

        updateUIStatus();

        if (doExecute) {
            executeSearch(nextItem.word);
        } else {
            fillSearchBox(nextItem.word);
        }
    }

    // ==========================================
    // AUTO-RUN CONTROLLER
    // ==========================================
    function startAutoRun() {
        const nextItem = getNextUnsearchedItem();
        if (!nextItem) {
            stopAutoRun();
            updateUIStatus();
            alert('🎉 Sabhi words pehle hi search ho chuke hain! Dubara chalane ke liye Reset dabayein.');
            return;
        }

        setAutoRunning(true);
        updateUIButtons();

        const delayMs = getRandomDelayMs();
        let secondsLeft = Math.round(delayMs / 1000);

        const statusEl = document.getElementById('bing-hud-countdown');
        if (statusEl) statusEl.textContent = `⏳ Next in ${secondsLeft}s...`;

        clearInterval(countdownTimer);
        countdownTimer = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft > 0) {
                if (statusEl) statusEl.textContent = `⏳ Next in ${secondsLeft}s...`;
            } else {
                clearInterval(countdownTimer);
                if (statusEl) statusEl.textContent = `🚀 Searching...`;
                advanceToNextWord(true);
            }
        }, 1000);
    }

    function stopAutoRun() {
        setAutoRunning(false);
        clearInterval(countdownTimer);
        updateUIButtons();
        const statusEl = document.getElementById('bing-hud-countdown');
        if (statusEl) statusEl.textContent = '⏸️ Paused';
    }

    // ==========================================
    // FLOATING UI CREATION
    // ==========================================
    function createFloatingHUD() {
        if (document.getElementById('bing-hybrid-hud')) return;

        const container = document.createElement('div');
        container.id = 'bing-hybrid-hud';

        const isCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';

        container.innerHTML = `
            <style>
                #bing-hybrid-hud {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background: rgba(18, 24, 38, 0.94);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    color: #f1f5f9;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 14px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
                    width: 300px;
                    padding: 14px;
                    box-sizing: border-box;
                    transition: all 0.25s ease;
                }
                #bing-hybrid-hud.collapsed {
                    width: auto;
                    padding: 8px 14px;
                    border-radius: 20px;
                }
                #bing-hybrid-hud.collapsed .hud-body {
                    display: none;
                }
                .hud-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    user-select: none;
                }
                .hud-title {
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                    color: #38bdf8;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .hud-toggle-btn {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 0 4px;
                    line-height: 1;
                }
                .hud-body {
                    margin-top: 12px;
                }
                .hud-word-box {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    padding: 8px 10px;
                    margin-bottom: 12px;
                }
                .hud-word-label {
                    font-size: 11px;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    display: flex;
                    justify-content: space-between;
                }
                .hud-word-text {
                    font-size: 14px;
                    font-weight: 600;
                    color: #ffffff;
                    margin-top: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .hud-actions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .hud-btn {
                    border: none;
                    border-radius: 8px;
                    padding: 8px 10px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    transition: transform 0.1s ease, filter 0.15s ease;
                }
                .hud-btn:active {
                    transform: scale(0.97);
                }
                .hud-btn-primary {
                    background: #2563eb;
                    color: #ffffff;
                }
                .hud-btn-primary:hover {
                    background: #1d4ed8;
                }
                .hud-btn-success {
                    background: #10b981;
                    color: #ffffff;
                }
                .hud-btn-success:hover {
                    background: #059669;
                }
                .hud-btn-danger {
                    background: #ef4444;
                    color: #ffffff;
                }
                .hud-btn-danger:hover {
                    background: #dc2626;
                }
                .hud-btn-secondary {
                    background: rgba(255, 255, 255, 0.08);
                    color: #cbd5e1;
                    grid-column: span 2;
                }
                .hud-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.14);
                }
                .hud-footer {
                    font-size: 11px;
                    color: #94a3b8;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 10px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(255, 255, 255, 0.08);
                }
            </style>

            <div class="hud-header" id="bing-hud-header">
                <span class="hud-title">⚡ Bing Assistant (No-Repeat)</span>
                <button class="hud-toggle-btn" id="bing-hud-collapse" title="Collapse / Expand">_</button>
            </div>

            <div class="hud-body">
                <div class="hud-word-box">
                    <div class="hud-word-label">
                        <span>Next Unsearched Word</span>
                        <span id="bing-hud-index">0 / 40</span>
                    </div>
                    <div class="hud-word-text" id="bing-hud-word">Loading words...</div>
                </div>

                <div class="hud-actions">
                    <button class="hud-btn hud-btn-primary" id="bing-hud-btn-next" title="Search next fresh word">
                        ⏭️ Next Word
                    </button>
                    <button class="hud-btn hud-btn-success" id="bing-hud-btn-auto" title="Start automated search loop">
                        ▶️ Auto Run
                    </button>
                    <button class="hud-btn hud-btn-secondary" id="bing-hud-btn-fill" title="Only put next word in search box">
                        ✏️ Just Fill Box
                    </button>
                </div>

                <div class="hud-footer">
                    <span id="bing-hud-countdown">💤 Ready</span>
                    <span style="cursor: pointer; text-decoration: underline; color: #f87171;" id="bing-hud-btn-reset" title="Clear today's searched words history">Reset History</span>
                </div>
            </div>
        `;

        if (isCollapsed) {
            container.classList.add('collapsed');
        }

        document.body.appendChild(container);

        // Header click to toggle collapse
        document.getElementById('bing-hud-header').addEventListener('click', (e) => {
            if (e.target.id === 'bing-hud-collapse' || e.currentTarget === e.target || e.target.classList.contains('hud-title')) {
                container.classList.toggle('collapsed');
                localStorage.setItem(STORAGE_KEY_COLLAPSED, container.classList.contains('collapsed') ? 'true' : 'false');
            }
        });

        // Next Word Button
        document.getElementById('bing-hud-btn-next').addEventListener('click', () => {
            stopAutoRun();
            advanceToNextWord(true);
        });

        // Just Fill Box Button
        document.getElementById('bing-hud-btn-fill').addEventListener('click', () => {
            stopAutoRun();
            advanceToNextWord(false);
        });

        // Auto Run / Pause Toggle
        document.getElementById('bing-hud-btn-auto').addEventListener('click', () => {
            if (isAutoRunning()) {
                stopAutoRun();
            } else {
                startAutoRun();
            }
        });

        // Reset Counter
        document.getElementById('bing-hud-btn-reset').addEventListener('click', () => {
            if (confirm('Kya aap aaj ki search history reset karna chahte hain?')) {
                stopAutoRun();
                clearSearchHistory();
                updateUIStatus();
                const next = getNextUnsearchedItem();
                if (next) fillSearchBox(next.word);
            }
        });
    }

    function updateUIStatus() {
        const indexEl = document.getElementById('bing-hud-index');
        const wordEl = document.getElementById('bing-hud-word');
        const searched = getSearchedWords();
        const nextItem = getNextUnsearchedItem();

        const searchedCount = Array.from(searched).filter(s => wordsList.some(w => normalizeText(w) === s)).length;

        if (indexEl) {
            indexEl.textContent = `Searched: ${searchedCount} / ${wordsList.length}`;
        }

        if (wordEl) {
            if (nextItem) {
                wordEl.textContent = nextItem.word;
                wordEl.style.color = '#ffffff';
            } else {
                wordEl.textContent = '🎉 All 40 completed!';
                wordEl.style.color = '#4ade80';
            }
        }
    }

    function updateUIButtons() {
        const autoBtn = document.getElementById('bing-hud-btn-auto');
        if (!autoBtn) return;

        if (isAutoRunning()) {
            autoBtn.textContent = '⏸️ Pause';
            autoBtn.className = 'hud-btn hud-btn-danger';
        } else {
            autoBtn.textContent = '▶️ Auto Run';
            autoBtn.className = 'hud-btn hud-btn-success';
        }
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    async function init() {
        await loadWords();
        if (!wordsList.length) return;

        // Check if current page is already a search result (?q=...)
        const currentQuery = getURLQuery();
        if (currentQuery) {
            markWordAsSearched(currentQuery);
        }

        createFloatingHUD();
        updateUIStatus();
        updateUIButtons();

        const nextItem = getNextUnsearchedItem();

        // On home page or if box is empty, pre-fill with next unsearched word
        const box = getSearchBox();
        if (box && (!box.value.trim() || normalizeText(box.value) === normalizeText(currentQuery))) {
            if (nextItem && !currentQuery) {
                fillSearchBox(nextItem.word);
            }
        }

        // If auto-run was ON, continue next search
        if (isAutoRunning()) {
            if (nextItem) {
                startAutoRun();
            } else {
                stopAutoRun();
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
