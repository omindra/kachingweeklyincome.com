/* Kaching Weekly Income — public dashboard.
 *
 * Read-only fork of prealerts' kaching-scanner.html + kaching.html
 * rendering logic. No login, no writes, no "Run Scan"/"Track" buttons —
 * this site only ever fetches two JSON files (published on a schedule by
 * KachingExportService in the prealerts app) and renders them.
 *
 * Deliberately excluded vs. the source pages:
 *   - Position checkbox / "I hold a position" highlighting — that's the
 *     admin's personal marker, stripped server-side before export anyway
 *     (see KachingExportService.exportScanner), but there's also simply
 *     no backend here to write it to.
 *   - Any lifecycle/P&L data from the real KaChing dashboard — never
 *     exported in the first place (explicit decision, see the saved
 *     project plan).
 */

// Site is served from GitHub Pages; the data itself is exported on a
// schedule straight to S3 by KachingExportService (prealerts app), so it's
// fetched cross-origin from the bucket rather than bundled with the site.
const DATA = {
    scanner: 'https://kachingweeklyincome-site.s3.us-east-1.amazonaws.com/data/kaching-scanner.json',
    plans:   'https://kachingweeklyincome-site.s3.us-east-1.amazonaws.com/data/kaching-plans.json'
};

document.addEventListener('DOMContentLoaded', () => {
    initTabs();

    // Reveal the disclaimer only once the initial load has settled (success
    // or failure either way) — showing it immediately looks bad, since it'd
    // sit right under a bare "Loading…" line and then jump down once the
    // real content renders in.
    Promise.allSettled([loadScanner(), loadPlans()]).then(() => {
        const disclaimer = document.getElementById('disclaimer-box');
        if (disclaimer) disclaimer.hidden = false;
    });

    // Scanner "Options →" links jump to the Options tab filtered to that ticker.
    document.getElementById('scanner-results').addEventListener('click', (e) => {
        const link = e.target.closest('.ke-plans-link');
        if (!link) return;
        e.preventDefault();
        showPlansForTicker(link.dataset.ticker);
    });

    // Ticker filter inputs — each tab filters its own already-loaded data,
    // no refetch needed.
    document.getElementById('scanner-ticker-filter').addEventListener('input', (e) => {
        scannerTickerQuery = e.target.value;
        applyScannerFilter();
    });
    document.getElementById('plans-ticker-filter').addEventListener('input', (e) => {
        plansTickerQuery = e.target.value;
        renderPlansTable(allPlans);
    });
    document.getElementById('tickers-ticker-filter').addEventListener('input', (e) => {
        tickersQuery = e.target.value;
        applyTickersFilter();
    });

});

// ── Tabs ─────────────────────────────────────────────────────────────

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-pane').forEach(p =>
        p.classList.toggle('active', p.id === 'pane-' + name));
}

// ── Scanner tab ──────────────────────────────────────────────────────

let scannerCandidates = [];
let scannerTickerQuery = '';

async function loadScanner() {
    const meta = document.getElementById('scanner-meta');
    try {
        const res = await fetch(DATA.scanner);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const body = await res.json();
        const scanAt = body.data && body.data.scanAt;
        const candidates = (body.data && body.data.candidates) || [];
        scannerCandidates = candidates;
        renderEarningsBanner(candidates);
        applyScannerFilter();
        meta.textContent = scanAt
            ? 'Scan from ' + new Date(scanAt).toLocaleString() + '  ·  ' + candidates.length + ' tickers'
            : candidates.length + ' tickers';
    } catch (e) {
        meta.textContent = '⚠ Could not load scanner data: ' + e.message;
        document.getElementById('scanner-results').innerHTML =
            '<div class="ke-empty">Data isn\'t available yet — check back soon.</div>';
    }
}

/** Re-filters the already-fetched scanner candidates by scannerTickerQuery
 *  and re-renders — no refetch, this is a pure client-side view filter. */
function applyScannerFilter() {
    const q = scannerTickerQuery.trim().toUpperCase();
    const filtered = q ? scannerCandidates.filter(c => c.ticker.toUpperCase().includes(q)) : scannerCandidates;
    renderScannerTable(filtered, q);
}

const EARNINGS_BANNER_DAYS = 5;
const EARNINGS_WARNING_DAYS = 7;   // matches the source app's lifecycle "sit out the week" window
const SHARP_SCORE_DROP = 20;

function renderEarningsBanner(candidates) {
    const banner = document.getElementById('earnings-banner');
    const upcoming = candidates
        .filter(c => c.earningsInDays != null && c.earningsInDays >= 0 && c.earningsInDays <= EARNINGS_BANNER_DAYS)
        .sort((a, b) => a.earningsInDays - b.earningsInDays);

    if (!upcoming.length) { banner.style.display = 'none'; banner.innerHTML = ''; return; }

    banner.className = 'ke-earnings-banner';
    banner.style.display = '';
    banner.innerHTML = '📅 <strong>Earnings within ' + EARNINGS_BANNER_DAYS + ' days:</strong> ' +
        upcoming.map(c => '<span class="pill">' + escapeHtml(c.ticker) + ' — ' +
            (c.earningsInDays === 0 ? 'today' : c.earningsInDays + 'd') + '</span>').join(' ');
}

function renderScannerTable(candidates, query) {
    const wrap = document.getElementById('scanner-results');
    if (!candidates.length) {
        wrap.innerHTML = '<div class="ke-empty">' +
            (query ? 'No tickers match "' + escapeHtml(query) + '".' : 'No scan data yet — check back soon.') +
            '</div>';
        return;
    }
    const sorted = candidates.slice().sort((a, b) => b.totalScore - a.totalScore);
    wrap.innerHTML =
        '<div class="ke-table-wrap"><table class="ke-table"><thead><tr>' +
        '<th>Ticker</th><th>Score</th><th>Signal</th><th>Price</th>' +
        '<th>Laggard</th><th>RSI</th><th>MACD</th><th>Trend</th>' +
        '<th>RS vs SPY</th><th>IV Rank</th><th>Liquidity</th>' +
        '<th title="Days to next earnings — sector ETFs have none">Earnings</th>' +
        '<th>Plans</th>' +
        '</tr></thead><tbody>' +
        sorted.map(scannerRowHtml).join('') +
        '</tbody></table></div>';
}

function sharpDrop(c) {
    return c.previousTotalScore != null && (c.previousTotalScore - c.totalScore) >= SHARP_SCORE_DROP;
}

function signalBadge(c) {
    const dropped = sharpDrop(c);
    const needsWarn = c.signal === 'TOO EXTENDED' && dropped;
    const cls = needsWarn ? 'too-extended-warn' : signalClass(c.signal);
    const title = escapeHtml(c.reasoning || '') +
        (dropped ? ' — score dropped from ' + c.previousTotalScore.toFixed(0) +
            ' to ' + c.totalScore.toFixed(0) + ' since last scan' : '');
    return { cls, title };
}

function scannerRowHtml(c) {
    const scoreCls = c.totalScore >= 70 ? 'hi' : (c.totalScore >= 55 ? 'mid' : 'lo');
    const badge = signalBadge(c);
    return '<tr>' +
        '<td class="ticker">' + escapeHtml(c.ticker) + '</td>' +
        '<td><span class="ke-score ' + scoreCls + '">' + c.totalScore.toFixed(0) + '</span></td>' +
        '<td><span class="ke-signal ' + badge.cls + '" title="' + badge.title + '">' +
            escapeHtml(c.signal || '—') + '</span></td>' +
        '<td>' + fmtPrice(c.price) + '</td>' +
        '<td>' + laggardCell(c) + '</td>' +
        '<td>' + rsiCell(c) + '</td>' +
        '<td>' + macdCell(c) + '</td>' +
        '<td>' + trendCell(c) + '</td>' +
        '<td>' + c.relativeStrengthScore.toFixed(0) + '/10</td>' +
        '<td>' + ivCell(c) + '</td>' +
        '<td>' + c.liquidityScore.toFixed(1) + '/5</td>' +
        '<td>' + earningsCell(c) + '</td>' +
        '<td><a href="#" class="ke-plans-link" data-ticker="' + escapeHtml(c.ticker) +
            '" title="Show active options plays for ' + escapeHtml(c.ticker) + '">Options →</a></td>' +
        '</tr>';
}

function laggardCell(c) {
    if (c.relativePerfPct == null) return c.laggardScore.toFixed(0) + '/20';
    const sign = c.relativePerfPct >= 0 ? '+' : '';
    const pp = sign + c.relativePerfPct.toFixed(0) + 'pp';
    const rank = c.relativePercentileRank != null ? c.relativePercentileRank.toFixed(0) : null;
    let tip = c.ticker + "'s 1yr return is " + pp + ' vs SPY (pp = percentage points, sector minus SPY).';
    if (rank != null) {
        tip += ' That ranks in the ' + rank + 'th percentile of every ticker scanned that day ' +
            '(p0 = worst laggard, p100 = best outperformer).';
    }
    return '<span class="ke-help" title="' + escapeHtml(tip) + '">' +
        c.laggardScore.toFixed(0) + '/20 (' + pp + (rank != null ? ', p' + rank : '') + ')</span>';
}

function trendCell(c) {
    const p50  = c.above50MA  ? '<span class="ke-check">50MA✓</span>' : '<span class="ke-cross">50MA✗</span>';
    const p200 = c.above200MA ? '<span class="ke-check">200MA✓</span>' : '<span class="ke-cross">200MA✗</span>';
    return c.trendScore.toFixed(0) + '/15 ' + p50 + ' ' + p200;
}

function rsiCell(c) {
    const chk = c.rsiReversal ? '<span class="ke-check">✓</span> ' : '';
    let nums = '';
    if (c.rsiPrevious != null && c.rsiCurrent != null) nums = ' (' + c.rsiPrevious.toFixed(0) + '→' + c.rsiCurrent.toFixed(0) + ')';
    else if (c.rsiCurrent != null) nums = ' (' + c.rsiCurrent.toFixed(0) + ')';
    return chk + c.rsiScore.toFixed(0) + '/20' + nums;
}

function macdCell(c) {
    const chk = c.macdReversal ? '<span class="ke-check">✓</span> ' : '';
    const hist = c.macdHistogram != null ? ' (' + (c.macdHistogram >= 0 ? '+' : '') + c.macdHistogram.toFixed(2) + ')' : '';
    return chk + c.macdScore.toFixed(0) + '/20' + hist;
}

function ivCell(c) {
    const pts = c.volatilityScore.toFixed(0) + '/10';
    const tip = c.ivRank != null
        ? 'IV Rank ' + c.ivRank.toFixed(0) + ' — 40-80 scores full points (good premium, not crush risk)'
        : 'No IV history yet for this ticker — scored as neutral, not penalized';
    return '<span class="ke-help" title="' + escapeHtml(tip) + '">' + pts + '</span>';
}

function earningsCell(c) {
    const d = c.earningsInDays;
    if (d == null || d < 0) return '<span class="dim">—</span>';
    const label = d === 0 ? 'Today' : d + 'd';
    if (d <= EARNINGS_WARNING_DAYS) {
        return '<span class="ke-earnings-warn" title="Earnings in ' + d +
            ' day(s)">📅 ' + label + '</span>';
    }
    return '<span class="dim">' + label + '</span>';
}

function signalClass(signal) {
    switch (signal) {
        case 'KACHING PUT':   return 'kaching-put';
        case 'WATCH':         return 'watch';
        case 'TOO EXTENDED':  return 'too-extended';
        case 'FALLING KNIFE': return 'falling-knife';
        default:              return 'wait';
    }
}

// ── Plans tab (universe badges + Active Diagonal Weekly Plans) ────────

let allPlans = [];
let plansTickerQuery = '';

async function loadPlans() {
    // Options and Tickers tabs are both driven by this one fetch (plans.json
    // carries diagonalPlans + universeBadges together) — just rendered into
    // two separate tab panes now.
    const meta = document.getElementById('plans-meta');
    const tickersMeta = document.getElementById('tickers-meta');
    try {
        const res = await fetch(DATA.plans);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const body = await res.json();
        const data = body.data || {};
        allBadges = data.universeBadges || [];
        universeCountTotal = data.universeCount;
        allPlans = data.diagonalPlans || [];
        applyTickersFilter();
        renderPlansTable(allPlans);
        const asOf = body.exportedAt
            ? 'Data as of ' + new Date(body.exportedAt).toLocaleString()
            : '';
        meta.textContent = asOf;
        tickersMeta.textContent = asOf;
    } catch (e) {
        meta.textContent = '⚠ Could not load plans data: ' + e.message;
        tickersMeta.textContent = '⚠ Could not load ticker data: ' + e.message;
        document.getElementById('plans-results').innerHTML =
            '<div class="ke-empty">Data isn\'t available yet — check back soon.</div>';
    }
}

/** Jump to the Options tab, filtered down to a single ticker's active plans. */
function showPlansForTicker(ticker) {
    plansTickerQuery = ticker;
    const input = document.getElementById('plans-ticker-filter');
    if (input) input.value = ticker;
    switchTab('plans');
    renderPlansTable(allPlans);
}

let allBadges = [];
let universeCountTotal = null;
let tickersQuery = '';

/** Re-filters the already-fetched universe badges by tickersQuery and
 *  re-renders — no refetch, this is a pure client-side view filter. */
function applyTickersFilter() {
    const q = tickersQuery.trim().toUpperCase();
    const filtered = q ? allBadges.filter(b => b.ticker.toUpperCase().includes(q)) : allBadges;
    renderUniverseBadges(filtered, q);
}

function renderUniverseBadges(badges, query) {
    const wrap = document.getElementById('universe-badges');
    const title = document.getElementById('universe-title');
    if (!allBadges.length) { wrap.innerHTML = ''; title.textContent = ''; return; }
    const total = universeCountTotal != null ? universeCountTotal : allBadges.length;
    title.textContent = query
        ? '📡 Kaching Universe — ' + badges.length + ' of ' + total + ' tickers match "' + escapeHtml(query) + '"'
        : '📡 Kaching Universe — ' + total + ' tickers';
    wrap.innerHTML = badges.length
        ? badges.map(badgeHtml).join('')
        : '<div class="ke-empty">No tickers match "' + escapeHtml(query) + '".</div>';
}

function badgeHtml(b) {
    const biasCls = b.smcBias == null ? 'no-data'
        : (b.smcBias === 'BULLISH' ? 'bull' : (b.smcBias === 'BEARISH' ? 'bear' : 'neutral'));

    let moveHtml = '';
    if (b.monthChangePct != null) {
        const m = b.monthChangePct;
        const cls = m >= 2 ? 'up' : (m <= -2 ? 'down' : 'flat');
        const arrow = m >= 2 ? '↑ ' : (m <= -2 ? '↓ ' : '↔ ');
        moveHtml = '<span class="uni-move ' + cls + '" title="1-month price change">' +
            arrow + m.toFixed(1) + '%</span>';
    }

    let scoreHtml = '';
    if (b.strategyScore != null) {
        const cls = b.strategyScore >= 70 ? 's-high' : (b.strategyScore >= 50 ? 's-mid' : 's-low');
        scoreHtml = '<span class="uni-strat-score ' + cls + '" title="Latest Weekly Income Diagonal plan score">' +
            Math.round(b.strategyScore) + '</span>';
    }

    const suggestionHtml = '<span class="uni-suggestion ' + escapeHtml(b.suggestionClass || 'noscan') +
        '" title="' + escapeHtml(b.suggestionTooltip || '') + '">' + escapeHtml(b.suggestion || '—') + '</span>';

    let row2 = '';
    if (b.smcBias != null) {
        let scoreBadge = '';
        if (b.score != null) {
            const cls = b.score >= 8 ? 'high' : (b.score >= 6 ? 'mid' : '');
            scoreBadge = '<span class="uni-score ' + cls + '" title="Screener score">' + b.score + '</span>';
        }
        row2 += '<div class="uni-row2">' +
            '<span class="uni-bias ' + escapeHtml(b.smcBias) + '">' + escapeHtml(b.smcBias) + '</span>' +
            (b.price != null ? '<span>$' + b.price.toFixed(2) + '</span>' : '') +
            (b.rrRatio != null && b.rrRatio > 0 ? '<span>' + b.rrRatio.toFixed(1) + 'R</span>' : '') +
            scoreBadge +
            '</div>';

        const tags = [];
        if (b.inFvgZone) tags.push('<span class="uni-tag fvg" title="Price in FVG zone">FVG</span>');
        if (b.bosDetected) tags.push('<span class="uni-tag bos" title="Break of Structure detected">BOS</span>');
        if (b.chochDetected) tags.push('<span class="uni-tag choch" title="Change of Character detected">CHoCH</span>');
        if (b.highConviction) tags.push('<span class="uni-tag fire" title="High-conviction setup">🔥</span>');
        if (tags.length) row2 += '<div class="uni-row2" style="margin-top:3px">' + tags.join('') + '</div>';
    } else {
        row2 = '<div class="uni-row2" style="margin-top:3px"><span class="uni-no-screener">no screener data yet</span></div>';
    }

    return '<div class="uni-badge ' + biasCls + '" title="' + escapeHtml(b.notes || b.ticker) + '">' +
        '<div class="uni-row1">' +
            '<span class="uni-ticker">' + escapeHtml(b.ticker) + '</span>' +
            moveHtml + scoreHtml +
            '<span class="uni-spacer"></span>' +
            suggestionHtml +
        '</div>' +
        row2 +
        '</div>';
}

function renderPlansTable(allPlansForTab) {
    const wrap = document.getElementById('plans-results');
    const title = document.getElementById('plans-title');

    const q = plansTickerQuery.trim().toUpperCase();
    const plans = q ? allPlansForTab.filter(p => p.ticker.toUpperCase().includes(q)) : allPlansForTab;

    title.textContent = q
        ? '📊 Active Options Plays — ' + plans.length + ' matching "' + plansTickerQuery.trim() + '"'
        : '📊 Active Options Plays — ' + plans.length + ' candidates';

    if (!plans.length) {
        wrap.innerHTML = '<div class="ke-empty">' +
            (q ? 'No active plans match "' + escapeHtml(plansTickerQuery.trim()) + '".'
               : 'No active plans right now — check back soon.') +
            '</div>';
        return;
    }

    // Group by ticker, same as the source Options Plays page — a
    // ticker can have more than one active plan at once.
    const byTicker = {};
    for (const p of plans) (byTicker[p.ticker] = byTicker[p.ticker] || []).push(p);
    let html = '';
    for (const ticker of Object.keys(byTicker)) html += renderTickerCard(ticker, byTicker[ticker]);
    wrap.innerHTML = html;
}

// ── Ticker/plan cards ────────────────────────────────────────────────
// Ported from prealerts' options.html (renderTickerCard/renderPlanCard) so
// the Options tab has the exact same look and feel as the real Options
// Plays page: full legs, net debit/credit, max profit/loss, break-even,
// ROR, IV rank, net Greeks, and the "Why" reasoning line. Read-only here:
// no "Track in KaChing" button (that's an admin-only write action).

const STRATEGY_NAMES = {
    WEEKLY_INCOME_DIAGONAL: 'KaChing Spread',
    DIAGONAL: 'Diagonal (PMCC)',
    CASH_SECURED_PUT: 'Cash-Secured Put',
    COVERED_CALL: 'Covered Call'
};

/** Format YYYYMMDD → "2027-Jan-15" (matches options.html's fmtExp) */
function fmtExp(exp) {
    if (!exp || exp.length < 8) return exp || '';
    const y = exp.substring(0, 4);
    const m = parseInt(exp.substring(4, 6), 10);
    const d = exp.substring(6, 8);
    return `${y}-${EXP_MONTHS[m - 1] || m}-${d}`;
}

function renderTickerCard(ticker, plans) {
    const first = plans[0];
    const dirColor = first.direction === 'BUY'   ? '#34d399'
        : first.direction === 'SHORT' ? '#f87171'
            : '#94a3b8';
    const price = first.underlyingPrice ? '$' + first.underlyingPrice.toFixed(2) : '—';

    let body = '';
    plans.forEach((p, i) => { body += renderPlanCard(p, i + 1); });

    return `<div style="background:var(--surface);border:1px solid var(--border);
                        border-radius:var(--r);padding:18px 20px;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    gap:24px;margin-bottom:14px;padding-bottom:12px;
                    border-bottom:1px solid var(--border)">
            <div>
                <span style="font-size:20px;font-weight:900;color:var(--text);
                             font-family:var(--font-mono);letter-spacing:1px">${escapeHtml(ticker)}</span>
                ${first.direction ? `<span style="font-size:11px;color:${dirColor};font-weight:700;
                             margin-left:12px;font-family:var(--font-mono);
                             padding:2px 8px;background:${dirColor}22;
                             border-radius:var(--r)">${escapeHtml(first.direction)}</span>` : ''}
            </div>
            <div style="font-size:18px;font-weight:700;color:var(--text);
                        font-family:var(--font-mono)">${price}</div>
        </div>
        ${body}
    </div>`;
}

/** Plain-language label + explanation for the long (insurance) leg's
 *  expiration bucket — the raw enum (EXTENDED/STANDARD/NEAR/...) means
 *  nothing to a site visitor on its own. */
function expirationWindowInfo(w) {
    if (!w) return null;
    const label = w.charAt(0) + w.slice(1).toLowerCase();
    const tooltips = {
        EXTENDED: 'The long (insurance) leg is dated further out than usual, so it needs replacing less often.',
        STANDARD: 'The long (insurance) leg uses this strategy\'s typical expiration window.',
        NEAR: 'The long (insurance) leg is dated closer than usual, so it will need replacing sooner.'
    };
    return { label, tooltip: tooltips[w] || 'How far out this plan\'s long (insurance) leg is dated.' };
}

function renderPlanCard(p, rank) {
    const score = p.strategyScore || 0;
    const scoreColor = score >= 80 ? '#34d399'
        : score >= 70 ? '#fbbf24'
            : '#94a3b8';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    const windowInfo = expirationWindowInfo(p.expirationWindow);

    let legs = '';
    for (let i = 1; i <= 4; i++) {
        const action  = p['leg' + i + 'Action'];
        const right   = p['leg' + i + 'Right'];
        const strike  = p['leg' + i + 'Strike'];
        const exp     = p['leg' + i + 'Expiration'];
        const premium = p['leg' + i + 'Premium'];
        if (!action) continue;
        const arrow  = action === 'BUY' ? '▲' : '▼';
        const aColor = action === 'BUY' ? '#34d399' : '#f87171';
        const rightFull = right === 'P' ? 'PUT' : right === 'C' ? 'CALL' : (right || '');
        legs += `<div>
            <span style="color:${aColor};font-weight:700">${arrow} ${action}</span>
            ${rightFull}
            <span style="color:var(--text);font-weight:700">$${strike != null ? strike.toFixed(0) : '?'}</span>
            <span style="color:var(--muted)">${fmtExp(exp)}
            ${premium != null ? ' @ $' + premium.toFixed(2) : ''}</span>
        </div>`;
    }

    const metrics = [];
    if (p.netDebitCredit != null) {
        const dcLabel = p.netDebitCredit >= 0 ? 'Net debit' : 'Net credit';
        const dcColor = p.netDebitCredit >= 0 ? '#f87171' : '#34d399';
        metrics.push(detailMetric(dcLabel, '$' + Math.abs(p.netDebitCredit).toFixed(2), dcColor));
    }
    if (p.maxProfit != null) metrics.push(detailMetric('Max profit', '$' + p.maxProfit.toFixed(0), '#34d399'));
    if (p.maxLoss != null)   metrics.push(detailMetric('Max loss', '$' + p.maxLoss.toFixed(0), '#f87171'));
    if (p.breakEven != null) metrics.push(detailMetric('Break-even', '$' + p.breakEven.toFixed(2), '#94a3b8'));
    if (p.breakEvenLow != null && p.breakEvenHigh != null) {
        metrics.push(detailMetric('BE range',
            '$' + p.breakEvenLow.toFixed(0) + '-$' + p.breakEvenHigh.toFixed(0), '#94a3b8'));
    }
    if (p.returnOnRisk != null) metrics.push(detailMetric('ROR', p.returnOnRisk.toFixed(0) + '%', '#60a5fa'));
    if (p.ivRank != null) {
        const ivColor = p.ivRank >= 60 ? '#f87171' : p.ivRank <= 30 ? '#34d399' : '#fbbf24';
        metrics.push(detailMetric('IV rank', p.ivRank.toFixed(0) + ' (' + (p.ivRegime || '?') + ')', ivColor));
    }
    if (p.netDelta != null) metrics.push(detailMetric('Net Δ', p.netDelta.toFixed(3), '#60a5fa'));
    if (p.netTheta != null) metrics.push(detailMetric('Net Θ', p.netTheta.toFixed(2), '#a78bfa'));

    return `<div style="background:var(--bg);border-radius:var(--r);
                        border-left:3px solid ${scoreColor};
                        padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    gap:16px;margin-bottom:10px">
            <div style="font-size:13px;font-weight:700;color:var(--text);
                        font-family:var(--font-mono)">
                ${medal} ${STRATEGY_NAMES[p.strategy] || p.strategy || 'KaChing Spread'}
                <span style="color:var(--muted);font-weight:400;font-size:10px;
                             margin-left:6px">
                    ${windowInfo ? `<span title="${escapeHtml(windowInfo.tooltip)}"
                        style="border-bottom:1px dotted var(--muted);cursor:help">${escapeHtml(windowInfo.label)}</span> · ` : ''}${p.daysToExpire != null ? p.daysToExpire : '?'}d
                </span>
            </div>
            <div style="font-family:var(--font-mono);font-size:14px;
                        font-weight:700;color:${scoreColor}" title="Trade quality score for this specific plan, out of 100.">
                <span style="color:var(--muted);font-weight:400;font-size:9px;
                             text-transform:uppercase;letter-spacing:0.05em;
                             margin-right:5px">Strategy Score</span>${score.toFixed(1)}/100
            </div>
        </div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text);
                    line-height:1.7;margin-bottom:10px">${legs}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
                    gap:12px;font-family:var(--font-mono);font-size:11px;
                    padding:10px 0;border-top:1px solid var(--border);
                    border-bottom:1px solid var(--border);margin-bottom:10px">
            ${metrics.join('')}
        </div>
        ${p.reasoning ? renderWhyBox(p.reasoning) : ''}
    </div>`;
}

/** The "why" reasoning is the one place a visitor can see the actual case
 *  for a plan, so it gets its own callout instead of a muted throwaway
 *  line — narrative up top, the trailing technical setup readout (SMA/RSI
 *  etc., appended after " | Setup: ") broken out as scannable chips. */
function renderWhyBox(reasoning) {
    const sepIdx = reasoning.indexOf(' | Setup: ');
    const main = sepIdx === -1 ? reasoning : reasoning.slice(0, sepIdx);
    const setup = sepIdx === -1 ? '' : reasoning.slice(sepIdx + ' | Setup: '.length);
    const setupChips = setup
        ? setup.split(' · ').map(s => `<span style="display:inline-block;
              background:var(--bg2);border:1px solid var(--border);border-radius:6px;
              padding:2px 8px;margin:4px 6px 0 0;font-family:var(--font-mono);
              font-size:10px;color:var(--muted2)">${escapeHtml(s.trim())}</span>`).join('')
        : '';
    return `<div style="background:rgba(96,165,250,.06);border:1px solid rgba(96,165,250,.2);
                border-radius:var(--r);padding:12px 14px;margin-top:2px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;
                    font-size:11px;font-weight:700;color:#60a5fa">
            <span>💡</span><span>Why this setup</span>
        </div>
        <div style="font-size:12px;color:var(--text);line-height:1.6">${escapeHtml(main.trim())}</div>
        ${setupChips ? `<div style="margin-top:2px">${setupChips}</div>` : ''}
    </div>`;
}

function detailMetric(label, value, color) {
    return `<div>
        <div style="color:var(--muted);font-size:9px;text-transform:uppercase;
                    letter-spacing:1px;margin-bottom:2px">${label}</div>
        <div style="color:${color};font-weight:700;font-size:12px">${value}</div>
    </div>`;
}

// ── Shared formatting helpers ──────────────────────────────────────────

const EXP_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtPrice(d) {
    if (d === null || d === undefined) return '—';
    return '$' + d.toFixed(2);
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
        c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
