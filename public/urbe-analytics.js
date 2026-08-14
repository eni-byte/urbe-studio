/* ── URBE Analytics (pages statiques : blog, guides, pages satellites) ──
   Le SPA React a son propre chargement GA4 ; ce fichier couvre les ~40 pages
   HTML statiques qui n'avaient AUCUN tracking (trafic SEO invisible dans GA4).
   - Consent Mode v2 : etat par defaut "refuse" pose avant tout chargement.
   - Consentement PARTAGE avec le site principal via localStorage
     (urbe_cookie_consent, meme origine) : un choix fait n'importe ou vaut partout.
   - Sans choix enregistre : mini-bandeau (memes libelles que le site).
   - GA4 charge uniquement apres consentement "all". IP anonymisee.
   - Bonus : clics tel / WhatsApp / mailto -> event contact_click (aligne SPA). */
(function () {
  var GA4_ID = 'G-4L618KBREM';
  var ADS_ID = 'AW-18388549810';
  var KEY = 'urbe_cookie_consent';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied',
    ad_personalization: 'denied', analytics_storage: 'denied',
    wait_for_update: 500
  });

  function readConsent() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function saveConsent(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  var loaded = false;
  function loadGA4() {
    if (loaded) return;
    loaded = true;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA4_ID, { anonymize_ip: true });
    gtag('config', ADS_ID);
  }

  /* Clics de contact -> meme evenement que sur le site principal. */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('tel:') === 0) gtag('event', 'contact_click', { method: 'phone' });
    else if (h.indexOf('wa.me') !== -1 || h.indexOf('whatsapp') !== -1) gtag('event', 'contact_click', { method: 'whatsapp' });
    else if (h.indexOf('mailto:') === 0) gtag('event', 'contact_click', { method: 'email' });
  });

  function showBanner() {
    var host = document.createElement('div');
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-label', 'Consentement aux cookies');
    host.style.cssText = 'position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:9998;max-width:720px;margin:0 auto;background:rgba(14,14,14,0.97);border:1px solid rgba(241,236,231,0.14);border-radius:16px;padding:18px 20px;box-shadow:0 24px 70px rgba(0,0,0,0.6);display:flex;gap:16px;align-items:center;flex-wrap:wrap;font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#f1ece7';
    host.innerHTML =
      '<div style="flex:1 1 260px;min-width:220px">' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:4px">Cookies &amp; mesure d’audience</div>' +
      '<div style="font-size:13px;color:rgba(241,236,231,0.55);font-weight:300;line-height:1.6">Nous mesurons anonymement la fréquentation du site (Google Analytics). Vous pouvez refuser. <a href="/confidentialite" style="color:#c12c2c">En savoir plus</a></div></div>' +
      '<div style="display:flex;gap:10px;flex-shrink:0">' +
      '<button data-c="essential" style="background:none;color:#f1ece7;border:1px solid rgba(241,236,231,0.14);padding:11px 20px;border-radius:100px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Refuser</button>' +
      '<button data-c="all" style="background:#8B1E1E;color:#fff;border:none;padding:11px 22px;border-radius:100px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 8px 24px rgba(139,30,30,0.4)">Tout accepter</button></div>';
    host.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-c]') : null;
      if (!b) return;
      var v = b.getAttribute('data-c');
      saveConsent(v);
      if (v === 'all') loadGA4();
      host.remove();
    });
    document.body.appendChild(host);
  }

  function init() {
    var c = readConsent();
    if (c === 'all') loadGA4();
    else if (c === null) showBanner();
    /* c === 'essential' (refus) : rien a charger, pas de bandeau. */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
