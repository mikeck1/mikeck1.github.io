(() => {
    'use strict';

    /* ======================================================================
       ThisClose
       One player sees a secret spot on a bar between two opposites and gives
       a clue. Their team drags a marker to where they think the clue lands.
       Points are based on distance: the closer, the better.
       ====================================================================== */

    /* ======================================================================
       Constants
       ====================================================================== */

    const KEYS = {
        game: 'thisclose.game.v1',
        deck: 'thisclose.deck.v1',
        seenHelp: 'thisclose.seenHelp.v1',
    };

    // Storage keys from the previous version of the site. Custom decks and team
    // names carry over once, then these are removed.
    const OLD_KEYS = { game: 'wl.game.v2', deck: 'wl.deck.v1', seenHelp: 'wl.seenHelp' };

    const TEAM_COLORS = ['#ef476f', '#118ab2', '#e09100', '#06a77d', '#7c5cff', '#f3722c'];

    const MAX_TEAMS = 6;
    const MAX_CARD_LEN = 60;
    const MIDDLE = 50;

    // Scoring: 10 points for spot on, minus 1 point for every 2 steps away.
    const MAX_POINTS = 10;
    const STEPS_PER_POINT = 2;
    const REACH = MAX_POINTS * STEPS_PER_POINT; // 20 or more steps away scores 0

    // Words that describe a position on the bar, by distance from the middle.
    const QUALIFIERS = [
        { upTo: 3, word: 'Right in the middle' },
        { upTo: 12, word: 'A tiny bit' },
        { upTo: 22, word: 'Sorta' },
        { upTo: 32, word: 'Pretty' },
        { upTo: 42, word: 'Very' },
        { upTo: 50, word: 'Totally' },
    ];

    const CONFETTI_COLORS = ['#ff5a3c', '#ffc23d', '#06a77d', '#118ab2', '#ef476f', '#ffffff'];

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
       Anonymous usage counts
       Daily totals of a fixed list of game events, kept in this browser and
       sent once each UTC day is over. No identifiers, no personal data: the
       same format the company analytics collector takes from every app.
       ====================================================================== */

    const COUNTS = {
        url: 'https://counts.colorducky.workers.dev/v1/counts',
        key: 'thisclose.counts.v1',
        firstOpenKey: 'thisclose.firstOpen',
        app: 'thisclose',
        version: '1.0',
        // Only the real site counts (copies hosted elsewhere don't); local testing counts as dev.
        hosts: { 'mikeck1.github.io': 'prod', localhost: 'dev', '127.0.0.1': 'dev' },
        maxPerEvent: 100000,
        maxErrorsPerDay: 50,
        keepDays: 58, // the collector takes days up to 60 days late
    };

    const usage = (() => {
        const env = COUNTS.hosts[location.hostname];
        const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
        const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
        const device = !coarse ? 'desktop' : Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet';
        const platform = coarse ? 'mweb' : 'dweb';
        const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
            : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

        const load = () => {
            const s = store.get(COUNTS.key);
            return s && s.days && typeof s.days === 'object' && Array.isArray(s.outbox) ? s : { days: {}, outbox: [] };
        };

        function count(event, limit = COUNTS.maxPerEvent) {
            if (!env) return;
            const s = load();
            const day = utcDay();
            const counts = (s.days[day] ||= {});
            counts[event] = Math.min((counts[event] || 0) + 1, limit);
            store.set(COUNTS.key, s);
        }

        // Move finished days into the outbox, each with a one-time upload id so a resend is ignored.
        function freeze(s, includeToday) {
            const today = utcDay();
            for (const day of Object.keys(s.days)) {
                if (day < today || (includeToday && day === today)) {
                    const counts = s.days[day];
                    delete s.days[day];
                    if (Object.keys(counts).length) s.outbox.push({ day, counts, upload: uuid() });
                }
            }
            const oldest = utcDay(new Date(Date.now() - COUNTS.keepDays * 86400000));
            s.outbox = s.outbox.filter((e) => e.day >= oldest);
        }

        let sending = false;
        async function send({ includeToday = false } = {}) {
            if (!env || sending) return;
            sending = true;
            try {
                const s = load();
                freeze(s, includeToday && env === 'dev'); // the collector takes today only from dev
                store.set(COUNTS.key, s);
                for (const entry of s.outbox) {
                    const body = JSON.stringify({
                        app: COUNTS.app, platform, env, day: entry.day, version: COUNTS.version,
                        device, upload: entry.upload, counts: entry.counts,
                    });
                    // A simple text/plain POST needs no CORS preflight; a network error keeps it for next time.
                    await fetch(COUNTS.url, { method: 'POST', mode: 'no-cors', keepalive: true, body });
                    const now = load();
                    now.outbox = now.outbox.filter((e) => e.upload !== entry.upload);
                    store.set(COUNTS.key, now);
                }
            } catch {
                /* offline or blocked: the outbox stays and goes next time */
            } finally {
                sending = false;
            }
        }

        function start() {
            if (!env) return;
            count('page_open');
            if (!store.get(COUNTS.firstOpenKey)) {
                count('first_open');
                store.set(COUNTS.firstOpenKey, true);
            }
            window.addEventListener('error', () => count('js_error', COUNTS.maxErrorsPerDay));
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') send();
            });
            setTimeout(send, 3000);
            // Local testing: send today's counts right away from the console.
            if (env === 'dev') window.thisCloseSendCountsNow = () => send({ includeToday: true });
        }

        return { count, send, start };
    })();

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

    /* ======================================================================
       Game state
       ====================================================================== */

    const PHASES = ['ready', 'clue', 'guess', 'reveal'];

    function defaultState() {
        return {
            teams: [
                { name: 'Team 1', score: 0, color: 0 },
                { name: 'Team 2', score: 0, color: 1 },
            ],
            current: 0,
            round: 1,
            phase: 'ready',
            target: MIDDLE,
            guess: MIDDLE,
            card: null,
            lastScore: null,
            seen: [],
        };
    }

    // Bring custom decks and team names over from the previous version of the site.
    // Scores start fresh because the scoring changed.
    function migrateOldSave() {
        if (store.get(KEYS.deck) == null) {
            const oldDeck = store.get(OLD_KEYS.deck);
            if (oldDeck && Array.isArray(oldDeck.cards)) store.set(KEYS.deck, oldDeck);
        }
        if (store.get(KEYS.game) == null) {
            const oldGame = store.get(OLD_KEYS.game);
            if (oldGame && Array.isArray(oldGame.teams) && oldGame.teams.length) {
                const s = defaultState();
                s.teams = oldGame.teams.map((t, i) => ({
                    name: String(t.name || ''),
                    score: 0,
                    color: Number.isInteger(t.color) ? t.color : i,
                }));
                store.set(KEYS.game, s);
            }
        }
        Object.values(OLD_KEYS).forEach((key) => store.remove(key));
    }

    const toPos = (v) => clamp(Math.round(Number(v)), 0, 100);

    function loadState() {
        const base = defaultState();
        const saved = store.get(KEYS.game);
        const s = saved && Array.isArray(saved.teams) && saved.teams.length ? { ...base, ...saved } : base;

        s.teams = s.teams.slice(0, MAX_TEAMS).map((t, i) => ({
            name: typeof t.name === 'string' ? t.name.slice(0, 24) : `Team ${i + 1}`,
            score: Number.isFinite(t.score) ? t.score : 0,
            color: Number.isInteger(t.color) ? t.color % TEAM_COLORS.length : i % TEAM_COLORS.length,
        }));
        s.current = clamp(Number(s.current) || 0, 0, s.teams.length - 1);
        s.round = Math.max(1, Number(s.round) || 1);
        s.target = Number.isFinite(Number(s.target)) ? toPos(s.target) : MIDDLE;
        s.guess = Number.isFinite(Number(s.guess)) ? toPos(s.guess) : MIDDLE;
        s.seen = Array.isArray(s.seen) ? s.seen : [];
        if (!Array.isArray(s.card) || s.card.length !== 2) s.card = null;
        if (!PHASES.includes(s.phase) || (s.phase !== 'ready' && !s.card)) s.phase = 'ready';
        if (s.phase === 'reveal' && !Number.isFinite(s.lastScore)) s.lastScore = scoreFor(s.guess, s.target);
        return s;
    }

    let state = defaultState();
    let suspense = false; // true for a moment before the spot is revealed

    const save = () => store.set(KEYS.game, state);
    const teamName = (t, i) => (t.name.trim() || `Team ${i + 1}`);
    const currentTeam = () => state.teams[state.current] || state.teams[0];
    const teamColor = (t) => TEAM_COLORS[t.color % TEAM_COLORS.length];

    function scoreFor(guess, target) {
        return Math.max(0, MAX_POINTS - Math.floor(Math.abs(guess - target) / STEPS_PER_POINT));
    }

    function scoreText(pts) {
        if (pts === MAX_POINTS) return 'Nailed it!';
        if (pts >= 8) return 'THIS close!';
        if (pts >= 5) return 'So close!';
        if (pts >= 1) return 'In the neighborhood';
        return 'Way off!';
    }

    function scoreColor(pts) {
        if (pts >= 8) return '#06a77d';
        if (pts >= 5) return '#e09100';
        if (pts >= 1) return '#118ab2';
        return '#8c8fa6';
    }

    // Describe a position in words, e.g. { word: 'Pretty', side: 1 } for 78.
    function describe(pos) {
        const off = pos - MIDDLE;
        const dist = Math.abs(off);
        const { word } = QUALIFIERS.find((q) => dist <= q.upTo) || QUALIFIERS[QUALIFIERS.length - 1];
        const side = dist <= QUALIFIERS[0].upTo ? null : (off < 0 ? 0 : 1);
        return { word, side };
    }

    function describeHtml(pos) {
        const { word, side } = describe(pos);
        if (side === null || !state.card) return `<b>${word}</b>`;
        return `<b>${word}</b> <span>${esc(state.card[side])}</span>`;
    }

    function describeText(pos) {
        const { word, side } = describe(pos);
        return side === null || !state.card ? word : `${word} ${state.card[side]}`;
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
    const board = $('#board');
    const endsEl = $('#ends');
    const endLeft = $('#endLeft');
    const endRight = $('#endRight');
    const track = $('#track');
    const rail = $('#rail');
    const spotEl = $('#spot');
    const spotTag = $('#spotTag');
    const gapEl = $('#gap');
    const markerTag = $('#markerTag');
    const floatPoints = $('#floatPoints');
    const actionsEl = $('#actions');
    const deckBadge = $('#deckBadge');
    const toastRegion = $('#toasts');
    const handoffDialog = $('#handoffDialog');
    const handoffEyebrow = $('#handoffEyebrow');

    /* ======================================================================
       Board (static parts)
       ====================================================================== */

    function buildBoard() {
        let ticks = '';
        for (let i = 0; i <= 10; i++) {
            ticks += `<span class="${i === 5 ? 'mid' : ''}" style="left:${i * 10}%"></span>`;
        }
        $('#ticks').innerHTML = ticks;
        rail.style.setProperty('--reach', REACH);
    }

    /* ======================================================================
       Rendering
       ====================================================================== */

    let lastPhaseRendered = null;

    function render() {
        root.style.setProperty('--team', teamColor(currentTeam()));
        renderScoreboard();
        renderTurn();
        renderBoard();
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
            title = `Pass to ${name}'s Clue Giver`;
            hint = 'Everyone else, look away from the screen!';
        } else if (state.phase === 'clue') {
            eyebrow = `${name} · Clue Giver`;
            title = 'Give your team a clue';
            hint = 'Say one word or phrase that lands right on the spot.';
        } else if (state.phase === 'guess') {
            eyebrow = `${name} · Guessing`;
            title = 'Where does the clue land?';
            hint = 'Talk it over, then drag the marker to your guess.';
        } else if (suspense) {
            eyebrow = `${name} · Round ${state.round}`;
            title = 'And the spot is…';
            hint = '&nbsp;';
        } else {
            const pts = state.lastScore || 0;
            const dist = Math.abs(state.guess - state.target);
            eyebrow = `${name} · Round ${state.round}`;
            title = pts ? `<span class="hl">+${pts}</span> ${scoreText(pts)}` : scoreText(0);
            hint = `${dist === 0 ? 'Right on the spot!' : `${plural(dist, 'step')} away.`} ${name} ${pts ? 'now has' : 'stays at'} ${plural(team.score, 'point')}.`;
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

    function renderBoard() {
        const { phase, card } = state;
        const noCards = playableCards().length === 0;
        const showCard = phase !== 'ready' && !!card;
        const revealed = phase === 'reveal' && !suspense;

        board.dataset.phase = phase;
        board.classList.toggle('is-ready', phase === 'ready' && !noCards);
        board.classList.toggle('can-drag', phase === 'guess');
        board.classList.toggle('show-spot', phase === 'clue' || revealed);
        board.classList.toggle('show-marker', phase === 'guess' || phase === 'reveal');
        board.classList.toggle('show-gap', revealed);

        endsEl.classList.toggle('is-facedown', !showCard);
        endLeft.textContent = showCard ? card[0] : '?';
        endRight.textContent = showCard ? card[1] : '?';

        rail.style.setProperty('--t', state.target);
        const dist = Math.abs(state.guess - state.target);
        if (phase === 'reveal') {
            spotTag.innerHTML = dist === 0 ? '<b>Spot on!</b>' : `<b>The spot</b> <span>${plural(dist, 'step')} away</span>`;
        } else {
            spotTag.innerHTML = `<b>The spot:</b> ${describeHtml(state.target).replace('<b>', '<b class="q">')}`;
        }
        gapEl.style.left = `${Math.min(state.guess, state.target)}%`;
        gapEl.style.width = `${dist}%`;

        track.tabIndex = phase === 'guess' ? 0 : -1;
        track.setAttribute('aria-disabled', String(phase !== 'guess'));
        setGuess(state.guess);
    }

    function setGuess(pos) {
        state.guess = pos;
        rail.style.setProperty('--g', pos);
        markerTag.innerHTML = describeHtml(pos);
        track.setAttribute('aria-valuenow', pos);
        track.setAttribute('aria-valuetext', describeText(pos));
    }

    function renderActions() {
        const { phase } = state;
        const noCards = playableCards().length === 0;
        let html = '';

        if (phase === 'ready' && noCards) {
            html = `<button class="btn btn-primary btn-lg" data-act="open-deck">${icon('cards')} Open deck</button>`;
        } else if (phase === 'ready') {
            html = ''; // the start button sits on the board itself
        } else if (phase === 'clue') {
            html = `<button class="btn btn-secondary btn-lg" data-act="new-card">${icon('shuffle')} New card</button>
                    <button class="btn btn-primary btn-lg" data-act="hide">${icon('eye-off')} Hide &amp; pass</button>`;
        } else if (phase === 'guess') {
            html = `<button class="btn btn-primary btn-lg" data-act="reveal">${icon('lock')} Lock it in</button>`;
        } else {
            const nextIndex = (state.current + 1) % state.teams.length;
            const next = state.teams.length > 1 ? `Next: ${esc(teamName(state.teams[nextIndex], nextIndex))}` : 'Next round';
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

    function startClueTurn() {
        if (state.phase !== 'ready') return;
        const card = drawCard();
        if (!card) {
            openDeck();
            return;
        }
        state.card = card;
        state.target = Math.floor(Math.random() * 101);
        state.guess = MIDDLE;
        state.lastScore = null;
        state.phase = 'clue';
        usage.count('round_start');
        usage.count(`teams|${state.teams.length}`);
        usage.count(`deck|${deckIsCustom ? 'custom' : 'default'}`);
        render();
        restartAnimation(spotEl, 'pop');
        restartAnimation(endsEl, 'swap');
    }

    function newCard() {
        if (state.phase !== 'clue') return;
        const card = drawCard(state.card);
        if (!card) return;
        state.card = card;
        usage.count('card_new');
        render();
        restartAnimation(endsEl, 'swap');
    }

    function hideAndPass() {
        if (state.phase !== 'clue') return;
        state.phase = 'guess';
        state.guess = MIDDLE;
        usage.count('round_hide');
        render();
        handoffEyebrow.textContent = teamName(currentTeam(), state.current);
        openDialog(handoffDialog);
        $('#handoffGo').focus();
    }

    function revealSpot() {
        if (state.phase !== 'guess') return;
        const pts = scoreFor(state.guess, state.target);
        state.lastScore = pts;
        currentTeam().score += pts;
        state.phase = 'reveal';
        usage.count(`round_reveal|${pts}`);
        suspense = true;
        render();

        setTimeout(() => {
            suspense = false;
            render();
            restartAnimation(spotEl, 'drop');
            showPoints(pts);
        }, 900);
    }

    function nextRound() {
        if (state.phase !== 'reveal' || suspense) return;
        state.current = (state.current + 1) % state.teams.length;
        state.round += 1;
        state.phase = 'ready';
        usage.count('round_next');
        state.card = null;
        state.guess = MIDDLE;
        state.lastScore = null;
        render();
    }

    function newGame() {
        usage.count('game_new');
        state.teams.forEach((t) => { t.score = 0; });
        state.current = 0;
        state.round = 1;
        state.phase = 'ready';
        state.card = null;
        state.guess = MIDDLE;
        state.lastScore = null;
        suspense = false;
        render();
    }

    function showPoints(pts) {
        floatPoints.textContent = pts ? `+${pts}` : '0';
        floatPoints.style.color = scoreColor(pts);
        restartAnimation(floatPoints, 'go');

        const chip = scoreboardEl.querySelector('.team-chip.is-current');
        if (chip && pts) restartAnimation(chip, 'bump');

        if (pts === 0) {
            restartAnimation(board, 'shake');
            return;
        }
        if (typeof window.confetti !== 'function' || pts < 8) return;

        const rect = rail.getBoundingClientRect();
        const x = (rect.left + (rect.width * state.target) / 100) / innerWidth;
        const origin = { x, y: (rect.top + rect.height / 2) / innerHeight };

        if (pts === MAX_POINTS) {
            window.confetti({ particleCount: 140, spread: 100, startVelocity: 42, origin, colors: CONFETTI_COLORS, scalar: 1.1 });
            setTimeout(() => {
                window.confetti({ particleCount: 70, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: CONFETTI_COLORS });
                window.confetti({ particleCount: 70, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: CONFETTI_COLORS });
            }, 220);
        } else {
            window.confetti({ particleCount: 50, spread: 65, startVelocity: 30, origin, colors: CONFETTI_COLORS, scalar: 0.9 });
        }
    }

    /* ======================================================================
       Marker input
       ====================================================================== */

    let dragging = false;

    function posFromEvent(e) {
        const r = rail.getBoundingClientRect();
        return toPos(((e.clientX - r.left) / r.width) * 100);
    }

    function wireBoard() {
        board.addEventListener('click', () => {
            if (state.phase === 'ready' && playableCards().length) startClueTurn();
        });

        track.addEventListener('pointerdown', (e) => {
            if (state.phase !== 'guess') return;
            e.preventDefault();
            dragging = true;
            track.setPointerCapture(e.pointerId);
            board.classList.add('dragging');
            setGuess(posFromEvent(e));
        });

        track.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            setGuess(posFromEvent(e));
        });

        const end = () => {
            if (!dragging) return;
            dragging = false;
            board.classList.remove('dragging');
            save();
        };
        track.addEventListener('pointerup', end);
        track.addEventListener('pointercancel', end);

        track.addEventListener('keydown', (e) => {
            if (state.phase !== 'guess') return;
            const step = e.shiftKey ? 5 : 1;
            let next = state.guess;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next -= step;
            else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next += step;
            else if (e.key === 'PageDown') next -= 10;
            else if (e.key === 'PageUp') next += 10;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = 100;
            else if (e.key === 'Enter') { revealSpot(); return; }
            else return;
            e.preventDefault();
            setGuess(toPos(next));
            save();
        });

        $('#handoffGo').addEventListener('click', () => handoffDialog.close());
        handoffDialog.addEventListener('close', () => {
            if (state.phase === 'guess') track.focus({ preventScroll: true });
        });
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
        usage.count('deck_open');
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
            name: 'ThisClose deck',
            exported: new Date().toISOString(),
            count: cards.length,
            cards,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `thisclose-deck-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        usage.count('deck_export');
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
            usage.count('deck_import');
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
            usage.count('deck_import');
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
                start: startClueTurn,
                'new-card': newCard,
                hide: hideAndPass,
                reveal: revealSpot,
                next: nextRound,
                'open-deck': openDeck,
            })[btn.dataset.act]?.();
        });

        scoreboardEl.addEventListener('click', (e) => {
            if (e.target.closest('.team-chip')) openTeams();
        });

        $('#deckBtn').addEventListener('click', openDeck);
        $('#teamsBtn').addEventListener('click', openTeams);
        $('#helpBtn').addEventListener('click', () => {
            usage.count('help_open');
            openDialog($('#helpDialog'));
        });
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
        usage.start();
        migrateOldSave();
        buildBoard();
        wireDialogs();
        wireMain();
        wireBoard();
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
