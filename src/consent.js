/* Cookie consent banner for Google Analytics (Consent Mode) — shared by
 * index.html and help.html. Each page sets GA4's default consent state
 * inline in <head>, before gtag.js loads (denied in the EEA/UK/CH, granted
 * elsewhere); this file remembers a visitor's explicit choice, and for
 * first-time visitors, geo-checks whether a consent prompt is even needed.
 */
(function () {
    var STORAGE_KEY = 'kaching-cookie-consent';

    // ISO 3166-1 alpha-2 codes for the EEA + UK + Switzerland — the
    // jurisdictions where GDPR / UK-GDPR / revFADP require opt-in consent
    // before non-essential analytics cookies are set. Must match the
    // 'region' list in each page's gtag('consent','default',...) call.
    var REGULATED_COUNTRIES = [
        'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
        'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
        'IS','LI','NO', // EEA (non-EU)
        'GB', // UK
        'CH'  // Switzerland
    ];

    // Free, no-API-key country lookup. If it's unreachable or blocked, we
    // fail safe (show the banner) rather than assume the visitor is outside
    // a regulated region.
    var GEO_LOOKUP_URL = 'https://ipapi.co/country/';

    function applyStoredConsent() {
        var stored = null;
        try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode etc. */ }
        if (stored === 'granted' && window.gtag) {
            gtag('consent', 'update', { analytics_storage: 'granted' });
        }
        return stored;
    }

    function grantSilently() {
        if (window.gtag) gtag('consent', 'update', { analytics_storage: 'granted' });
        try { localStorage.setItem(STORAGE_KEY, 'granted'); } catch (e) {}
    }

    function showBanner() {
        var banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.innerHTML =
            '<span>This site uses Google Analytics to understand traffic. ' +
            'No ads, nothing sold — just page-view counts.</span>' +
            '<span class="cc-actions">' +
                '<button type="button" id="cc-decline">Decline</button>' +
                '<button type="button" id="cc-accept">Accept</button>' +
            '</span>';
        document.body.appendChild(banner);

        document.getElementById('cc-accept').addEventListener('click', function () {
            try { localStorage.setItem(STORAGE_KEY, 'granted'); } catch (e) {}
            if (window.gtag) gtag('consent', 'update', { analytics_storage: 'granted' });
            banner.remove();
        });
        document.getElementById('cc-decline').addEventListener('click', function () {
            try { localStorage.setItem(STORAGE_KEY, 'denied'); } catch (e) {}
            banner.remove();
        });
    }

    /** Visitors outside the EEA/UK/CH don't legally need a consent prompt —
     *  look up their country and grant analytics immediately if they're
     *  elsewhere, otherwise fall through to the banner. Any failure (network,
     *  ad blocker, rate limit) fails safe by showing the banner. */
    function checkRegionAndDecide() {
        fetch(GEO_LOOKUP_URL)
            .then(function (res) { if (!res.ok) throw new Error('geo lookup failed'); return res.text(); })
            .then(function (country) {
                country = country.trim().toUpperCase();
                if (REGULATED_COUNTRIES.indexOf(country) === -1) {
                    grantSilently();
                } else {
                    showBanner();
                }
            })
            .catch(showBanner);
    }

    document.addEventListener('DOMContentLoaded', function () {
        var stored = applyStoredConsent();
        if (stored == null) checkRegionAndDecide();
    });
})();
