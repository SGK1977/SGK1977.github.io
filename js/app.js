/* Spain trip guide: turns the "Spain Itinerary" Google Sheet into a day-by-day guide.
   The sheet is read live with JSONP, so it works from file:// and from localhost alike.
   If Google can't be reached it uses the last copy this device loaded, then the copy
   saved in js/sheet-snapshot.js. Extra context (maps, tips) comes from js/guide.js. */
(() => {
  'use strict';

  const CFG = window.TRIP_CONFIG;
  const GUIDE = window.TRIP_GUIDE || {};
  const SNAPSHOT = window.SHEET_SNAPSHOT || { savedAt: null, tabs: {} };
  const CACHE_KEY = 'spainTripGuide.sheet.v1';
  const WX_KEY = 'spainTripGuide.wx.v1';

  /* ------------------------------------------------------------------ */
  /* Text, date and time helpers                                         */
  /* ------------------------------------------------------------------ */

  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const pad = (n) => String(n).padStart(2, '0');
  const clean = (v) => (v == null ? '' : String(v)).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const unaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const urlsIn = (s) => clean(s).match(/https?:\/\/[^\s,;]+/gi) || [];
  const stripUrls = (s) => clean(clean(s).replace(/https?:\/\/[^\s,;]+/gi, ' ')).replace(/^[,;:\s]+|[,;:\s]+$/g, '');
  const sentenceCase = (s) => { const t = clean(s); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ''; };
  const slug = (s) => unaccent(clean(s).toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const isoDate = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  function parseMonthDay(text) {
    const m = clean(text).match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?!\d)/);
    if (!m) return null;
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    const day = Number(m[2]);
    if (month < 0 || day < 1 || day > 31) return null;
    return isoDate(CFG.year, month, day);
  }
  // A cell that holds only a date, e.g. "Nov 22" or "Nov 22 (Sun) :"
  function dateCell(text) {
    const t = clean(text);
    return /^[A-Za-z]{3,9}\.?\s+\d{1,2}(?:\s*\([A-Za-z.]+\))?\s*:?$/.test(t) ? parseMonthDay(t) : null;
  }
  const toDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
  const addDays = (iso, n) => { const d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
  const weekdayOf = (iso) => toDate(iso).getUTCDay();
  const longDate = (iso) => { const d = toDate(iso); return `${WEEKDAYS[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`; };
  const shortDate = (iso) => { const d = toDate(iso); return `${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`; };
  const weekdayShortDate = (iso) => { const d = toDate(iso); return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)}, ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`; };

  function parseTime(text) {
    const t = clean(text);
    let m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?$/i);
    if (m) {
      const h = Number(m[1]);
      if (h < 1 || h > 12) return null;
      return ((h % 12) + (/p/i.test(m[3]) ? 12 : 0)) * 60 + Number(m[2] || 0);
    }
    m = t.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  const CLOCK = '(\\d{1,2}(?::\\d{2})?\\s*[ap]\\.?\\s*m\\.?)(?![a-z])';
  function fmtTime(mins) {
    if (mins == null) return '';
    const h = Math.floor(mins / 60) % 24;
    return `${((h + 11) % 12) + 1}:${pad(mins % 60)} ${h < 12 ? 'AM' : 'PM'}`;
  }
  function tidyClock(text) { // "3PM" -> "3 PM", "11:30am" -> "11:30 AM"
    const t = parseTime(text);
    if (t == null) return clean(text);
    const h = Math.floor(t / 60);
    return `${((h + 11) % 12) + 1}${t % 60 ? ':' + pad(t % 60) : ''} ${h < 12 ? 'AM' : 'PM'}`;
  }
  function fmtDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return [h ? `${h} hr` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
  }
  // Minutes in phrases like "2 hours 20 min drive" or "Alhambra Tour (2.5 hours)"
  function parseDuration(text) {
    const t = clean(text).toLowerCase();
    if (!/hour|hrs?\b|min/.test(t)) return 0;
    let mins = 0;
    const h = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/);
    const m = t.match(/(\d+)\s*(?:minutes?|mins?)\b/);
    if (h) mins += Math.round(parseFloat(h[1]) * 60);
    if (m) mins += Number(m[1]);
    return mins;
  }

  // The date and time in Spain. ?today=2026-11-24&now=10:15 previews a moment of the trip.
  function spainNow() {
    const q = new URLSearchParams(location.search);
    let date;
    let mins;
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: CFG.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      const get = (type) => (parts.find((p) => p.type === type) || {}).value;
      date = `${get('year')}-${get('month')}-${get('day')}`;
      mins = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
    } catch (e) {
      const d = new Date();
      date = isoDate(d.getFullYear(), d.getMonth(), d.getDate());
      mins = d.getHours() * 60 + d.getMinutes();
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(q.get('today') || '')) date = q.get('today');
    const forced = parseTime(q.get('now') || '');
    if (forced != null) mins = forced;
    return { date, mins };
  }

  // Word matching between the Summary tab and the city tabs
  const STOPWORDS = new Set(('a an and the to for by in at of on de del la las los el en y leave leaving arrive arriving ' +
    'drive driving fly flying flight tour tours guided viator show visit have check into go going explore only am pm ' +
    'hour hours min mins minutes lunch dinner breakfast with from via day').split(' '));
  const words = (text) => unaccent(clean(text).toLowerCase()).replace(/https?:\/\/\S+/g, ' ').split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = (text) => words(text).filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d/.test(w));
  const sharesToken = (a, b) => a.some((t) => b.includes(t));
  const CONNECTORS = new Set('to for by at in on of the a an and am pm de del la las los el'.split(' '));

  const store = {
    get(key, session) {
      try {
        const raw = (session ? window.sessionStorage : window.localStorage).getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    set(key, value, session) {
      try { (session ? window.sessionStorage : window.localStorage).setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
    }
  };

  /* ------------------------------------------------------------------ */
  /* Reading the sheet                                                   */
  /* ------------------------------------------------------------------ */

  function linkLabel(url) {
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { /* keep the raw text */ }
    if (/viator\./i.test(host)) return 'Viator booking';
    if (/airbnb\./i.test(host)) return 'Airbnb reservation';
    if (/expedia\./i.test(host)) return 'Expedia booking';
    if (/teatroflamencosevilla/i.test(host)) return 'Teatro Flamenco Sevilla';
    return host;
  }
  function addLink(target, url, label) {
    if (!url || target.links.some((l) => l.url === url)) return;
    target.links.push({ url, label: label || linkLabel(url) });
  }
  function addNote(target, text) {
    const t = clean(text);
    if (t && !target.notes.includes(t)) target.notes.push(t);
  }

  // Rows that annotate the plan above them rather than being a plan of their own
  const NOTE_ROW = /reservation\b|free cancell?ation|non[\s-]?refundable|tickets? (?:are )?in (?:the |your )?e-?mail|check[\s-]*in\b.*check[\s-]*out/i;

  // City tabs: date (first row of each day) | time | plan | optional link or note
  function parseCityTab(tab, rows) {
    const items = [];
    let date = null;
    let last = null;
    (rows || []).forEach((raw) => {
      const cells = (raw || []).map(clean).filter(Boolean);
      if (!cells.length) return;
      let time = null;
      const texts = [];
      cells.forEach((cell, i) => {
        if (i === 0) {
          const d = dateCell(cell);
          if (d) { if (d !== date) last = null; date = d; return; }
        }
        if (time == null && !texts.length) {
          const t = parseTime(cell);
          if (t != null) { time = t; return; }
        }
        texts.push(cell);
      });
      if (!date || !texts.length) return;

      const [first, ...rest] = texts;
      const firstIsLink = urlsIn(first).length > 0 && !stripUrls(first);
      if (time == null && last && (firstIsLink || NOTE_ROW.test(first))) {
        [first, ...rest].forEach((cell) => urlsIn(cell).forEach((u) => addLink(last, u)));
        const note = [first, ...rest].map(stripUrls).filter(Boolean).join(': ');
        if (note) addNote(last, note);
        return;
      }
      const item = { date, time, text: stripUrls(first) || first, notes: [], links: [], status: '', tab };
      urlsIn(first).forEach((u) => addLink(item, u));
      rest.forEach((cell) => {
        urlsIn(cell).forEach((u) => addLink(item, u));
        if (stripUrls(cell)) addNote(item, stripUrls(cell));
      });
      items.push(item);
      last = item;
    });
    return items;
  }

  // Summary tab: DATE | LOCATION & RESERVATIONS | (detail) | BOOKING STATUS
  function parseSummary(rows) {
    const out = { title: '', route: '', days: [], items: [] };
    rows = rows || [];
    let header = -1;
    let dateCol = 1;
    let itemCol = 2;
    let statusCol = 4;
    for (let i = 0; i < rows.length && header < 0; i++) {
      const cells = (rows[i] || []).map(clean);
      const d = cells.findIndex((c) => /^date$/i.test(c));
      const l = cells.findIndex((c, k) => k > d && /location|reservation|plans?\b|activit/i.test(c));
      if (d >= 0 && l > d) {
        header = i;
        dateCol = d;
        itemCol = l;
        statusCol = cells.findIndex((c, k) => k > l && /status|cancel/i.test(c));
      }
    }
    const detailCol = itemCol + 1;

    rows.slice(0, Math.max(header, 0)).forEach((r) => (r || []).map(clean).filter(Boolean).forEach((c) => {
      if (!out.title && /^[A-Za-z]{3,9}\.?\s+\d{1,2}\s*[-–]\s*[A-Za-z]{3,9}\.?\s+\d{1,2}$/.test(c)) out.title = c;
      else if (!out.route && (c.match(/\s[-–]\s/g) || []).length >= 2) out.route = c;
    }));

    let day = null;
    let last = null;
    rows.slice(header + 1).forEach((r) => {
      const cells = (r || []).map(clean);
      if (!cells.some(Boolean)) return;
      const dc = cells[dateCol] || '';
      const d = /^[A-Za-z]{3,9}\.?\s+\d{1,2}/.test(dc) ? parseMonthDay(dc) : null;
      if (d) {
        day = { date: d, title: cells.slice(dateCol + 1).find(Boolean) || '' };
        out.days.push(day);
        last = null;
        return;
      }
      if (!day) return;
      const text = cells[itemCol] || '';
      const detail = detailCol !== statusCol ? (cells[detailCol] || '') : '';
      const status = statusCol >= 0 ? (cells[statusCol] || '') : '';
      const others = cells.filter((c, k) => c && k > itemCol && k !== detailCol && k !== statusCol);
      if (text) {
        last = { date: day.date, text, detail, status, more: others, isStay: /\bstay\b/i.test(text) };
        out.items.push(last);
      } else if (last) {
        last.more.push(...[detail, status, ...others].filter(Boolean));
      }
    });
    return out;
  }

  const GENERIC_STAY = new Set(['apartamentos', 'apartments', 'apartment', 'home', 'house', 'hotel', 'residences', 'residence', 'garden', 'suites', 'suite', 'rooms', 'villa']);
  const STAYISH = /free cancell?ation|check[\s-]*in\b.*check[\s-]*out|reservation\b/i;

  function buildStay(si, dayTitle) {
    const detail = stripUrls(si.detail);
    const named = detail.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const name = clean(named ? named[1] : detail) || clean(si.text.replace(/\(.*?\)/g, ' '));
    const provider = named ? clean(named[2]) : '';
    let checkIn = si.date;
    let checkOut = addDays(si.date, 1);
    const range = si.text.match(/\(\s*([A-Za-z]{3,9})\.?\s*(\d{1,2})\s*[-–]\s*(?:([A-Za-z]{3,9})\.?\s*)?(\d{1,2})\s*\)/);
    const single = si.text.match(/\(\s*([A-Za-z]{3,9})\.?\s*(\d{1,2})\s*only\s*\)/i);
    if (range) {
      checkIn = parseMonthDay(`${range[1]} ${range[2]}`) || checkIn;
      checkOut = parseMonthDay(`${range[3] || range[1]} ${range[4]}`) || addDays(checkIn, 1);
    } else if (single) {
      checkIn = parseMonthDay(`${single[1]} ${single[2]}`) || checkIn;
      checkOut = addDays(checkIn, 1);
    }
    if (checkOut <= checkIn) checkOut = addDays(checkIn, 1);

    const all = [si.detail, si.status, ...si.more].join(' | ');
    const ci = all.match(new RegExp(`check[\\s-]*in\\s*(?:at|from|after)?\\s*${CLOCK}`, 'i'));
    const co = all.match(new RegExp(`check[\\s-]*out\\s*(?:at|by|before)?\\s*${CLOCK}`, 'i'));
    const city = clean(si.text.replace(/\(.*?\)/g, ' ').replace(/\bstay\b/i, ' ')) ||
      clean((dayTitle || '').split('/')[0].replace(/\(.*?\)/g, ' '));

    const stay = {
      name, provider, city, checkIn, checkOut,
      nights: daysBetween(checkIn, checkOut),
      checkInTime: ci ? tidyClock(ci[1]) : '',
      checkOutTime: co ? tidyClock(co[1]) : '',
      status: si.status,
      notes: [],
      links: [],
      guide: (GUIDE.stays || []).find((g) => g.match.test(`${name} ${si.text}`)) || null
    };
    si.more.forEach((m) => { if (!/check[\s-]*in\b.*check[\s-]*out/i.test(m)) addNote(stay, stripUrls(m)); });
    [si.detail, ...si.more].forEach((s) => urlsIn(s).forEach((u) => addLink(stay, u)));
    return stay;
  }

  // What a Summary row adds to the matching plan in a city tab
  function summaryExtras(si, match) {
    const notes = [];
    const links = urlsIn(si.detail);
    let detail = stripUrls(si.detail);
    let time = null;
    const lead = detail.match(new RegExp(`^${CLOCK}[\\s,;:-]*`, 'i'));
    const at = detail.match(new RegExp(`\\s*@\\s*${CLOCK}`, 'i'));
    const found = lead || at;
    if (found) {
      time = parseTime(found[1]);
      // Drop the time when it only repeats the city tab's time for this plan
      if (!match || match.time == null || match.time === time) detail = clean(detail.replace(found[0], ' '));
    }
    const base = words(match ? match.text : si.text);
    if (detail && words(detail).some((w) => w.length > 1 && !base.includes(w))) notes.push(detail);
    si.more.forEach((m) => {
      links.push(...urlsIn(m));
      if (stripUrls(m)) notes.push(stripUrls(m));
    });
    return { time, notes, links, status: si.status };
  }

  function insertByTime(list, item) {
    if (item.time == null) { list.push(item); return; }
    const i = list.findIndex((x) => x.time != null && x.time > item.time);
    if (i < 0) list.push(item); else list.splice(i, 0, item);
  }

  /* ------------------------------------------------------------------ */
  /* Guide lookups                                                       */
  /* ------------------------------------------------------------------ */

  const stops = GUIDE.stops || {};
  function stopKeyFromText(text) {
    const t = clean(text);
    return Object.keys(stops).find((k) => stops[k].match && stops[k].match.test(t)) || null;
  }
  function stopKeyForTab(tab) {
    if (!tab) return null;
    return stops[tab] ? tab : stopKeyFromText(tab);
  }
  // Show place names with their accents, e.g. "Malaga" -> "Málaga"
  function prettyPlace(text) {
    const t = clean(text);
    const plain = unaccent(t.toLowerCase());
    const exact = Object.keys(stops).find((k) => [stops[k].name, stops[k].short, k].some((n) => unaccent(n.toLowerCase()) === plain));
    if (exact) return stops[exact].name;
    return t.replace(/\bMalaga\b/g, 'Málaga');
  }

  const KIND_ICON = { car: 'car', plane: 'plane', key: 'key', bed: 'bed', music: 'music', food: 'food', bag: 'bag', wave: 'wave', pin: 'pin', ticket: 'ticket', eye: 'eye' };
  function kindOf(text) {
    const t = unaccent(clean(text).toLowerCase());
    if (/\b(fly|flight|flying|airport|houston)\b/.test(t)) return 'plane';
    if (/rental car|pick ?up .*\bcar\b|\bcar (pick ?up|hire)\b/.test(t)) return 'key';
    if (/check(ing)?[\s-]*in(to)?\b|\bstay\b/.test(t)) return 'bed';
    if (/^(drive|leave|depart|head)\b/.test(t)) return 'car';
    if (/flamenco|\bshow\b|concert/.test(t)) return 'music';
    if (/lunch|dinner|breakfast|tapas|restaurant|\beat\b/.test(t)) return 'food';
    if (/shop/.test(t)) return 'bag';
    if (/beach/.test(t)) return 'wave';
    if (/^arriv/.test(t)) return 'pin';
    if (/\btour\b|alcazar|alhambra|sagrada|guell|museum|ticket/.test(t)) return 'ticket';
    return 'eye';
  }
  const isTravel = (it) => it.kind === 'car' || it.kind === 'plane';

  function activityFor(it) {
    const hay = `${it.text} ${it.mergedFrom || ''}`;
    return (GUIDE.activities || []).find((a) => a.match.test(hay) && (!a.stop || a.stop === it.stopKey)) || null;
  }

  function driveInfo(it, fromKey) {
    const m = clean(it.text).match(/^(?:drive|leave|depart|head)\s+(?:to|for)\s+(.+?)(?:\s+(?:by|at|around)\s+\d.*)?$/i);
    if (!m) return null;
    const toKey = stopKeyFromText(m[1]);
    if (!toKey || toKey === fromKey) return null;
    const to = stops[toKey];
    const hasDuration = it.notes.some((n) => parseDuration(n) > 0);
    return {
      toKey,
      url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(to.mapName || to.name)}&travelmode=driving`,
      leg: !hasDuration && fromKey ? (GUIDE.legs || {})[`${fromKey}>${toKey}`] || '' : ''
    };
  }

  /* ------------------------------------------------------------------ */
  /* Building the trip from the sheet                                    */
  /* ------------------------------------------------------------------ */

  function buildModel(tabs) {
    const summary = parseSummary(tabs[CFG.summaryTab]);
    const cityItems = [];
    CFG.cityTabs.forEach((tab) => cityItems.push(...parseCityTab(tab, tabs[tab])));

    const dates = new Set(summary.days.map((d) => d.date));
    cityItems.forEach((it) => dates.add(it.date));
    const days = [...dates].sort().map((date, index) => ({
      date, index,
      title: (summary.days.find((d) => d.date === date) || {}).title || '',
      segments: [],
      items: []
    }));
    const byDate = Object.fromEntries(days.map((d) => [d.date, d]));

    // City-tab plans, grouped by stop in travel order
    cityItems.forEach((it) => {
      const day = byDate[it.date];
      let seg = day.segments.find((s) => s.tab === it.tab);
      if (!seg) {
        seg = { tab: it.tab, stopKey: stopKeyForTab(it.tab), items: [] };
        day.segments.push(seg);
      }
      seg.items.push(it);
      day.items.push(it);
    });

    // Stays
    const stays = summary.items.filter((si) => si.isStay)
      .map((si) => buildStay(si, (summary.days.find((d) => d.date === si.date) || {}).title))
      .sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1));

    // Other Summary rows: add their details to the matching plan, or add them as plans
    summary.items.filter((si) => !si.isStay).forEach((si) => {
      const day = byDate[si.date];
      if (!day) return;
      const want = tokens(si.text);
      const match = want.length ? day.items.find((it) => !it.mergedFrom && sharesToken(want, tokens(it.text))) : null;
      const x = summaryExtras(si, match);
      if (match) {
        match.mergedFrom = si.text;
        // Keep the Summary's wording when it says more, e.g. "Leave for Malaga for lunch"
        const have = words(match.text);
        const said = words(si.text);
        if (have.every((w) => said.includes(w)) && said.some((w) => !have.includes(w) && !CONNECTORS.has(w) && !/^\d/.test(w))) match.text = si.text;
        if (match.time == null && x.time != null) match.time = x.time;
        x.notes.forEach((n) => addNote(match, n));
        x.links.forEach((u) => addLink(match, u));
        if (x.status && !match.status) match.status = x.status;
        return;
      }
      const item = { date: si.date, time: x.time, text: si.text, notes: [], links: [], status: x.status, tab: null };
      x.notes.forEach((n) => addNote(item, n));
      x.links.forEach((u) => addLink(item, u));
      let seg = day.segments[day.segments.length - 1];
      if (!seg) {
        seg = { tab: null, stopKey: stopKeyFromText(day.title), items: [] };
        day.segments.push(seg);
      }
      insertByTime(seg.items, item);
      day.items.push(item);
    });

    // Link "Check into …" plans to the stay they belong to
    stays.forEach((stay) => {
      const day = byDate[stay.checkIn];
      if (!day) return;
      const want = tokens(`${stay.name} ${stay.provider}`).filter((t) => !GENERIC_STAY.has(t));
      const it = day.items.find((i) => /check(?:ing)?[\s-]*in(?:to)?\b/i.test(i.text) && (!want.length || sharesToken(want, tokens(i.text))));
      if (!it) return;
      it.stay = stay;
      it.links.forEach((l) => addLink(stay, l.url, l.label));
      it.notes = it.notes.filter((n) => !STAYISH.test(n));
    });

    const todos = (tabs[CFG.todoTab] || [])
      .map((r) => (r || []).map(clean).filter((c) => c && !/^\d+\.?$/.test(c)).join(' '))
      .filter(Boolean);
    const sites = (tabs[CFG.linksTab] || []).map((r) => (r || []).map(clean).filter(Boolean)).filter((r) => r.length);

    days.forEach((day, i) => {
      day.segments.forEach((seg) => seg.items.forEach((it) => {
        it.stopKey = seg.stopKey;
        it.kind = kindOf(it.text);
        it.guide = activityFor(it);
        it.drive = driveInfo(it, seg.stopKey);
        it.todo = it.guide && it.guide.todo ? todos.filter((t) => it.guide.todo.test(t)) : [];
      }));
      day.tonight = stays.find((s) => s.checkIn <= day.date && day.date < s.checkOut) || null;
      day.checkout = stays.find((s) => s.checkOut === day.date) || null;
      day.night = day.tonight ? daysBetween(day.tonight.checkIn, day.date) + 1 : 0;
      day.isLast = i === days.length - 1;
      day.driveMinutes = day.items.filter((it) => it.kind === 'car')
        .reduce((sum, it) => sum + it.notes.reduce((s, n) => s + parseDuration(n), 0), 0);
      day.label = plaqueLabel(day);
    });

    return { title: summary.title, route: summary.route, days, stays, todos, sites };
  }

  function plaqueLabel(day) {
    const highlight = day.items.find((i) => i.guide && i.guide.plaque);
    if (highlight) return highlight.guide.plaque;
    if (/road\s*trip/i.test(day.title)) return 'Road trip';
    if (day.isLast && !day.tonight) return 'Fly home';
    const busiest = day.segments.slice().sort((a, b) => b.items.length - a.items.length)[0];
    if (busiest && busiest.stopKey) return stops[busiest.stopKey].short || stops[busiest.stopKey].name;
    if (busiest && busiest.tab) return busiest.tab;
    return prettyPlace(clean(day.title.split('/')[0].replace(/\(.*?\)/g, ' ')));
  }

  function titleParts(title) {
    const t = clean(title);
    const tag = t.match(/\(([^)]+)\)\s*$/);
    const main = clean(tag ? t.slice(0, tag.index) : t);
    return { route: main.split('/').map(clean).filter(Boolean).map(prettyPlace), tag: tag ? sentenceCase(tag[1]) : '' };
  }

  // A plan (not travel) that starts before checkout, while you'd still be away from the room
  function checkoutClash(day) {
    const stay = day.checkout;
    const out = stay ? parseTime(stay.checkOutTime) : null;
    if (out == null) return '';
    const firstMove = day.items.filter((i) => i.time != null && isTravel(i)).map((i) => i.time).sort((a, b) => a - b)[0];
    const clash = day.items.find((i) => i.time != null && !isTravel(i) && i.kind !== 'bed' && i.time < out && (firstMove == null || i.time < firstMove));
    if (!clash) return '';
    const name = clean(clash.text.replace(/\(.*?\)/g, ' '));
    const dur = parseDuration(clash.text);
    if (dur && clash.time + dur <= out) return '';
    const when = dur ? `${fmtTime(clash.time)} to ${fmtTime(clash.time + dur)}` : `from ${fmtTime(clash.time)}`;
    return `Checkout is at ${stay.checkOutTime}, during the ${name} (${when}). Pack the car and check out before you go, or ask the host about leaving bags.`;
  }

  function dayRouteUrl(day) {
    if (day.items.filter((i) => i.kind === 'car').length < 2) return '';
    const keys = day.segments.map((s) => s.stopKey).filter(Boolean);
    if (keys.length < 3) return '';
    const place = (k) => stops[k].mapName || stops[k].name;
    const lastNight = state.model.stays.find((s) => s.checkOut === day.date);
    const origin = lastNight && lastNight.guide && lastNight.guide.address ? lastNight.guide.address : place(keys[0]);
    const dest = place(keys[keys.length - 1]);
    const via = keys.slice(1, -1).map(place).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}` +
      `${via ? `&waypoints=${encodeURIComponent(via)}` : ''}&travelmode=driving`;
  }

  function providerOf(it) {
    const hay = [it.text, ...it.notes, ...it.links.map((l) => l.url)].join(' ');
    if (/viator/i.test(hay)) return 'Viator';
    if (/teatroflamenco/i.test(hay)) return 'Teatro Flamenco Sevilla';
    if (/airbnb/i.test(hay)) return 'Airbnb';
    if (/expedia/i.test(hay)) return 'Expedia';
    return '';
  }
  // "Free cancellation until Nov 19, local time 6pm" -> "2026-11-19"
  function deadlineOf(status, forDate) {
    const s = clean(status);
    if (!/cancel/i.test(s) || /non[\s-]?refundable/i.test(s)) return null;
    const m = s.match(/(?:until|before|by|on)\s+(?:[^,]*?\bon\s+)?([A-Za-z]{3,9}\.?\s+\d{1,2})\b/i);
    if (m && parseMonthDay(m[1])) return parseMonthDay(m[1]);
    if (/24 hours/i.test(s) && forDate) return addDays(forDate, -1);
    if (/hours? before/i.test(s) && forDate) return forDate;
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Live sync with Google Sheets                                        */
  /* ------------------------------------------------------------------ */

  const pending = {};
  let reqSeq = 0;
  // Fallback: Google may answer through its default callback; route those by request id
  window.google = window.google || {};
  window.google.visualization = window.google.visualization || {};
  window.google.visualization.Query = window.google.visualization.Query || {};
  window.google.visualization.Query.setResponse = (resp) => {
    const handler = resp && pending[resp.reqId];
    if (handler) handler(resp);
  };

  function gvizRows(resp) {
    const rows = (resp.table && resp.table.rows) || [];
    return rows.map((r) => {
      const cells = (r.c || []).map((c) => (c == null ? '' : clean(c.f != null ? c.f : c.v)));
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      return cells;
    }).filter((r) => r.length);
  }

  function readTab(tab) {
    return new Promise((resolve, reject) => {
      const id = String(++reqSeq);
      const callback = `__spainSheet${id}_${Date.now().toString(36)}`;
      const script = document.createElement('script');
      let settled = false;
      let timer = null;
      const finish = (err, rows) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        delete pending[id];
        try { delete window[callback]; } catch (e) { window[callback] = undefined; }
        script.remove();
        if (err) reject(err); else resolve(rows);
      };
      const handle = (resp) => {
        if (!resp || resp.status === 'error') {
          const e = resp && resp.errors && resp.errors[0];
          finish(new Error(e ? (e.detailed_message || e.message || e.reason) : `Google Sheets couldn't read "${tab}"`));
        } else {
          finish(null, gvizRows(resp));
        }
      };
      pending[id] = handle;
      window[callback] = handle;
      timer = setTimeout(() => finish(new Error('Google Sheets did not answer in time')), CFG.liveTimeoutMs || 9000);
      script.onerror = () => finish(new Error('Google Sheets could not be reached'));
      script.async = true;
      script.src = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(CFG.sheetId)}/gviz/tq` +
        `?tqx=reqId:${id};out:json;responseHandler:${callback}&headers=0&sheet=${encodeURIComponent(tab)}&t=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function readSheet() {
    const required = [CFG.summaryTab, ...CFG.cityTabs];
    const optional = [CFG.linksTab, CFG.todoTab].filter(Boolean);
    const names = [...required, ...optional];
    const results = await Promise.allSettled(names.map(readTab));
    const tabs = {};
    results.forEach((r, i) => {
      const name = names[i];
      if (r.status === 'fulfilled') tabs[name] = r.value;
      else if (required.includes(name)) throw new Error(`Couldn't read the "${name}" tab (${r.reason && r.reason.message})`);
      else tabs[name] = (state.tabs && state.tabs[name]) || SNAPSHOT.tabs[name] || [];
    });
    // If a tab is renamed, Google answers with the first tab instead
    const summaryJson = JSON.stringify(tabs[CFG.summaryTab]);
    names.forEach((name) => {
      if (name !== CFG.summaryTab && JSON.stringify(tabs[name]) === summaryJson) {
        if (required.includes(name)) throw new Error(`The sheet has no tab called "${name}"`);
        tabs[name] = (state.tabs && state.tabs[name]) || SNAPSHOT.tabs[name] || [];
      }
    });
    return tabs;
  }

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */

  const state = {
    tabs: null,
    model: null,
    source: 'saved',     // 'saved' (js/sheet-snapshot.js), 'device' (last copy on this device) or 'live'
    savedAt: null,
    checkedAt: null,
    syncing: false,
    failed: false,
    lastSync: 0,
    renderedFor: null
  };

  function useTabs(tabs, source, savedAt) {
    state.tabs = tabs;
    state.model = buildModel(tabs);
    state.source = source;
    state.savedAt = savedAt;
  }

  async function syncFromSheet() {
    if (!CFG.liveSync || state.syncing) return;
    state.syncing = true;
    state.lastSync = Date.now();
    renderFooter();
    try {
      const tabs = await readSheet();
      const now = new Date().toISOString();
      const changed = JSON.stringify(tabs) !== JSON.stringify(state.tabs);
      store.set(CACHE_KEY, { savedAt: now, tabs });
      state.failed = false;
      state.checkedAt = now;
      if (changed) {
        useTabs(tabs, 'live', now);
        render({ keepScroll: true });
      } else {
        state.source = 'live';
        state.savedAt = now;
      }
    } catch (err) {
      state.failed = true;
      console.warn('[Spain guide] Using the saved copy:', err && err.message ? err.message : err);
    } finally {
      state.syncing = false;
      renderFooter();
    }
  }

  // Console helper: save the latest sheet data as a new js/sheet-snapshot.js
  window.downloadSheetSnapshot = () => {
    const body = `/* Saved copy of the "Spain Itinerary" Google Sheet, read on ${new Date().toDateString()}.\n` +
      `   Used when the live sheet can't be reached. */\nwindow.SHEET_SNAPSHOT = ${JSON.stringify({ savedAt: new Date().toISOString(), tabs: state.tabs }, null, 2)};\n`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
    a.download = 'sheet-snapshot.js';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'Saved sheet-snapshot.js. Put it in the js folder.';
  };

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  const ICONS = {
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    bed: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    food: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    wave: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    sunset: '<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    map: '<path d="M14.1 5.55a2 2 0 0 0 1.8 0l3.66-1.83A1 1 0 0 1 21 4.62v12.76a1 1 0 0 1-.55.9l-4.56 2.27a2 2 0 0 1-1.78 0l-4.22-2.1a2 2 0 0 0-1.78 0l-3.66 1.83A1 1 0 0 1 3 19.38V6.62a1 1 0 0 1 .55-.9l4.56-2.27a2 2 0 0 1 1.78 0z"/><path d="M15 5.76v15"/><path d="M9 3.24v15"/>',
    nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    sheet: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M12 11v8"/>',
    todo: '<rect width="18" height="18" x="3" y="3" rx="2"/>'
  };
  const icon = (name, cls) => `<svg class="${cls || 'i'}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;

  function injectIcons() {
    const symbols = Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('');
    document.body.insertAdjacentHTML('afterbegin', `<svg class="icon-sprite" width="0" height="0" aria-hidden="true">${symbols}</svg>`);
  }

  function linkIcon(url) {
    if (/google\.[^/]+\/maps\/dir/.test(url)) return 'nav';
    if (/google\.[^/]+\/maps/.test(url)) return 'map';
    return 'ext';
  }
  function linkList(links) {
    if (!links || !links.length) return '';
    const seen = new Set();
    const unique = links.filter((l) => l && l.url && !seen.has(l.url) && seen.add(l.url));
    return `<ul class="links">${unique.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${icon(l.icon || linkIcon(l.url))}<span>${esc(l.label)}</span></a></li>`).join('')}</ul>`;
  }
  const statusClass = (s) => (/non[\s-]?refundable/i.test(s) ? 'is-locked' : /free cancel/i.test(s) ? 'is-free' : '');
  const tidyStatus = (s) => clean(s).replace(/^non[\s-]?refundable$/i, 'Non-refundable').replace(/^./, (c) => c.toUpperCase());

  const $ = (sel) => document.querySelector(sel);
  const el = {};

  /* Masthead and date strip */

  function tripDates(m) {
    if (!m.days.length) return '';
    const a = toDate(m.days[0].date);
    const b = toDate(m.days[m.days.length - 1].date);
    const sameMonth = a.getUTCMonth() === b.getUTCMonth();
    return `${MONTH_NAMES[a.getUTCMonth()]} ${a.getUTCDate()}–${sameMonth ? '' : MONTH_NAMES[b.getUTCMonth()] + ' '}${b.getUTCDate()}, ${b.getUTCFullYear()}`;
  }
  function countdown(m, today) {
    if (!m.days.length) return '';
    const first = m.days[0].date;
    const last = m.days[m.days.length - 1].date;
    if (today < first) {
      const n = daysBetween(today, first);
      return n === 1 ? 'Starts tomorrow' : `${n} days to go`;
    }
    if (today > last) return 'Trip complete';
    const d = m.days.find((x) => x.date === today);
    return d ? `Today is day ${d.index + 1} of ${m.days.length}` : '';
  }

  function renderMasthead() {
    const m = state.model;
    const today = spainNow().date;
    el.when.innerHTML = `<span>${esc(tripDates(m))}</span>${countdown(m, today) ? `<span class="countdown">${esc(countdown(m, today))}</span>` : ''}`;
    el.route.textContent = m.route ? m.route.split(/\s[-–]\s/).map(prettyPlace).join(' → ') : '';
    el.nav.querySelectorAll('a').forEach((a) => {
      const on = a.getAttribute('href') === `#${state.view.type}`;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function renderStrip() {
    const today = spainNow().date;
    el.strip.innerHTML = state.model.days.map((d) => {
      const isToday = d.date === today;
      const current = state.view.type === 'day' && state.view.date === d.date;
      const wd = WEEKDAYS[weekdayOf(d.date)];
      return `<a class="plaque${isToday ? ' is-today' : ''}" href="#${d.date}"${current ? ' aria-current="page"' : ''}
        aria-label="${esc(`${isToday ? 'Today, ' : ''}${longDate(d.date)}: ${d.label}`)}">
        <span class="plaque-glaze">
          <span class="plaque-wd">${isToday ? 'Today' : wd.slice(0, 3)}</span>
          <span class="plaque-num">${toDate(d.date).getUTCDate()}</span>
          <span class="plaque-label">${esc(d.label)}</span>
        </span>
      </a>`;
    }).join('');
    const current = el.strip.querySelector('[aria-current="page"]') || el.strip.querySelector('.is-today');
    if (current) {
      const box = el.strip;
      const target = current.offsetLeft - (box.clientWidth - current.offsetWidth) / 2;
      box.scrollLeft = Math.max(0, target);
    }
  }

  /* One day */

  function keyLines(guide, day) {
    if (!guide || !guide.key) return [];
    return guide.key.filter((k) => {
      if (typeof k === 'string') return true;
      if (k.weekdays && !k.weekdays.includes(weekdayOf(day.date))) return false;
      if (k.dates && !k.dates.includes(day.date)) return false;
      return true;
    }).map((k) => (typeof k === 'string' ? k : k.text));
  }

  function itemHtml(it, day) {
    const g = it.guide;
    const notes = it.notes.map((n) => `<p class="item-note">${esc(n)}</p>`).join('');
    const leg = it.drive && it.drive.leg ? `<p class="item-note">${esc(it.drive.leg)}</p>` : '';
    const status = it.status ? `<p class="item-status ${statusClass(it.status)}">${esc(tidyStatus(it.status))}</p>` : '';
    const keys = keyLines(g, day).map((k) => `<p class="item-key">${icon('info')}<span>${esc(k)}</span></p>`).join('');
    const todo = it.todo && it.todo.length
      ? `<p class="item-todo">${icon('alert')}<span>Still on the TODO list: ${esc(it.todo.join('; '))}</span></p>` : '';
    const links = [
      ...(it.drive ? [{ label: `Directions to ${stops[it.drive.toKey].short}`, url: it.drive.url, icon: 'nav' }] : []),
      ...it.links,
      ...(g && !g.about && g.links ? g.links : [])
    ];
    const jump = it.stay && day.tonight === it.stay ? '<button type="button" class="jump" data-jump="tonight">See tonight’s stay</button>' : '';
    const more = g && g.about
      ? `<details class="more" data-key="item-${esc(slug(g.title))}"><summary>${icon('down', 'i chev')}<span>More about ${esc(g.title.replace(/^the /i, 'the '))}</span></summary>
          <div class="more-body"><p>${esc(g.about)}</p>${linkList(g.links)}</div></details>` : '';
    const time = it.time == null ? '' : `<time>${fmtTime(it.time)}</time><span class="flag flag-now">Now</span><span class="flag flag-next">Next</span>`;
    return `<li class="row row-item kind-${it.kind}" data-min="${it.time == null ? '' : it.time}">
        <span class="row-time">${time}</span>
        <span class="row-node"><span class="ico">${icon(KIND_ICON[it.kind] || 'eye')}</span></span>
        <div class="row-body">
          <p class="item-text">${esc(it.text)}</p>
          ${notes}${leg}${status}${keys}${todo}${linkList(links)}${jump}${more}
        </div>
      </li>`;
  }

  function segmentHtml(seg, day) {
    const stop = seg.stopKey ? stops[seg.stopKey] : null;
    const name = stop ? stop.name : prettyPlace(seg.tab || titleParts(day.title).route[0] || 'Plans');
    const id = `stop-${slug(name)}-${day.segments.indexOf(seg)}`;
    const staying = seg.items.some((i) => !isTravel(i));
    const wx = stop && staying && stop.climate
      ? `<p class="stop-wx" data-wx-stop="${esc(seg.stopKey)}" data-wx-date="${day.date}">${esc(stop.climate)}</p>` : '';
    const key = stop && staying && stop.key ? `<p class="stop-key">${icon('info')}<span>${esc(stop.key)}</span></p>` : '';
    const sections = stop && staying ? (stop.sections || []).filter((s) => s.items && s.items.length) : [];
    const about = stop && staying && (stop.about || sections.length)
      ? `<div class="row row-more"><span class="row-node"></span><div class="row-body">
          <details class="more" data-key="stop-${esc(slug(name))}"><summary>${icon('down', 'i chev')}<span>About ${esc(stop.short || stop.name)}</span></summary>
            <div class="more-body">
              ${stop.about ? `<p>${esc(stop.about)}</p>` : ''}
              ${sections.map((s) => `<h4>${esc(s.title)}</h4><ul>${s.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`).join('')}
              ${linkList(stop.links)}
            </div></details></div></div>` : '';
    return `<section class="stop" aria-labelledby="${id}">
        <div class="row row-stop">
          <span class="row-node"><span class="tile" aria-hidden="true"></span></span>
          <div class="row-body"><h3 class="stop-name" id="${id}">${esc(name)}</h3>${wx}${key}</div>
        </div>
        <ol class="items">${seg.items.map((it) => itemHtml(it, day)).join('')}</ol>
        ${about}
      </section>`;
  }

  function tonightHtml(day) {
    const s = day.tonight;
    if (!s) return '';
    const g = s.guide || {};
    const facts = [];
    if (s.checkInTime) facts.push(['Check-in', day.date === s.checkIn ? `From ${s.checkInTime}` : `${weekdayShortDate(s.checkIn)}, from ${s.checkInTime}`]);
    facts.push(['Checkout', `${weekdayShortDate(s.checkOut)}${s.checkOutTime ? `, by ${s.checkOutTime}` : ''}`]);
    if (g.address) facts.push(['Address', g.address]);
    else if (g.addressNote) facts.push(['Address', g.addressNote]);
    const sub = [s.provider ? `Booked on ${s.provider}` : '', s.nights > 1 ? `night ${day.night} of ${s.nights}` : '1 night'].filter(Boolean).join(', ');
    const notes = [...(g.notes || []), ...s.notes];
    const links = [...s.links, ...(g.address ? [{ label: 'Map', url: GUIDE.mapsSearch(g.address) }] : []), ...(g.links || [])];
    const area = prettyPlace(g.area || s.city);
    return `<section class="tonight" id="tonight" aria-labelledby="tonight-h">
        <div class="tonight-band" aria-hidden="true"></div>
        <div class="tonight-inner">
          <h3 class="side-h" id="tonight-h">${icon('bed')}<span>Tonight${area ? ` in ${esc(area)}` : ''}</span></h3>
          <p class="stay-name">${esc(s.name)}</p>
          <p class="stay-sub">${esc(sub.charAt(0).toUpperCase() + sub.slice(1))}</p>
          <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          ${notes.map((n) => `<p class="stay-note">${esc(n)}</p>`).join('')}
          ${linkList(links)}
        </div>
      </section>`;
  }

  function checkoutHtml(day) {
    const s = day.checkout;
    if (!s) return '';
    const clash = checkoutClash(day);
    return `<section class="checkout" aria-label="Checkout today">
        ${icon('key')}
        <div><p><strong>Check out of ${esc(s.name)}${s.checkOutTime ? ` by ${esc(s.checkOutTime)}` : ''}.</strong></p>
        ${clash ? `<p>${esc(clash)}</p>` : ''}</div>
      </section>`;
  }

  function tipsHtml(day) {
    const tips = ((GUIDE.days || {})[day.date] || {}).tips || [];
    if (!tips.length) return '';
    return `<section class="tips" aria-labelledby="tips-h">
        <h3 class="side-h" id="tips-h">${icon('info')}<span>Tips for the day</span></h3>
        <ul>${tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </section>`;
  }

  function renderDay(day) {
    const m = state.model;
    const today = spainNow().date;
    const parts = titleParts(day.title);
    const sun = (GUIDE.sun || {})[day.date];
    const facts = [];
    if (sun) facts.push(`<li>${icon('sunset')}<span>Sunrise ${esc(sun.rise)}, sunset ${esc(sun.set)} in ${esc(sun.place)}</span></li>`);
    if (day.driveMinutes) facts.push(`<li>${icon('car')}<span>About ${esc(fmtDuration(day.driveMinutes))} of driving</span></li>`);
    const routeUrl = dayRouteUrl(day);
    if (routeUrl) facts.push(`<li>${icon('route')}<a href="${esc(routeUrl)}" target="_blank" rel="noopener">Open the day’s route in Google Maps</a></li>`);
    const prev = m.days[day.index - 1];
    const next = m.days[day.index + 1];
    return `<article class="day" data-date="${day.date}" aria-labelledby="day-heading">
        <header class="day-head">
          <div class="plaque-big"><div class="plaque-big-glaze">
            <p class="day-count">Day ${day.index + 1} of ${m.days.length}${day.date === today ? ', today' : ''}</p>
            <h2 class="day-date" id="day-heading">${esc(longDate(day.date))}</h2>
            ${parts.route.length ? `<p class="day-route">${esc(parts.route.join(' → '))}</p>` : ''}
            ${parts.tag ? `<p class="day-tag">${esc(parts.tag)}</p>` : ''}
          </div></div>
          ${facts.length ? `<ul class="day-facts">${facts.join('')}</ul>` : ''}
        </header>
        <div class="day-grid">
          ${checkoutHtml(day)}
          <section class="plan" aria-label="Plan for the day"><div class="route">${day.segments.map((s) => segmentHtml(s, day)).join('')}</div></section>
          ${tonightHtml(day)}
          ${tipsHtml(day)}
        </div>
        <nav class="pager" aria-label="Other days">
          ${prev ? `<a class="pager-prev" href="#${prev.date}">${icon('left')}<span><small>Previous day</small>${esc(weekdayShortDate(prev.date))}</span></a>` : '<span></span>'}
          ${next ? `<a class="pager-next" href="#${next.date}"><span><small>Next day</small>${esc(weekdayShortDate(next.date))}</span>${icon('right')}</a>` : '<span></span>'}
        </nav>
      </article>`;
  }

  /* Whole trip */

  function renderTrip() {
    const m = state.model;
    const today = spainNow().date;
    const stayRows = m.stays.map((s) => {
      const area = prettyPlace((s.guide && s.guide.area) || s.city);
      return `<li>
          <span class="stays-dates">${esc(shortDate(s.checkIn))} to ${esc(shortDate(s.checkOut))}</span>
          <span class="stays-place"><strong>${esc(area)}</strong><span>${esc(s.name)}${s.provider ? `, ${esc(s.provider)}` : ''}</span></span>
          <span class="stays-nights">${s.nights} night${s.nights === 1 ? '' : 's'}</span>
        </li>`;
    }).join('');

    const dayRows = m.days.map((d) => {
      const parts = titleParts(d.title);
      const lines = d.segments.flatMap((s) => s.items).map((it) =>
        `<li><span class="ov-time">${it.time == null ? '' : fmtTime(it.time)}</span><span>${esc(it.text)}</span></li>`).join('');
      return `<li class="ov-day${d.date === today ? ' is-today' : ''}">
          <a class="ov-plaque" href="#${d.date}" aria-label="${esc(`Open ${longDate(d.date)}`)}">
            <span>${WEEKDAYS[weekdayOf(d.date)].slice(0, 3)}</span><strong>${toDate(d.date).getUTCDate()}</strong>
          </a>
          <div class="ov-day-body">
            <h3><a href="#${d.date}">${esc(parts.route.join(' → ') || d.label)}</a>${parts.tag ? ` <span class="ov-tag">${esc(parts.tag)}</span>` : ''}</h3>
            <ul class="ov-items">${lines}</ul>
            ${d.tonight ? `<p class="ov-tonight">${icon('bed')}<span>${esc(d.tonight.name)}</span></p>` : ''}
          </div>
        </li>`;
    }).join('');

    const bookings = [];
    m.stays.forEach((s) => bookings.push({ date: s.checkIn, what: s.name, via: s.provider, status: s.status }));
    m.days.forEach((d) => d.items.forEach((it) => {
      if (it.status) bookings.push({ date: d.date, what: it.text, via: providerOf(it), status: it.status });
    }));
    bookings.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const bookingRows = bookings.map((b) => {
      const deadline = deadlineOf(b.status, b.date);
      const soon = deadline && deadline >= today && daysBetween(today, deadline) <= 7;
      const passed = deadline && deadline < today;
      return `<tr class="${soon ? 'is-soon' : ''}${passed ? ' is-passed' : ''}">
          <td data-label="Date">${esc(weekdayShortDate(b.date))}</td>
          <td data-label="Booking">${esc(b.what)}${b.via ? `<span class="via">${esc(b.via)}</span>` : ''}</td>
          <td data-label="Cancellation"><span class="${statusClass(b.status)}">${esc(tidyStatus(b.status))}</span>${soon ? '<span class="soon">Deadline this week</span>' : ''}</td>
        </tr>`;
    }).join('');

    const todoList = m.todos.length
      ? `<section class="ov-block"><h2 class="block-h">Still to plan</h2>
          <p class="block-sub">From the TODO tab in the sheet.</p>
          <ul class="todo">${m.todos.map((t) => `<li>${icon('todo')}<span>${esc(t)}</span></li>`).join('')}</ul></section>` : '';

    return `<article class="trip" aria-labelledby="trip-h">
        <h2 class="page-h" id="trip-h">The whole trip</h2>
        <section class="ov-block"><h2 class="block-h">Where we’re sleeping</h2><ol class="stays">${stayRows}</ol></section>
        <section class="ov-block"><h2 class="block-h">Day by day</h2><ol class="ov-days">${dayRows}</ol></section>
        ${bookingRows ? `<section class="ov-block"><h2 class="block-h">Bookings and cancellation</h2>
          <table class="bookings"><thead><tr><th scope="col">Date</th><th scope="col">Booking</th><th scope="col">Cancellation</th></tr></thead>
          <tbody>${bookingRows}</tbody></table></section>` : ''}
        ${todoList}
      </article>`;
  }

  /* Good to know */

  function infoItem(item) {
    if (typeof item === 'string') return `<li>${esc(item)}</li>`;
    if (item.url) return `<li><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.text)}</a></li>`;
    if (item.tel) return `<li>${esc(item.text)} <a class="call" href="tel:${esc(item.tel)}">${icon('phone')}<span>Call</span></a></li>`;
    return `<li>${esc(item.text)}</li>`;
  }

  function renderInfo() {
    const m = state.model;
    const sections = (GUIDE.info || []).map((s) => `<section class="info-block"><h2 class="block-h">${esc(s.title)}</h2><ul>${s.items.map(infoItem).join('')}</ul></section>`).join('');
    const phrases = (GUIDE.phrases || []).length
      ? `<section class="info-block"><h2 class="block-h">A few words</h2><dl class="phrases">${GUIDE.phrases.map(([es, en]) => `<div><dt lang="es">${esc(es)}</dt><dd>${esc(en)}</dd></div>`).join('')}</dl></section>` : '';
    const siteRows = m.sites.map((row) => {
      const name = row.join(' ');
      const site = (GUIDE.sites || []).find((s) => s.match.test(name));
      const used = [];
      m.stays.forEach((st) => { if (site && site.match.test(st.provider)) used.push(st.name); });
      m.days.forEach((d) => d.items.forEach((it) => { if (site && !it.stay && site.match.test(`${it.text} ${providerOf(it)}`)) used.push(it.text); }));
      const label = site ? site.label : name;
      return `<li>${site ? `<a href="${esc(site.url)}" target="_blank" rel="noopener">${esc(label)}</a>` : esc(label)}${used.length ? `<span class="used">${esc([...new Set(used)].join('; '))}</span>` : ''}</li>`;
    }).join('');
    return `<article class="info" aria-labelledby="info-h">
        <h2 class="page-h" id="info-h">Good to know</h2>
        <div class="info-grid">
          ${sections}
          ${phrases}
          ${siteRows ? `<section class="info-block"><h2 class="block-h">Booking sites</h2><p class="block-sub">From the Misc tab in the sheet.</p><ul class="sites">${siteRows}</ul></section>` : ''}
          <section class="info-block"><h2 class="block-h">About this guide</h2>
            <p>The plans, stays and bookings come from the Spain Itinerary Google Sheet. Maps, tips and links are added on top.</p>
            <p id="info-sync"></p>
            <p><a href="${esc(CFG.sheetUrl)}" target="_blank" rel="noopener">Open the Google Sheet</a></p>
          </section>
        </div>
      </article>`;
  }

  /* Footer and sync status */

  function stamp(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function syncText() {
    if (!CFG.liveSync) return `Showing the copy of the Google Sheet saved on ${stamp(state.savedAt)}.`;
    if (state.syncing && state.source !== 'live') return 'Checking the Google Sheet for changes…';
    if (state.source === 'live') return `Up to date with the Google Sheet as of ${stamp(state.checkedAt || state.savedAt)}.`;
    const where = state.source === 'device' ? 'the copy this device loaded on' : 'the copy saved with the site on';
    return `Showing ${where} ${stamp(state.savedAt)}.${state.failed ? ' The Google Sheet couldn’t be reached just now.' : ''}`;
  }
  function renderFooter() {
    const text = syncText();
    el.foot.innerHTML = `<p class="sync">${icon('sheet')}<span>${esc(text)}</span></p>
      <p class="foot-actions">
        ${CFG.liveSync ? `<button type="button" data-action="sync"${state.syncing ? ' disabled' : ''}>${icon('refresh')}<span>${state.syncing ? 'Checking…' : 'Check the sheet for changes'}</span></button>` : ''}
        <a href="${esc(CFG.sheetUrl)}" target="_blank" rel="noopener">${icon('ext')}<span>Open the Google Sheet</span></a>
      </p>`;
    const info = document.getElementById('info-sync');
    if (info) info.textContent = text;
  }

  /* Weather (only once a day is within the forecast range) */

  const WX_TEXT = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
    85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorms', 96: 'Thunderstorms with hail', 99: 'Thunderstorms with hail'
  };
  async function forecast(stop, date) {
    const key = `${WX_KEY}:${stop.lat},${stop.lon},${date}`;
    const cached = store.get(key, true);
    if (cached && Date.now() - cached.at < 3 * 3600 * 1000) return cached.wx;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${stop.lat}&longitude=${stop.lon}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=${encodeURIComponent(CFG.timeZone)}&start_date=${date}&end_date=${date}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Forecast unavailable (${res.status})`);
    const d = (await res.json()).daily || {};
    const pick = (k) => (d[k] && d[k].length ? d[k][0] : null);
    const wx = { code: pick('weather_code'), max: pick('temperature_2m_max'), min: pick('temperature_2m_min'), rain: pick('precipitation_probability_max') };
    if (wx.max == null || wx.min == null) throw new Error('No forecast for that day yet');
    store.set(key, { at: Date.now(), wx }, true);
    return wx;
  }
  function describeWx(wx) {
    const f = (c) => Math.round((c * 9) / 5 + 32);
    const sky = WX_TEXT[wx.code] || 'Forecast';
    const parts = [`${sky}, high ${f(wx.max)}°F (${Math.round(wx.max)}°C), low ${f(wx.min)}°F (${Math.round(wx.min)}°C)`];
    if (wx.rain != null) parts.push(`${wx.rain}% chance of rain`);
    return `Forecast: ${parts.join(', ')}.`;
  }
  function fillWeather() {
    if (!CFG.weather || !window.fetch) return;
    const today = spainNow().date;
    document.querySelectorAll('[data-wx-stop]').forEach((node) => {
      const date = node.getAttribute('data-wx-date');
      const offset = daysBetween(today, date);
      const stop = stops[node.getAttribute('data-wx-stop')];
      if (offset < 0 || offset > 15 || !stop || stop.lat == null) return;
      forecast(stop, date).then((wx) => {
        if (!node.isConnected) return;
        node.textContent = describeWx(wx);
        node.classList.add('is-live');
      }).catch(() => { /* keep the typical-weather line */ });
    });
  }

  /* "Now" and "Next" on today's plan */

  function markNow() {
    const rows = Array.from(document.querySelectorAll('.day .row-item'));
    rows.forEach((r) => r.classList.remove('is-now', 'is-next', 'is-past'));
    const dayEl = document.querySelector('.day[data-date]');
    const now = spainNow();
    if (!dayEl || dayEl.getAttribute('data-date') !== now.date) return;
    const timed = rows.filter((r) => r.getAttribute('data-min') !== '');
    const mins = (r) => Number(r.getAttribute('data-min'));
    const started = timed.filter((r) => mins(r) <= now.mins);
    const current = started.length && now.mins - mins(started[started.length - 1]) <= 120 ? started[started.length - 1] : null;
    const next = timed.find((r) => mins(r) > now.mins);
    timed.forEach((r) => { if (mins(r) <= now.mins && r !== current) r.classList.add('is-past'); });
    if (current) current.classList.add('is-now');
    if (next) next.classList.add('is-next');
  }

  /* ------------------------------------------------------------------ */
  /* Routing                                                             */
  /* ------------------------------------------------------------------ */

  function currentView() {
    const h = decodeURIComponent((location.hash || '').slice(1));
    const days = state.model.days;
    if (h === 'trip' || h === 'info') return { type: h };
    if (days.some((d) => d.date === h)) return { type: 'day', date: h };
    const today = spainNow().date;
    if (days.some((d) => d.date === today)) return { type: 'day', date: today };
    return { type: 'trip' };
  }

  function render(opts) {
    const keepScroll = opts && opts.keepScroll;
    const open = keepScroll ? Array.from(document.querySelectorAll('details[open][data-key]')).map((d) => d.getAttribute('data-key')) : [];
    state.view = currentView();
    state.renderedFor = spainNow().date;
    renderMasthead();
    renderStrip();
    let html;
    if (state.view.type === 'day') {
      const day = state.model.days.find((d) => d.date === state.view.date);
      html = renderDay(day);
      document.title = `${weekdayShortDate(day.date)}: ${day.label} | Spain trip`;
    } else if (state.view.type === 'info') {
      html = renderInfo();
      document.title = 'Good to know | Spain trip';
    } else {
      html = renderTrip();
      document.title = 'Spain trip, day by day';
    }
    el.main.innerHTML = html;
    open.forEach((k) => { const d = el.main.querySelector(`details[data-key="${k}"]`); if (d) d.open = true; });
    renderFooter();
    markNow();
    fillWeather();
  }

  function onHashChange() {
    render();
    const top = el.masthead.offsetTop + el.masthead.offsetHeight;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'auto' });
  }

  function tick() {
    if (spainNow().date !== state.renderedFor) render({ keepScroll: true });
    else markNow();
  }

  function init() {
    el.masthead = $('.masthead');
    el.when = $('#trip-when');
    el.route = $('#trip-route');
    el.nav = $('.top-nav');
    el.strip = $('#day-strip');
    el.main = $('#main');
    el.foot = $('#foot');
    injectIcons();

    const cached = store.get(CACHE_KEY);
    if (CFG.liveSync && cached && cached.tabs && cached.savedAt && (!SNAPSHOT.savedAt || cached.savedAt > SNAPSHOT.savedAt)) {
      useTabs(cached.tabs, 'device', cached.savedAt);
    } else {
      useTabs(SNAPSHOT.tabs, 'saved', SNAPSHOT.savedAt);
    }
    render();

    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', (e) => {
      const jump = e.target.closest('[data-jump]');
      if (jump) {
        const target = document.getElementById(jump.getAttribute('data-jump'));
        if (target) target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      }
      if (e.target.closest('[data-action="sync"]')) syncFromSheet();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      tick();
      if (Date.now() - state.lastSync > 10 * 60 * 1000) syncFromSheet();
    });
    setInterval(tick, 60 * 1000);
    syncFromSheet();
  }

  // Exposed for checking the parser from the console or tests
  window.SpainGuide = { buildModel, parseSummary, parseCityTab, state };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
