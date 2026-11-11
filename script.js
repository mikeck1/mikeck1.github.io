(() => {
    'use strict';

    /* ======================================================================
       Constants
       ====================================================================== */

    const KEYS = {
        game: 'wl.game.v2',
        deck: 'wl.deck.v1',
        seenHelp: 'wl.seenHelp',
        legacyGame: 'wavelengthGameState',
    };

    const TEAM_COLORS = ['#ff5d8f', '#4cc9f0', '#ffc94a', '#3ee6b0', '#a78bfa', '#ff8a5c'];

    // Left/right colors for spectrum cards; picked per card so each one looks distinct.
    const CARD_COLORS = [
        ['#3e63dd', '#e5484d'],
        ['#7b4dff', '#f76b15'],
        ['#12a594', '#d6409f'],
        ['#0091ff', '#e54666'],
        ['#8e4ec6', '#30a46c'],
        ['#0d9488', '#ea580c'],
        ['#2563eb', '#db2777'],
        ['#6e56cf', '#e5484d'],
    ];
    const BRAND_COLORS = ['#ff5d8f', '#7c5cff'];

    const MAX_TEAMS = 6;
    const MAX_CARD_LEN = 60;
    const CX = 200;
    const CY = 200;

    // Score bands: half-width in degrees from the target center.
    const BANDS = [
        { pts: 5, half: 4.5 },
        { pts: 3, half: 13.5 },
        { pts: 1, half: 22.5 },
    ];

    const SCORE_TEXT = { 5: 'Bullseye!', 3: 'So close!', 1: 'Not bad!', 0: 'Missed it!' };
    const SCORE_COLOR = { 5: 'var(--band-5)', 3: 'var(--band-3)', 1: 'var(--band-1)', 0: '#b9b2df' };

    // Used only if clues.json can't be loaded.
    const FALLBACK_DECK = [
        ['Cold', 'Hot'], ['Tiny', 'Giant'], ['Slow', 'Fast'], ['Quiet', 'Loud'],
        ['Soft', 'Hard'], ['Yucky Food', 'Yummy Food'], ['Boring Toy', 'Awesome Toy'],
        ['Not Scary', 'Very Scary'], ['Real', 'Make-Believe'], ['Underrated', 'Overrated'],
    ];

    /* ======================================================================
       Helpers
       ====================================================================== */

    const $ = (sel, root = document) => root.querySelector(sel);

    const store = {
        get(key) {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : null;
            } catch {
                return null;
            }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch { /* ignore */ }
        },
    };

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const icon = (name) => `<svg class="i"><use href="#i-${name}"/></svg>`;
    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

    function debounce(fn, ms) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    }

    function hash(str) {
        let h = 5381;
        for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
        return h;
    }

    function restartAnimation(el, cls) {
        el.classList.remove(cls);
        void el.offsetWidth;
        el.classList.add(cls);
    }

    /* ======================================================================
       Cards: parsing, normalizing, keys
       ====================================================================== */

    const cleanText = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CARD_LEN);
    const cardKey = (l, r) => `${cleanText(l).toLowerCase()}|${cleanText(r).toLowerCase()}`;

    function splitCsv(line) {
        const out = [];
        let cur = '';
        let quoted = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (quoted) {
                if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
                else if (ch === '"') quoted = false;
                else cur += ch;
            } else if (ch === '"') {
                quoted = true;
            } else if (ch === ',') {
                out.push(cur);
                cur = '';
            } else {
                cur += ch;
            }
        }
        out.push(cur);
        return out;
    }

    // Split "Left | Right" style lines. Returns [left, right] or null.
    function splitLine(line) {
        for (const sep of ['|', '\t', '↔', '<->', '<>']) {
            if (line.includes(sep)) {
                const parts = line.split(sep);
                return parts.length === 2 ? parts : null;
            }
        }
        const csv = splitCsv(line);
        if (csv.length === 2) return csv;
        for (const sep of [' - ', ' – ', ' — ']) {
            if (line.includes(sep)) {
                const parts = line.split(sep);
                return parts.length === 2 ? parts : null;
            }
        }
        return null;
    }

    function toPair(item) {
        if (Array.isArray(item) && item.length >= 2) return [cleanText(item[0]), cleanText(item[1])];
        if (item && typeof item === 'object') {
            const l = item.left ?? item.l ?? item.min;
            const r = item.right ?? item.r ?? item.max;
            if (l != null && r != null) return [cleanText(l), cleanText(r)];
        }
        if (typeof item === 'string') {
            const parts = splitLine(item);
            if (parts) return [cleanText(parts[0]), cleanText(parts[1])];
        }
        return null;
    }

    function pairsFromList(list) {
        const cards = [];
        const seen = new Set();
        let skipped = 0;
        let dupes = 0;
        for (const item of list) {
            const pair = toPair(item);
            if (!pair || !pair[0] || !pair[1]) { skipped++; continue; }
            const key = cardKey(...pair);
            if (seen.has(key)) { dupes++; continue; }
            seen.add(key);
            cards.push(pair);
        }
        return { cards, skipped, dupes };
    }

    // Accepts: JSON array of pairs, JSON {cards: [...]}, CSV, or one "Left | Right" per line.
    function parseCards(text) {
        const t = String(text || '').trim();
        if (!t) return { cards: [], skipped: 0, dupes: 0 };

        if (/^[\[{]/.test(t)) {
            try {
                const data = JSON.parse(t);
                const list = Array.isArray(data) ? data : (data.cards || data.deck || data.clues || []);
                if (Array.isArray(list)) return pairsFromList(list);
            } catch {
                /* not JSON; fall through to line parsing */
            }
        }

        const lines = t.split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'))
            .filter((l, i) => !(i === 0 && /^"?left"?\s*[,|\t]\s*"?right"?$/i.test(l)));
        return pairsFromList(lines);
    }

    /* ======================================================================
       Deck
       ====================================================================== */

    let uid = 0;
    let defaultDeck = [];
    let deck = []; // [{ id, left, right }]
    let deckIsCustom = false;

    const makeItem = ([left, right]) => ({ id: ++uid, left, right });
    const isPlayable = (c) => c.left.trim() && c.right.trim();
    const playableCards = () => deck.filter(isPlayable).map((c) => [c.left.trim(), c.right.trim()]);
    const deckKeys = () => new Set(deck.filter(isPlayable).map((c) => cardKey(c.left, c.right)));

    async function loadDefaultDeck() {
        try {
            const res = await fetch('clues.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { cards } = pairsFromList(await res.json());
            if (cards.length) return cards;
        } catch (err) {
            console.warn('Could not load clues.json, using fallback deck.', err);
        }
        return FALLBACK_DECK.map((c) => c.slice());
    }

    function loadDeck() {
        const saved = store.get(KEYS.deck);
        if (saved && Array.isArray(saved.cards)) {
            deckIsCustom = true;
            return saved.cards
                .map(toPair)
                .filter((p) => p && (p[0] || p[1]))
                .map(makeItem);
        }
        deckIsCustom = false;
        return defaultDeck.map(makeItem);
    }

    function saveDeck() {
        deckIsCustom = true;
        store.set(KEYS.deck, {
            updated: new Date().toISOString(),
            cards: deck.filter((c) => c.left.trim() || c.right.trim()).map((c) => [c.left, c.right]),
        });
    }

    const saveDeckSoon = debounce(saveDeck, 250);

    function cardColors(card) {
        if (!card) return BRAND_COLORS;
        return CARD_COLORS[hash(cardKey(card[0], card[1])) % CARD_COLORS.length];
    }

    /* ======================================================================
       Game state
       ====================================================================== */

    const PHASES = ['ready', 'psychic', 'guess', 'reveal'];

    function defaultState() {
        return {
            teams: [
                { name: 'Team 1', score: 0, color: 0 },
                { name: 'Team 2', score: 0, color: 1 },
            ],
            current: 0,
            round: 1,
            phase: 'ready',
            target: 0,
            needle: 0,
            card: null,
            lastScore: null,
            seen: [],
        };
    }

    function loadState() {
        const base = defaultState();
        const saved = store.get(KEYS.game);
        let s = base;

        if (saved && Array.isArray(saved.teams) && saved.teams.length) {
            s = { ...base, ...saved };
        } else {
            // Carry over team names and scores from the previous version of the app.
            const legacy = store.get(KEYS.legacyGame);
            if (legacy && Array.isArray(legacy.teams) && legacy.teams.length) {
                s.teams = legacy.teams.map((t, i) => ({ name: String(t.name || ''), score: Number(t.score) || 0, color: i }));
                s.current = Number(legacy.currentTeamIndex) || 0;
            }
        }

        s.teams = s.teams.slice(0, MAX_TEAMS).map((t, i) => ({
            name: typeof t.name === 'string' ? t.name.slice(0, 24) : `Team ${i + 1}`,
            score: Number.isFinite(t.score) ? t.score : 0,
            color: Number.isInteger(t.color) ? t.color % TEAM_COLORS.length : i % TEAM_COLORS.length,
        }));
        s.current = clamp(Number(s.current) || 0, 0, s.teams.length - 1);
        s.round = Math.max(1, Number(s.round) || 1);
        s.target = clamp(Number(s.target) || 0, -90, 90);
        s.needle = clamp(Number(s.needle) || 0, -90, 90);
        s.seen = Array.isArray(s.seen) ? s.seen : [];
        if (!Array.isArray(s.card) || s.card.length !== 2) s.card = null;
        if (!PHASES.includes(s.phase) || (s.phase !== 'ready' && !s.card)) s.phase = 'ready';
        if (s.phase === 'reveal' && !Number.isFinite(s.lastScore)) s.lastScore = scoreFor(s.needle, s.target);
        return s;
    }

    let state = defaultState();
    let suspense = false; // true for a moment while the shutter opens on reveal

    const save = () => store.set(KEYS.game, state);
    const teamName = (t, i) => (t.name.trim() || `Team ${i + 1}`);
    const currentTeam = () => state.teams[state.current] || state.teams[0];
    const teamColor = (t) => TEAM_COLORS[t.color % TEAM_COLORS.length];

    function scoreFor(needle, target) {
        const diff = Math.abs(needle - target);
        for (const band of BANDS) if (diff <= band.half) return band.pts;
        return 0;
    }

    function drawCard(exclude) {
        const pool = playableCards();
        if (!pool.length) return null;
        const excludeKey = exclude ? cardKey(exclude[0], exclude[1]) : null;
        const notExcluded = (c) => pool.length === 1 || cardKey(c[0], c[1]) !== excludeKey;

        let seen = new Set(state.seen);
        let candidates = pool.filter((c) => !seen.has(cardKey(c[0], c[1])) && notExcluded(c));
        if (!candidates.length) {
            // Everyone has seen every card: reshuffle.
            state.seen = [];
            seen = new Set();
            candidates = pool.filter(notExcluded);
        }
        const card = candidates[Math.floor(Math.random() * candidates.length)];
        state.seen.push(cardKey(card[0], card[1]));
        if (state.seen.length > pool.length) state.seen = state.seen.slice(-pool.length);
        return card;
    }

    /* ======================================================================
       DOM references
       ====================================================================== */

    const root = document.documentElement;
    const scoreboardEl = $('#scoreboard');
    const turnEl = $('#turn');
    const turnEyebrow = $('#turnEyebrow');
    const turnTitle = $('#turnTitle');
    const turnHint = $('#turnHint');
    const dialWrap = $('#dialWrap');
    const dial = $('#dial');
    const targetG = $('#target');
    const needleG = $('#needle');
    const dialCta = $('#dialCta');
    const floatPoints = $('#floatPoints');
    const cardEl = $('#card');
    const cardLeft = $('#cardLeft');
    const cardRight = $('#cardRight');
    const actionsEl = $('#actions');
    const deckBadge = $('#deckBadge');
    const rimA = $('#rimA');
    const rimB = $('#rimB');
    const toastRegion = $('#toasts');

    /* ======================================================================
       Dial drawing (static parts)
       ====================================================================== */

    const polar = (angleDeg, r) => {
        const a = (angleDeg * Math.PI) / 180;
        return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
    };

    function wedgePath(a1, a2, r) {
        const [x1, y1] = polar(a1, r);
        const [x2, y2] = polar(a2, r);
        return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    }

    function buildDial() {
        // Target bands, drawn centered on 0deg; the group is rotated to the target angle.
        const edges = [-22.5, -13.5, -4.5, 4.5, 13.5, 22.5];
        const bandFor = [1, 3, 5, 3, 1];
        let svg = '';
        for (let i = 0; i < 5; i++) {
            svg += `<path class="band-${bandFor[i]}" d="${wedgePath(edges[i], edges[i + 1], 196)}"/>`;
        }
        for (const e of edges.slice(1, -1)) {
            const [x, y] = polar(e, 196);
            svg += `<line class="band-line" x1="${CX}" y1="${CY}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"/>`;
        }
        // Labels get counter-rotated in renderDial so they always read upright.
        for (let i = 0; i < 5; i++) {
            const mid = (edges[i] + edges[i + 1]) / 2;
            const [x, y] = polar(mid, 160);
            svg += `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}">${bandFor[i]}</text>`;
        }
        targetG.innerHTML = svg;

        // Shutter rays
        let rays = '';
        for (let a = -80; a <= 80; a += 10) {
            const [x1, y1] = polar(a, 44);
            const [x2, y2] = polar(a, 200);
            rays += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
        }
        $('#shutterRays').innerHTML = rays;

        // Tick marks
        let ticks = '';
        for (let a = -90; a <= 90; a += 10) {
            const major = a % 45 === 0;
            const [x1, y1] = polar(a, major ? 172 : 179);
            const [x2, y2] = polar(a, 187);
            ticks += `<line class="${major ? 'major' : ''}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
        }
        $('#ticks').innerHTML = ticks;
    }

    /* ======================================================================
       Rendering
       ====================================================================== */

    let lastPhaseRendered = null;

    function render() {
        const team = currentTeam();
        root.style.setProperty('--team', teamColor(team));
        renderScoreboard();
        renderTurn();
        renderDial();
        renderCard();
        renderActions();
        renderDeckBadge();
        save();
    }

    function renderScoreboard() {
        scoreboardEl.innerHTML = state.teams.map((t, i) => {
            const shown = suspense && i === state.current ? t.score - (state.lastScore || 0) : t.score;
            return `<button type="button" class="team-chip${i === state.current ? ' is-current' : ''}" style="--c:${teamColor(t)}" data-i="${i}" title="Edit teams">
                <span class="dot"></span><span class="name">${esc(teamName(t, i))}</span><span class="pts">${shown}</span>
            </button>`;
        }).join('');
    }

    function renderTurn() {
        const team = currentTeam();
        const name = esc(teamName(team, state.current));
        const noCards = playableCards().length === 0;
        let eyebrow;
        let title;
        let hint;

        if (state.phase === 'ready' && noCards) {
            eyebrow = `Round ${state.round}`;
            title = 'Your deck is empty';
            hint = 'Add a few cards to start playing.';
        } else if (state.phase === 'ready') {
            eyebrow = `Round ${state.round} · ${name}`;
            title = `Pass to ${name}'s psychic`;
            hint = 'Everyone else, look away from the screen!';
        } else if (state.phase === 'psychic') {
            eyebrow = `${name} · Psychic`;
            title = 'Give your team a clue';
            hint = 'Say something that sits right on the target between the two ends.';
        } else if (state.phase === 'guess') {
            eyebrow = `${name} · Guessing`;
            title = 'Where does the clue land?';
            hint = 'Talk it over, then drag the needle to your guess.';
        } else if (suspense) {
            eyebrow = `${name} · Round ${state.round}`;
            title = 'And the target is…';
            hint = '&nbsp;';
        } else {
            const pts = state.lastScore || 0;
            eyebrow = `${name} · Round ${state.round}`;
            title = pts ? `<span class="hl">+${pts}</span> ${SCORE_TEXT[pts]}` : SCORE_TEXT[0];
            hint = `${name} ${pts ? 'now has' : 'stays at'} ${plural(team.score, 'point')}.`;
        }

        turnEyebrow.innerHTML = eyebrow;
        turnTitle.innerHTML = title;
        turnHint.innerHTML = hint;

        const key = `${state.phase}:${suspense}`;
        if (key !== lastPhaseRendered) {
            restartAnimation(turnEl, 'enter');
            lastPhaseRendered = key;
        }
    }

    function renderDial() {
        const { phase } = state;
        const noCards = playableCards().length === 0;
        dial.classList.toggle('is-open', phase === 'psychic' || phase === 'reveal');
        dial.classList.toggle('no-needle', phase !== 'guess' && phase !== 'reveal');
        dial.classList.toggle('can-drag', phase === 'guess');
        dial.classList.toggle('is-ready', phase === 'ready' && !noCards);
        dial.tabIndex = phase === 'guess' ? 0 : -1;
        targetG.setAttribute('transform', `rotate(${state.target.toFixed(2)} ${CX} ${CY})`);
        targetG.querySelectorAll('text').forEach((t) => {
            t.setAttribute('transform', `rotate(${(-state.target).toFixed(2)} ${t.getAttribute('x')} ${t.getAttribute('y')})`);
        });
        setNeedle(state.needle);
        dialCta.hidden = phase !== 'ready' || noCards;

        const [a, b] = state.phase === 'ready' ? BRAND_COLORS : cardColors(state.card);
        rimA.setAttribute('stop-color', a);
        rimB.setAttribute('stop-color', b);
        $('.hub-dot', dial).style.fill = teamColor(currentTeam());
    }

    function setNeedle(angle) {
        needleG.setAttribute('transform', `rotate(${angle.toFixed(2)} ${CX} ${CY})`);
        dial.setAttribute('aria-valuenow', Math.round(angle));
    }

    function renderCard() {
        const down = state.phase === 'ready' || !state.card;
        cardEl.classList.toggle('is-down', down);
        if (state.card) {
            const [a, b] = cardColors(state.card);
            cardEl.style.setProperty('--card-a', a);
            cardEl.style.setProperty('--card-b', b);
            cardLeft.textContent = state.card[0];
            cardRight.textContent = state.card[1];
        }
    }

    function renderActions() {
        const { phase } = state;
        const noCards = playableCards().length === 0;
        let html = '';

        if (phase === 'ready' && noCards) {
            html = `<button class="btn btn-primary btn-lg" data-act="open-deck">${icon('cards')} Open deck</button>`;
        } else if (phase === 'ready') {
            html = `<button class="btn btn-primary btn-lg" data-act="peek">${icon('eye')} Reveal target</button>`;
        } else if (phase === 'psychic') {
            html = `<button class="btn btn-secondary btn-lg" data-act="new-card">${icon('shuffle')} New card</button>
                    <button class="btn btn-primary btn-lg" data-act="hide">${icon('eye-off')} Hide target</button>`;
        } else if (phase === 'guess') {
            html = `<button class="btn btn-primary btn-lg" data-act="reveal">${icon('target')} Lock in &amp; reveal</button>`;
        } else {
            const next = state.teams.length > 1
                ? `Next: ${esc(teamName(state.teams[(state.current + 1) % state.teams.length], (state.current + 1) % state.teams.length))}`
                : 'Next round';
            html = `<button class="btn btn-primary btn-lg" data-act="next" ${suspense ? 'disabled' : ''}>${next} ${icon('arrow-right')}</button>`;
        }
        actionsEl.innerHTML = html;
    }

    function renderDeckBadge() {
        deckBadge.textContent = playableCards().length;
    }

    /* ======================================================================
       Game flow
       ====================================================================== */

    function startPsychicTurn() {
        if (state.phase !== 'ready') return;
        const card = drawCard();
        if (!card) {
            openDeck();
            return;
        }
        state.card = card;
        state.target = Math.random() * 180 - 90;
        state.needle = 0;
        state.lastScore = null;
        state.phase = 'psychic';
        render();
    }

    function newCard() {
        if (state.phase !== 'psychic') return;
        const card = drawCard(state.card);
        if (!card) return;
        state.card = card;
        cardEl.classList.add('is-down');
        setTimeout(render, 320);
    }

    function hideTarget() {
        if (state.phase !== 'psychic') return;
        state.phase = 'guess';
        state.needle = 0;
        render();
        dial.focus({ preventScroll: true });
    }

    function revealTarget() {
        if (state.phase !== 'guess') return;
        const pts = scoreFor(state.needle, state.target);
        state.lastScore = pts;
        currentTeam().score += pts;
        state.phase = 'reveal';
        suspense = true;
        render();

        setTimeout(() => {
            suspense = false;
            render();
            showPoints(pts);
        }, 850);
    }

    function nextRound() {
        if (state.phase !== 'reveal' || suspense) return;
        state.current = (state.current + 1) % state.teams.length;
        state.round += 1;
        state.phase = 'ready';
        state.card = null;
        state.needle = 0;
        state.lastScore = null;
        render();
    }

    function newGame() {
        state.teams.forEach((t) => { t.score = 0; });
        state.current = 0;
        state.round = 1;
        state.phase = 'ready';
        state.card = null;
        state.needle = 0;
        state.lastScore = null;
        suspense = false;
        render();
    }

    function showPoints(pts) {
        floatPoints.textContent = pts ? `+${pts}` : '0';
        floatPoints.style.color = SCORE_COLOR[pts];
        restartAnimation(floatPoints, 'go');

        const chip = scoreboardEl.querySelector('.team-chip.is-current');
        if (chip && pts) restartAnimation(chip, 'bump');

        if (pts === 0) {
            restartAnimation(dialWrap, 'shake');
            return;
        }
        if (typeof window.confetti !== 'function') return;

        const rect = dialWrap.getBoundingClientRect();
        const origin = { x: (rect.left + rect.width / 2) / innerWidth, y: (rect.top + rect.height * 0.55) / innerHeight };
        const colors = [...cardColors(state.card), '#ffc94a', '#5ef0c4', '#ffffff'];

        if (pts === 5) {
            window.confetti({ particleCount: 140, spread: 100, startVelocity: 42, origin, colors, scalar: 1.1 });
            setTimeout(() => {
                window.confetti({ particleCount: 70, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
                window.confetti({ particleCount: 70, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
            }, 220);
        } else if (pts === 3) {
            window.confetti({ particleCount: 45, spread: 60, startVelocity: 30, origin, colors, scalar: 0.9 });
        }
    }

    /* ======================================================================
       Needle input
       ====================================================================== */

    let dragging = false;

    function angleFromEvent(e) {
        const rect = dial.getBoundingClientRect();
        const s = rect.width / 400;
        const cx = rect.left + CX * s;
        const cy = rect.top + CY * s;
        const dx = e.clientX - cx;
        const dy = Math.max(cy - e.clientY, 0.0001);
        return clamp((Math.atan2(dx, dy) * 180) / Math.PI, -90, 90);
    }

    function wireDial() {
        dial.addEventListener('pointerdown', (e) => {
            if (state.phase === 'ready') {
                startPsychicTurn();
                return;
            }
            if (state.phase !== 'guess') return;
            e.preventDefault();
            dragging = true;
            dial.setPointerCapture(e.pointerId);
            dial.classList.add('dragging');
            state.needle = angleFromEvent(e);
            setNeedle(state.needle);
        });

        dial.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            state.needle = angleFromEvent(e);
            setNeedle(state.needle);
        });

        const end = () => {
            if (!dragging) return;
            dragging = false;
            dial.classList.remove('dragging');
            save();
        };
        dial.addEventListener('pointerup', end);
        dial.addEventListener('pointercancel', end);

        dial.addEventListener('keydown', (e) => {
            if (state.phase !== 'guess') return;
            const step = e.shiftKey ? 5 : 1;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') state.needle = clamp(state.needle - step, -90, 90);
            else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') state.needle = clamp(state.needle + step, -90, 90);
            else if (e.key === 'Enter') { revealTarget(); return; }
            else return;
            e.preventDefault();
            setNeedle(state.needle);
            save();
        });

        dialCta.addEventListener('click', startPsychicTurn);
    }

    /* ======================================================================
       Dialogs, confirm, toasts
       ====================================================================== */

    const dialogStack = [];

    function openDialog(dlg) {
        if (dlg.open) return;
        dlg.showModal();
        dialogStack.push(dlg);
    }

    function wireDialogs() {
        document.querySelectorAll('dialog').forEach((dlg) => {
            let downOnBackdrop = false;
            dlg.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dlg; });
            dlg.addEventListener('click', (e) => {
                if (e.target === dlg && downOnBackdrop) dlg.close();
            });
            dlg.addEventListener('close', () => {
                const i = dialogStack.lastIndexOf(dlg);
                if (i !== -1) dialogStack.splice(i, 1);
                const host = dialogStack[dialogStack.length - 1] || document.body;
                if (toastRegion.parentNode !== host) host.append(toastRegion);
            });
            dlg.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => dlg.close()));
        });
    }

    function confirmAsk({ title, message, ok = 'OK', danger = false }) {
        const dlg = $('#confirmDialog');
        const okBtn = $('#confirmOk');
        $('#confirmTitle').textContent = title;
        $('#confirmMessage').textContent = message;
        okBtn.textContent = ok;
        okBtn.classList.toggle('btn-danger-solid', danger);
        dlg.returnValue = '';
        return new Promise((resolve) => {
            dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
            openDialog(dlg);
            okBtn.focus();
        });
    }

    function toast(message, { action, onAction, duration = 3500 } = {}) {
        // Dialogs live in the top layer, so toasts must be inside the topmost one to be visible.
        const host = dialogStack[dialogStack.length - 1] || document.body;
        if (toastRegion.parentNode !== host) host.append(toastRegion);

        const el = document.createElement('div');
        el.className = 'toast';
        const text = document.createElement('span');
        text.textContent = message;
        el.append(text);

        let timer;
        const dismiss = () => {
            clearTimeout(timer);
            el.classList.add('out');
            el.addEventListener('animationend', () => el.remove(), { once: true });
        };

        if (action) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = action;
            btn.addEventListener('click', () => { onAction?.(); dismiss(); });
            el.append(btn);
        }

        toastRegion.append(el);
        while (toastRegion.children.length > 3) toastRegion.firstElementChild.remove();
        timer = setTimeout(dismiss, duration);
    }

    /* ======================================================================
       Teams dialog
       ====================================================================== */

    const teamsDialog = $('#teamsDialog');
    const teamList = $('#teamList');
    const addTeamBtn = $('#addTeamBtn');

    function openTeams() {
        renderTeams();
        openDialog(teamsDialog);
    }

    function renderTeams() {
        teamList.innerHTML = state.teams.map((t, i) => `
            <li class="team-row${i === state.current ? ' is-current' : ''}" style="--c:${teamColor(t)}" data-i="${i}">
                <button type="button" class="team-swatch" data-act="color" title="Change color" aria-label="Change team color"></button>
                <input type="text" value="${esc(t.name)}" placeholder="Team ${i + 1}" maxlength="24" aria-label="Team name" data-act="name" />
                <div class="stepper">
                    <button type="button" class="icon-btn" data-act="minus" aria-label="Remove a point">${icon('minus')}</button>
                    <output>${t.score}</output>
                    <button type="button" class="icon-btn" data-act="plus" aria-label="Add a point">${icon('plus')}</button>
                </div>
                <button type="button" class="icon-btn danger" data-act="delete" aria-label="Remove team" ${state.teams.length === 1 ? 'disabled' : ''}>${icon('trash')}</button>
            </li>`).join('');
        addTeamBtn.disabled = state.teams.length >= MAX_TEAMS;
    }

    function wireTeams() {
        teamList.addEventListener('input', (e) => {
            const row = e.target.closest('.team-row');
            if (!row || e.target.dataset.act !== 'name') return;
            state.teams[Number(row.dataset.i)].name = e.target.value.slice(0, 24);
            render();
        });

        teamList.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-act]');
            const row = e.target.closest('.team-row');
            if (!btn || !row) return;
            const i = Number(row.dataset.i);
            const team = state.teams[i];

            switch (btn.dataset.act) {
                case 'plus':
                    team.score += 1;
                    break;
                case 'minus':
                    team.score -= 1;
                    break;
                case 'color': {
                    const used = new Set(state.teams.map((t) => t.color));
                    let next = team.color;
                    for (let k = 1; k <= TEAM_COLORS.length; k++) {
                        const c = (team.color + k) % TEAM_COLORS.length;
                        if (!used.has(c) || k === TEAM_COLORS.length) { next = c; break; }
                    }
                    team.color = next;
                    break;
                }
                case 'delete': {
                    if (state.teams.length <= 1) return;
                    const [removed] = state.teams.splice(i, 1);
                    const wasCurrent = state.current;
                    if (state.current > i || state.current >= state.teams.length) state.current = Math.max(0, state.current - 1);
                    toast(`Removed ${teamName(removed, i)}`, {
                        action: 'Undo',
                        onAction: () => {
                            if (state.teams.length >= MAX_TEAMS) return;
                            state.teams.splice(i, 0, removed);
                            state.current = wasCurrent;
                            render();
                            renderTeams();
                        },
                    });
                    break;
                }
                default:
                    return;
            }
            render();
            renderTeams();
        });

        addTeamBtn.addEventListener('click', () => {
            if (state.teams.length >= MAX_TEAMS) return;
            const used = new Set(state.teams.map((t) => t.color));
            const color = [...TEAM_COLORS.keys()].find((c) => !used.has(c)) ?? state.teams.length % TEAM_COLORS.length;
            state.teams.push({ name: `Team ${state.teams.length + 1}`, score: 0, color });
            render();
            renderTeams();
            const inputs = teamList.querySelectorAll('input');
            inputs[inputs.length - 1]?.select();
        });

        $('#resetScoresBtn').addEventListener('click', async () => {
            const ok = await confirmAsk({ title: 'Reset scores?', message: 'Every team goes back to 0 points.', ok: 'Reset', danger: true });
            if (!ok) return;
            state.teams.forEach((t) => { t.score = 0; });
            render();
            renderTeams();
        });
    }

    /* ======================================================================
       Deck editor
       ====================================================================== */

    const deckDialog = $('#deckDialog');
    const deckList = $('#deckList');
    const deckEmpty = $('#deckEmpty');
    const deckSearch = $('#deckSearch');
    const deckSummary = $('#deckSummary');

    function openDeck() {
        deckSearch.value = '';
        renderDeckList();
        openDialog(deckDialog);
    }

    function renderDeckSummary() {
        const playable = deck.filter(isPlayable).length;
        const incomplete = deck.filter((c) => !isPlayable(c) && (c.left.trim() || c.right.trim())).length;
        let text = `${plural(playable, 'card')} · ${deckIsCustom ? 'Your custom deck' : 'Default deck'}`;
        if (incomplete) text += ` · ${incomplete} incomplete (skipped in play)`;
        deckSummary.textContent = text;
        renderDeckBadge();
    }

    function deckRowHtml(c, isNew = false) {
        const incomplete = !isPlayable(c);
        return `<li class="deck-row${incomplete ? ' is-incomplete' : ''}${isNew ? ' is-new' : ''}" data-id="${c.id}">
            <input type="text" data-side="left" value="${esc(c.left)}" placeholder="Left end" maxlength="${MAX_CARD_LEN}" aria-label="Left end" />
            <span class="arrow" aria-hidden="true">${icon('arrows')}</span>
            <input type="text" data-side="right" value="${esc(c.right)}" placeholder="Right end" maxlength="${MAX_CARD_LEN}" aria-label="Right end" />
            <button type="button" class="icon-btn danger" data-act="delete" aria-label="Delete card">${icon('trash')}</button>
        </li>`;
    }

    function renderDeckList({ newId } = {}) {
        const q = deckSearch.value.trim().toLowerCase();
        const items = q ? deck.filter((c) => `${c.left} ${c.right}`.toLowerCase().includes(q)) : deck;
        deckList.innerHTML = items.map((c) => deckRowHtml(c, c.id === newId)).join('');

        deckEmpty.hidden = items.length > 0;
        if (!items.length) {
            deckEmpty.innerHTML = q
                ? `<strong>No matches</strong>No cards contain "${esc(deckSearch.value.trim())}".`
                : '<strong>No cards yet</strong>Add a card, import a deck, or restore the default deck.';
        }
        renderDeckSummary();
    }

    // Blank cards are never written to storage, so this only tidies the in-memory list.
    function pruneEmptyCards() {
        deck = deck.filter((c) => c.left.trim() || c.right.trim());
    }

    function exportDeck() {
        const cards = playableCards();
        if (!cards.length) {
            toast('Nothing to export yet');
            return;
        }
        const data = {
            name: 'Wavelength deck',
            exported: new Date().toISOString(),
            count: cards.length,
            cards,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wavelength-deck-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(`Exported ${plural(cards.length, 'card')}`);
    }

    function wireDeck() {
        deckSearch.addEventListener('input', debounce(() => renderDeckList(), 120));

        deckList.addEventListener('input', (e) => {
            const input = e.target;
            const row = input.closest('.deck-row');
            if (!row || !input.dataset.side) return;
            const card = deck.find((c) => c.id === Number(row.dataset.id));
            if (!card) return;
            card[input.dataset.side] = input.value;
            row.classList.toggle('is-incomplete', !isPlayable(card));
            saveDeckSoon();
            renderDeckSummary();
        });

        // Enter in the left box jumps to the right box; Enter in the right box adds a new card.
        deckList.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const input = e.target;
            const row = input.closest('.deck-row');
            if (!row) return;
            e.preventDefault();
            if (input.dataset.side === 'left') row.querySelector('[data-side="right"]').focus();
            else addCard();
        });

        deckList.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act="delete"]');
            if (!btn) return;
            const row = btn.closest('.deck-row');
            const index = deck.findIndex((c) => c.id === Number(row.dataset.id));
            if (index === -1) return;
            const [removed] = deck.splice(index, 1);
            row.remove();
            saveDeck();
            renderDeckSummary();
            if (!deckList.children.length) renderDeckList();
            if (removed.left.trim() || removed.right.trim()) {
                toast('Card deleted', {
                    action: 'Undo',
                    onAction: () => {
                        deck.splice(Math.min(index, deck.length), 0, removed);
                        saveDeck();
                        renderDeckList();
                    },
                });
            }
        });

        $('#addCardBtn').addEventListener('click', addCard);
        $('#exportBtn').addEventListener('click', exportDeck);
        $('#importBtn').addEventListener('click', openImport);

        $('#resetDeckBtn').addEventListener('click', async () => {
            const ok = await confirmAsk({
                title: 'Restore the default deck?',
                message: `This replaces your current deck with the ${defaultDeck.length} built-in cards. Export first if you want to keep your cards.`,
                ok: 'Restore',
                danger: true,
            });
            if (!ok) return;
            deck = defaultDeck.map(makeItem);
            deckIsCustom = false;
            store.remove(KEYS.deck);
            deckSearch.value = '';
            renderDeckList();
            toast('Default deck restored');
        });

        deckDialog.addEventListener('close', () => {
            pruneEmptyCards();
            render();
        });
    }

    function addCard() {
        // If the top card is still blank, just focus it instead of stacking blanks.
        const top = deck[0];
        if (top && !top.left.trim() && !top.right.trim() && !deckSearch.value) {
            deckList.querySelector('input')?.focus();
            return;
        }
        const card = makeItem(['', '']);
        deck.unshift(card);
        deckSearch.value = '';
        renderDeckList({ newId: card.id });
        $('.deck-body', deckDialog).scrollTop = 0;
        deckList.querySelector('input')?.focus();
    }

    /* ======================================================================
       Import dialog
       ====================================================================== */

    const importDialog = $('#importDialog');
    const importText = $('#importText');
    const importFile = $('#importFile');
    const importPreview = $('#importPreview');
    const importAddBtn = $('#importAddBtn');
    const importReplaceBtn = $('#importReplaceBtn');
    const dropzone = $('#dropzone');
    const dropzoneTitle = $('#dropzoneTitle');
    const DROPZONE_DEFAULT = dropzoneTitle.innerHTML;

    let pending = { cards: [], fresh: [] };

    function openImport() {
        importText.value = '';
        importFile.value = '';
        dropzoneTitle.innerHTML = DROPZONE_DEFAULT;
        showImportPreview('');
        openDialog(importDialog);
    }

    function showImportPreview(text) {
        const result = parseCards(text);
        const existing = deckKeys();
        const fresh = result.cards.filter(([l, r]) => !existing.has(cardKey(l, r)));
        pending = { cards: result.cards, fresh };

        importAddBtn.disabled = fresh.length === 0;
        importReplaceBtn.disabled = result.cards.length === 0;
        importAddBtn.textContent = fresh.length ? `Add ${plural(fresh.length, 'card')}` : 'Add cards';

        if (!text.trim()) {
            importPreview.hidden = true;
            return;
        }
        importPreview.hidden = false;
        importPreview.classList.toggle('is-error', result.cards.length === 0);

        if (!result.cards.length) {
            importPreview.innerHTML = '<strong>No cards found</strong><ul><li>Use one card per line, like <em>Cold | Hot</em>, or an exported .json deck.</li></ul>';
            return;
        }

        const already = result.cards.length - fresh.length;
        const notes = [];
        if (already) notes.push(`${already} already in your deck`);
        if (result.skipped) notes.push(`${plural(result.skipped, 'line')} couldn't be read`);
        const sample = (fresh.length ? fresh : result.cards).slice(0, 3)
            .map(([l, r]) => `<li>${esc(l)} ↔ ${esc(r)}</li>`).join('');
        const more = (fresh.length || result.cards.length) > 3 ? `<li>…and ${(fresh.length || result.cards.length) - 3} more</li>` : '';

        importPreview.innerHTML = `<strong>${plural(result.cards.length, 'card')} found</strong>
            ${fresh.length ? ` · ${fresh.length} new` : ''}${notes.length ? ` · ${notes.join(' · ')}` : ''}
            <ul>${sample}${more}</ul>`;
    }

    async function loadImportFile(file) {
        if (!file) return;
        try {
            const text = await file.text();
            importText.value = '';
            dropzoneTitle.textContent = file.name;
            showImportPreview(text);
        } catch {
            toast("Couldn't read that file");
        }
    }

    function wireImport() {
        importText.addEventListener('input', debounce(() => {
            importFile.value = '';
            dropzoneTitle.innerHTML = DROPZONE_DEFAULT;
            showImportPreview(importText.value);
        }, 150));

        importFile.addEventListener('change', () => loadImportFile(importFile.files[0]));

        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('over'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('over');
            loadImportFile(e.dataTransfer.files[0]);
        });
        // Don't let a stray drop navigate away from the game.
        window.addEventListener('dragover', (e) => { if (importDialog.open) e.preventDefault(); });
        window.addEventListener('drop', (e) => { if (importDialog.open) e.preventDefault(); });

        importAddBtn.addEventListener('click', () => {
            if (!pending.fresh.length) return;
            const items = pending.fresh.map(makeItem);
            deck = [...items, ...deck];
            saveDeck();
            importDialog.close();
            deckSearch.value = '';
            renderDeckList();
            $('.deck-body', deckDialog).scrollTop = 0;
            toast(`Added ${plural(items.length, 'card')}`);
        });

        importReplaceBtn.addEventListener('click', async () => {
            if (!pending.cards.length) return;
            const count = deck.filter(isPlayable).length;
            const ok = await confirmAsk({
                title: 'Replace your deck?',
                message: `Your ${plural(count, 'card')} will be swapped for the ${plural(pending.cards.length, 'imported card')}.`,
                ok: 'Replace',
                danger: true,
            });
            if (!ok) return;
            deck = pending.cards.map(makeItem);
            saveDeck();
            importDialog.close();
            deckSearch.value = '';
            renderDeckList();
            toast(`Deck replaced with ${plural(deck.length, 'card')}`);
        });
    }

    /* ======================================================================
       Wiring + init
       ====================================================================== */

    function wireMain() {
        actionsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (!btn || btn.disabled) return;
            ({
                peek: startPsychicTurn,
                'new-card': newCard,
                hide: hideTarget,
                reveal: revealTarget,
                next: nextRound,
                'open-deck': openDeck,
            })[btn.dataset.act]?.();
        });

        scoreboardEl.addEventListener('click', (e) => {
            if (e.target.closest('.team-chip')) openTeams();
        });

        $('#deckBtn').addEventListener('click', openDeck);
        $('#teamsBtn').addEventListener('click', openTeams);
        $('#helpBtn').addEventListener('click', () => openDialog($('#helpDialog')));
        $('#helpDialog').addEventListener('close', () => store.set(KEYS.seenHelp, true));
        $('#newGameBtn').addEventListener('click', async () => {
            const ok = await confirmAsk({
                title: 'Start a new game?',
                message: 'Scores go back to 0. Your teams and deck stay the same.',
                ok: 'New game',
            });
            if (ok) newGame();
        });
    }

    async function init() {
        document.body.classList.add('no-anim');
        buildDial();
        wireDialogs();
        wireMain();
        wireDial();
        wireTeams();
        wireDeck();
        wireImport();

        state = loadState();
        defaultDeck = await loadDefaultDeck();
        deck = loadDeck();
        render();

        requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('no-anim')));

        if (!store.get(KEYS.seenHelp)) openDialog($('#helpDialog'));
    }

    init();
})();
