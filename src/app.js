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

// ⚠️ TEMPORARY — pointed at the local .sample.json fixtures for
// pre-deployment visual preview (no real S3 bucket/export exists yet).
// Swap back to the real filenames (kaching-scanner.json / kaching-plans.json,
// no ".sample") before actually deploying this site.
const DATA = {
    scanner: './data/kaching-scanner.sample.json',
    plans:   './data/kaching-plans.sample.json'
};

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadScanner();
    loadPlans();
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

async function loadScanner() {
    const meta = document.getElementById('scanner-meta');
    try {
        const res = await fetch(DATA.scanner, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const body = await res.json();
        const scanAt = body.data && body.data.scanAt;
        const candidates = (body.data && body.data.candidates) || [];
        renderEarningsBanner(candidates);
        renderScannerTable(candidates);
        meta.textContent = scanAt
            ? 'Scan from ' + new Date(scanAt).toLocaleString() + '  ·  ' + candidates.length + ' tickers'
            : candidates.length + ' tickers';
    } catch (e) {
        meta.textContent = '⚠ Could not load scanner data: ' + e.message;
        document.getElementById('scanner-results').innerHTML =
            '<div class="ke-empty">Data isn\'t available yet — check back soon.</div>';
    }
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

function renderScannerTable(candidates) {
    const wrap = document.getElementById('scanner-results');
    if (!candidates.length) {
        wrap.innerHTML = '<div class="ke-empty">No scan data yet — check back soon.</div>';
        return;
    }
    const sorted = candidates.slice().sort((a, b) => b.totalScore - a.totalScore);
    wrap.innerHTML =
        '<div class="ke-table-wrap"><table class="ke-table"><thead><tr>' +
        '<th>Ticker</th><th>Score</th><th>Signal</th><th>Price</th>' +
        '<th>Laggard</th><th>RSI</th><th>MACD</th><th>Trend</th>' +
        '<th>RS vs SPY</th><th>IV Rank</th><th>Liquidity</th>' +
        '<th title="Days to next earnings — sector ETFs have none">Earnings</th>' +
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

async function loadPlans() {
    const meta = document.getElementById('plans-meta');
    try {
        const res = await fetch(DATA.plans, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const body = await res.json();
        const data = body.data || {};
        const badges = data.universeBadges || [];
        const plans  = data.diagonalPlans || [];
        renderUniverseBadges(badges, data.universeCount);
        renderPlansTable(plans);
        meta.textContent = body.exportedAt
            ? 'Data as of ' + new Date(body.exportedAt).toLocaleString()
            : '';
    } catch (e) {
        meta.textContent = '⚠ Could not load plans data: ' + e.message;
        document.getElementById('plans-results').innerHTML =
            '<div class="ke-empty">Data isn\'t available yet — check back soon.</div>';
    }
}

function renderUniverseBadges(badges, universeCount) {
    const wrap = document.getElementById('universe-badges');
    const title = document.getElementById('universe-title');
    if (!badges.length) { wrap.innerHTML = ''; title.textContent = ''; return; }
    title.textContent = '📡 Kaching Universe — ' + (universeCount != null ? universeCount : badges.length) + ' tickers';
    wrap.innerHTML = badges.map(badgeHtml).join('');
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

function renderPlansTable(plans) {
    const wrap = document.getElementById('plans-results');
    const title = document.getElementById('plans-title');
    if (!plans.length) {
        title.textContent = '📐 Active Diagonal Weekly Plans — 0 candidates';
        wrap.innerHTML = '<div class="ke-empty">No active plans right now — check back soon.</div>';
        return;
    }
    title.textContent = '📐 Active Diagonal Weekly Plans — ' + plans.length + ' candidates';
    wrap.innerHTML =
        '<div class="plans-table-wrap"><table class="plans-table"><thead><tr>' +
        '<th>Ticker</th><th>Score</th><th>Long Put (insurance)</th><th>Short Put (income)</th>' +
        '<th style="text-align:right">Net Debit</th><th style="text-align:right">Max P/L</th>' +
        '<th style="text-align:right">B/E</th><th style="text-align:right">R:R</th><th>Generated</th>' +
        '</tr></thead><tbody>' +
        plans.map(planRowHtml).join('') +
        '</tbody></table></div>';
}

function planRowHtml(p) {
    let scoreHtml = '—';
    if (p.strategyScore != null) {
        const cls = p.strategyScore >= 80 ? 'high' : (p.strategyScore >= 60 ? 'mid' : 'low');
        scoreHtml = '<span class="score-pill ' + cls + '" title="' + escapeHtml(p.reasoning || '') + '">' +
            Math.round(p.strategyScore) + '</span>';
    }

    const longLeg = legHtml('BUY', p.leg1Strike, p.leg1Expiration, p.leg1Premium, p.leg1Delta);
    const shortLeg = legHtml('SELL', p.leg2Strike, p.leg2Expiration, p.leg2Premium, p.leg2Delta);

    const netDebit = p.netDebitCredit != null ? '$' + p.netDebitCredit.toFixed(2) : '—';
    let maxPL = '';
    if (p.maxProfit != null) maxPL += '<div class="num profit">+$' + Math.round(p.maxProfit) + '</div>';
    if (p.maxLoss != null)   maxPL += '<div class="num loss">-$' + Math.round(p.maxLoss) + '</div>';
    const breakEven = p.breakEven != null ? '$' + p.breakEven.toFixed(2) : '—';

    let rr = '—', rrCls = 'muted';
    if (p.maxLoss != null && p.maxLoss > 0 && p.maxProfit != null) {
        const ratio = p.maxProfit / p.maxLoss;
        rr = ratio.toFixed(1) + 'x';
        rrCls = ratio >= 3 ? 'profit' : (ratio >= 2 ? '' : 'muted');
    }

    const generated = p.createdAt ? fmtDateShort(p.createdAt) : '—';

    return '<tr>' +
        '<td class="plan-ticker">' + escapeHtml(p.ticker) + '</td>' +
        '<td>' + scoreHtml + '</td>' +
        '<td class="leg">' + longLeg + '</td>' +
        '<td class="leg">' + shortLeg + '</td>' +
        '<td style="text-align:right" class="num">' + netDebit + '</td>' +
        '<td style="text-align:right">' + maxPL + '</td>' +
        '<td style="text-align:right" class="num muted">' + breakEven + '</td>' +
        '<td style="text-align:right" class="num ' + rrCls + '">' + rr + '</td>' +
        '<td class="num muted">' + generated + '</td>' +
        '</tr>';
}

function legHtml(action, strike, expiration, premium, delta) {
    if (strike == null) return '';
    let html = '<div><span class="label">' + action + '</span> $' + Math.round(strike) +
        ' <span class="num muted">· ' + fmtExpiration(expiration) + '</span>';
    if (premium != null) html += ' <span class="num muted">· $' + premium.toFixed(2) + '</span>';
    html += '</div>';
    if (delta != null) {
        html += '<div class="num muted" style="font-size:9px;padding-left:34px">Δ ' + delta.toFixed(2) + '</div>';
    }
    return html;
}

// ── Shared formatting helpers ──────────────────────────────────────────

const EXP_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "20270115" -> "2027 Jan 15" (matches DateTimeUtils.formatOptionsExpiration) */
function fmtExpiration(yyyymmdd) {
    if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd || '—';
    const y = yyyymmdd.substring(0, 4);
    const m = parseInt(yyyymmdd.substring(4, 6), 10) - 1;
    const d = yyyymmdd.substring(6, 8);
    return y + ' ' + (EXP_MONTHS[m] || m) + ' ' + d;
}

function fmtDateShort(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return (d.getMonth() + 1).toString().padStart(2, '0') + '/' +
        d.getDate().toString().padStart(2, '0') + ' ' +
        d.getHours().toString().padStart(2, '0') + ':' +
        d.getMinutes().toString().padStart(2, '0');
}

function fmtPrice(d) {
    if (d === null || d === undefined) return '—';
    return '$' + d.toFixed(2);
}

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
        c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
