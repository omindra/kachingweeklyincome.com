/* Cookie consent banner for Google Analytics (Consent Mode) — shared by
 * index.html and help.html. Each page sets GA4's default consent state
 * (analytics_storage: 'denied') inline in <head>, before gtag.js loads;
 * this file only remembers the visitor's choice and updates that state
 * once they respond.
 */
(function () {
    var STORAGE_KEY = 'kaching-cookie-consent';

    function applyStoredConsent() {
        var stored = null;
        try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode etc. */ }
        if (stored === 'granted' && window.gtag) {
            gtag('consent', 'update', { analytics_storage: 'granted' });
        }
        return stored;
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

    document.addEventListener('DOMContentLoaded', function () {
        var stored = applyStoredConsent();
        if (stored == null) showBanner();
    });
})();
