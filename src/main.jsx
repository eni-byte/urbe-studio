import React from 'react';
import ReactDOM from 'react-dom/client';













const { useState, useEffect, useRef } = React;

/* ═══════════════════════════════════════════════════════════════
   CONFIG — À REMPLIR AVEC VOS VRAIES DONNÉES
   ═══════════════════════════════════════════════════════════════
   1) STRIPE : créez des "Payment Links" sur dashboard.stripe.com
      (Produits → Lien de paiement) puis collez les URLs ci-dessous.
      Pas besoin de serveur — chaque lien gère le paiement.
   2) GOOGLE CALENDAR : créez (ou utilisez) un calendrier dédié,
      rendez-le public, copiez son "Calendar ID" + URL d'embed.
   3) Mettez `paymentMode: 'live'` quand les liens Stripe sont prêts.
   ═══════════════════════════════════════════════════════════════ */
/* Clé partagée site↔n8n : barrière contre les appels externes / spam des webhooks.
   (Visible côté client, donc 1ʳᵉ barrière — Cloudflare Turnstile recommandé en complément.) */
const URBE_WEBHOOK_KEY = 'urbe_web_9Kx7mQp2Lr4Tv';
const URBE_CONFIG = {
  gcal: {
    calendarId: 'urbestudio.contact@gmail.com',
    /* Calendrier studio « Agendas session ». Pour que l'aperçu soit visible par
       les visiteurs, ce calendrier doit être rendu PUBLIC dans les paramètres
       Google Agenda (Paramètres → Autorisations d'accès → « Rendre disponible publiquement »). */
    embedSrc: 'https://calendar.google.com/calendar/embed?src=urbestudio.contact%40gmail.com&ctz=Europe%2FParis',
    bookingUrl: '',
    location: "37 Rue d'Hauteville, 75010 Paris",
    timezone: 'Europe/Paris',
  },
  stripe: {
    // Sessions horaires (par heure de studio)
    'session-avec':       'https://buy.stripe.com/dRm9AMaRKdS5dEq09Ydby00',
    'session-sans':       'https://buy.stripe.com/5kQ28k8JC6pD9oa8Gudby01',
    'session-nuit':       'https://buy.stripe.com/00wcMY7Fy9BP43Q4qedby02',
    'rec-1h':             'https://buy.stripe.com/cNi7sEbVO4hvase6ymdby0d',
    // Mix & Mastering
    'mix-standard':       'https://buy.stripe.com/fZu5kwf80dS5gQC3madby03',
    'mix-urgent':         'https://buy.stripe.com/dRm14g4tm9BP2ZMcWKdby04',
    'mastering':          'https://buy.stripe.com/eVqdR2f803drcAmaOCdby05',
    // Packs studio
    'pack-rec-mix-mast':  'https://buy.stripe.com/8x2eV67Fyg0d8k6e0Odby06',
    'pack-compo-full':    'https://buy.stripe.com/7sY5kw8JCg0dfMye0Odby07',
    // Forfaits pré-payés
    'forfait-10h':        'https://buy.stripe.com/6oU28kaRK7tH8k65uidby08',
    'forfait-20h':        'https://buy.stripe.com/7sY28k1hacO19oa09Ydby09',
    'forfait-50h':        'https://buy.stripe.com/6oU7sE7FycO1bwi7Cqdby0a',
    // Add-ons communication
    'pack-com-1':         'https://buy.stripe.com/8x24gs1ha6pD9oa3madby0b',
    'pack-com-3':         'https://buy.stripe.com/00w00caRK7tHase6ymdby0c',
    // Instrumentals
    'instru-lease':       'https://buy.stripe.com/5kQdR23pieW943QbSGdby0e',
  },
  paymentMode: 'live', /* 'mock' = overlay démo · 'live' = redirige vers Stripe */
  /* ANALYTICS — collez votre ID de mesure GA4 (G-XXXXXXXXXX).
     Vide = désactivé. Chargé UNIQUEMENT après acceptation du bandeau cookies (RGPD). */
  analytics: { gtmId: '', ga4Id: 'G-4L618KBREM' },
  /* Webhook n8n « Lead Site Web → CRM » : reçoit les leads (formulaire/réservation),
     crée le contact + l'opportunité dans HubSpot. Vide = capture CRM désactivée. */
  leadWebhook: 'https://mpoi.app.n8n.cloud/webhook/urbe-lead-site',
  /* Webhook n8n « Agent Chat Réservation » : agent IA conversationnel du site.
     Vide = widget de chat masqué. */
  chatWebhook: 'https://mpoi.app.n8n.cloud/webhook/urbe-chat',
  /* Webhook n8n « Créneaux disponibles » : renvoie les heures occupées par date
     (lues sur Google Calendar) pour n'afficher que les créneaux libres. */
  slotsWebhook: 'https://mpoi.app.n8n.cloud/webhook/urbe-slots',
  /* Webhook n8n « Réservation site → Agenda » : crée l'événement dans le Google
     Agenda du studio (marqué [SITE]) à chaque réservation datée. */
  bookingWebhook: 'https://mpoi.app.n8n.cloud/webhook/urbe-booking',
  /* Webhook n8n « Créer session Stripe » : génère une session de paiement au bon
     montant (durée incluse) et renvoie l'URL Checkout. */
  sessionWebhook: 'https://mpoi.app.n8n.cloud/webhook/urbe-create-session',
};

/* ─── UTILS ──────────────────────────────────────────────────── */
const px = (n) => `${n}px`;
/* Resolve a code-referenced asset to its inlined blob URL when bundled standalone,
   otherwise fall back to the original relative path (normal/dev mode). */
const R = (path) => (window.__resources && window.__resources[path]) || path;
/* Accessibilité : rend un <div> cliquable utilisable au clavier (Enter / Espace). */
const cardKeys = (fn) => ({ role: 'button', tabIndex: 0, onKeyDown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fn(); } } });

/* ─── HELPERS · Google Calendar + Stripe + Mailto ────────────── */
/* Horodatage "mur" (wall-clock) en Europe/Paris — indépendant du fuseau du navigateur.
   On NE convertit PAS via Date/UTC (c'était la source du décalage d'1h selon la machine). */
function wallStamps(dateStr, timeStr, hours) {
  const pad = (n) => String(n).padStart(2, '0');
  const parts = String(timeStr || '00:00').split(':');
  const hh = parseInt(parts[0], 10) || 0;
  const mm = parseInt(parts[1], 10) || 0;
  const startTotal = hh * 60 + mm;
  const endTotal = startTotal + Math.round((Number(hours) || 1) * 60);
  const dayAdd = Math.floor(endTotal / 1440);
  const eh = Math.floor((endTotal % 1440) / 60);
  const em = (endTotal % 1440) % 60;
  let endDate = dateStr;
  if (dayAdd > 0) { const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + dayAdd); endDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  const fmt = (ds, h, m) => `${ds.replace(/-/g, '')}T${pad(h)}${pad(m)}00`;
  return { start: fmt(dateStr, hh, mm), end: fmt(endDate, eh, em) };
}
function buildGCalAddLink({ title, date, time, hours = 1, description = '', location }) {
  const { start, end } = wallStamps(date, time, hours);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    ctz: 'Europe/Paris',
    details: description,
    location: location || URBE_CONFIG.gcal.location,
  });
  return `https://www.google.com/calendar/render?${p.toString()}`;
}
function buildICSDataUrl({ title, date, time, hours = 1, description = '', location }) {
  const { start, end } = wallStamps(date, time, hours);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Urbe Studio//FR',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@urbestudio.fr`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Paris:${start}`,
    `DTEND;TZID=Europe/Paris:${end}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${(description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${location || URBE_CONFIG.gcal.location}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
function getStripeUrl(productKey) {
  return URBE_CONFIG.stripe[productKey] || null;
}
function redirectToStripe(productKey, summary) {
  const url = getStripeUrl(productKey);
  const isMock = URBE_CONFIG.paymentMode === 'mock' || !url || /REMPLACER/.test(url);
  if (isMock) {
    if (typeof window.__urbeShowStripeMock === 'function') {
      window.__urbeShowStripeMock({ productKey, url, summary });
    } else {
      alert(`[Démo] Redirection Stripe pour "${productKey}"\nMontant : ${summary?.total || '—'}€\n\nConfigurez URBE_CONFIG.stripe + paymentMode='live' pour activer.`);
    }
    return false;
  }
  // Transmet le créneau à Stripe (client_reference_id) → le webhook confirmera la résa après paiement.
  let finalUrl = url;
  if (summary && summary.date && summary.time) {
    const hhmm = String(summary.time).replace(':', '');
    const ref = `B~${summary.date}~${hhmm}~${summary.hours || 2}~${productKey}`;
    finalUrl += (url.indexOf('?') >= 0 ? '&' : '?') + 'client_reference_id=' + encodeURIComponent(ref);
  }
  window.open(finalUrl, '_blank', 'noopener,noreferrer');
  return true;
}
function mailtoBooking({ subject, body }) {
  window.location.href = `mailto:contact@urbestudio.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
/* Envoie un lead au webhook n8n → HubSpot (CRM). Non bloquant : n'empêche jamais
   l'utilisateur d'avoir sa confirmation, même si le réseau échoue. */
function postLead(data) {
  const url = URBE_CONFIG.leadWebhook;
  if (!url) return Promise.resolve(false);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Urbe-Key': URBE_WEBHOOK_KEY },
    body: JSON.stringify({ source: 'Site web Urbe', ...data }),
  }).then((r) => r.ok).catch(() => false);
}
window.postLead = postLead;
window.URBE_CONFIG = URBE_CONFIG;
window.buildGCalAddLink = buildGCalAddLink;
window.buildICSDataUrl = buildICSDataUrl;
window.redirectToStripe = redirectToStripe;

/* ─── LOGO ───────────────────────────────────────────────────── */
const Logo = ({ light = true }) =>
<div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
    <img src={R("studio/urbe-logo-c.png")} alt="Urbe Studio" style={{ height: 42, width: 'auto', display: 'block', filter: 'brightness(1.15) saturate(1.15)' }} />
  </div>;


/* ─── NAV ────────────────────────────────────────────────────── */
function Nav({ page, setPage }) {
  useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [page]);

  const links = [
  { label: 'Crédits', p: 'credits' },
  { label: 'Le Studio', p: 'studio' },
  { label: 'Contact', p: 'contact' }];

  const u = (typeof urbeAuth !== 'undefined') ? urbeAuth.getUser() : null;
  const go = (p) => { setMobileOpen(false); setPage(p); };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      height: 60,
      background: scrolled ? 'rgba(8,8,8,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
      borderBottom: scrolled ? '1px solid var(--br)' : '1px solid transparent',
      transition: 'all 0.35s cubic-bezier(.4,0,.2,1)',
      display: 'flex', alignItems: 'center', padding: '0 28px'
    }}>
      <button onClick={() => setPage('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 'auto' }}>
        <Logo />
      </button>
      <div className="urbe-nav-center" style={{ display: 'flex', gap: 4, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        {links.map((l) =>
        <button key={l.p} onClick={() => go(l.p)} style={{
          background: page === l.p ? 'var(--s2)' : 'none',
          border: 'none', cursor: 'pointer', padding: '6px 16px', borderRadius: 100,
          fontFamily: 'Plus Jakarta Sans', fontSize: 13.5, fontWeight: 500,
          color: page === l.p ? 'var(--blanc)' : 'var(--dim)',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--blanc)'}
        onMouseLeave={(e) => e.currentTarget.style.color = page === l.p ? 'var(--blanc)' : 'var(--dim)'}>
          {l.label}</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={() => go('booking')} style={{
          background: 'var(--rouge)', color: '#fff', border: 'none',
          padding: '8px 20px', borderRadius: 100, cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans', fontSize: 13, fontWeight: 700,
          boxShadow: '0 0 0 0 rgba(139,30,30,0)', transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {e.currentTarget.style.background = 'var(--rouge2)';e.currentTarget.style.transform = 'translateY(-1px)';}}
        onMouseLeave={(e) => {e.currentTarget.style.background = 'var(--rouge)';e.currentTarget.style.transform = 'none';}}>
          Réserver →</button>
        <button className="urbe-burger" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen} style={{
          width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
          background: 'none', border: '1px solid var(--br2)', borderRadius: 10, cursor: 'pointer', color: 'var(--blanc)', flexShrink: 0
        }}>
          {mobileOpen
            ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            : <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>}
        </button>
      </div>

      {/* Panneau mobile */}
      <div className="urbe-mobile-panel" style={{
        position: 'fixed', top: 60, left: 0, right: 0, zIndex: 199,
        background: 'rgba(8,8,8,0.98)', backdropFilter: 'blur(20px) saturate(1.2)',
        borderBottom: mobileOpen ? '1px solid var(--br)' : '1px solid transparent',
        overflow: 'hidden', maxHeight: mobileOpen ? 340 : 0,
        transition: 'max-height 0.35s cubic-bezier(.4,0,.2,1)'
      }}>
        <div style={{ padding: '12px 22px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {links.map((l) =>
            <button key={l.p} onClick={() => go(l.p)} style={{
              textAlign: 'left', background: page === l.p ? 'var(--s2)' : 'none', border: 'none', cursor: 'pointer',
              padding: '13px 14px', borderRadius: 10, fontFamily: 'Plus Jakarta Sans', fontSize: 15, fontWeight: 500,
              color: page === l.p ? 'var(--blanc)' : 'var(--dim)'
            }}>{l.label}</button>
          )}
        </div>
      </div>
    </nav>);

}

/* ─── FOOTER GLOBAL (audit NAV-02) ───────────────────────────── */
function SiteFooter({ setPage }) {
  return (
    <footer style={{ borderTop: '1px solid var(--br)', padding: '56px 28px 36px', background: 'var(--s1)', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="urbe-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 52 }}>
          <div>
            <Logo />
            <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.75, maxWidth: 220, marginTop: 20, fontWeight: 300 }}>Studio d'enregistrement d'exception à Paris, depuis 2024
.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rouge3)', boxShadow: '0 0 8px var(--rouge3)' }} />
              <span style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'var(--rouge3)', letterSpacing: '0.12em' }}>OUVERT 24H/24 · 7J/7</span>
            </div>
          </div>
          {[
          { titre: 'Studio', liens: [['Avec ingénieur', 'booking'], ['Sans ingénieur', 'booking'], ['Session de nuit', 'booking'], ['Tarifs', 'booking']] },
          { titre: 'Services', liens: [['Enregistrement', 'booking'], ['Mixage', 'booking'], ['Mastering', 'booking'], ['Production', 'booking']] },
          { titre: 'Urbe', liens: [['Crédits', 'credits'], ['Le Studio', 'studio'], ['Contact', 'contact'], ['Urbe School', 'school']] }].
          map((col) =>
          <div key={col.titre}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--blanc)', marginBottom: 18 }}>{col.titre}</div>
              {col.liens.map(([l, p]) =>
            <div key={l} onClick={() => setPage && setPage(p)} style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 10, cursor: 'pointer', fontWeight: 300, transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.target.style.color = 'var(--blanc)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--dim)'}>{l}</div>
            )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--br)', paddingTop: 28, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 300 }}>© 2026 Urbe Studio · 37 Rue d'Hauteville, Paris 10ème</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {[['Mentions légales', 'mentions'], ['Confidentialité', 'confidentialite'], ['CGV', 'cgv']].map(([l, p]) =>
            <span key={p} onClick={() => setPage && setPage(p)} style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 300, cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.target.style.color = 'var(--blanc)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--dim)'}>{l}</span>
            )}
          </div>
        </div>
      </div>
    </footer>);

}

/* ─── MIX EN LIGNE WIDGET ────────────────────────────────────── */
const MIX_ENGINEERS = [
{ id: 'vir', nom: 'Virgile', spe: 'Rap · Mix', initiales: 'VG', bg: '#8B1E1E' },
{ id: 'olid', nom: 'Olid', spe: 'Prise de son · DA', initiales: 'OL', bg: '#2a2a2a' },
{ id: 'chourak', nom: 'Chourak', spe: 'Pop · R&B', initiales: 'CH', bg: '#3a1d1d' },
{ id: 'bms', nom: 'BMS', spe: 'Compo · Prod', initiales: 'BM', bg: '#1f1f1f' }];


function MixWidget({ variant = 'floating' }) {
  const [sel, setSel] = useState(0);
  const [urgent, setUrgent] = useState(false);
  const e = MIX_ENGINEERS[sel];
  const prix = 120 + (urgent ? 50 : 0);
  const floating = variant === 'floating';
  const wrapStyle = floating ? {
    position: 'absolute', top: 130, right: 'clamp(20px,3vw,56px)', zIndex: 3,
    width: 300, maxWidth: 'calc(100vw - 40px)',
    background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(241,236,231,0.12)',
    borderRadius: 16, backdropFilter: 'blur(12px) saturate(1.1)',
    padding: '16px 18px 14px',
    boxShadow: '0 18px 50px rgba(0,0,0,0.45)'
  } : {
    background: 'var(--noir)', border: '1px solid rgba(241,236,231,0.1)',
    borderRadius: 16, padding: '22px 24px 20px',
    width: '100%', maxWidth: 380
  };
  return (
    <div className={floating ? 'urbe-hero-mix-widget' : 'urbe-mix-inline'} style={wrapStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rouge3)', boxShadow: '0 0 8px var(--rouge3)', animation: 'pulse 2s infinite' }} />
        <span style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '0.18em', color: 'rgba(241,236,231,0.55)', textTransform: 'uppercase' }}>Service en ligne</span>
      </div>

      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: floating ? 22 : 26, letterSpacing: '0.02em', color: 'var(--blanc)', lineHeight: 1, marginBottom: 12, textTransform: 'uppercase' }}>Mixage en ligne</div>

      {/* Ingénieurs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {MIX_ENGINEERS.map((eng, i) =>
        <button key={eng.id} onClick={() => setSel(i)} title={`${eng.nom} · ${eng.spe}`} style={{
          width: 40, height: 40, borderRadius: '50%',
          border: sel === i ? '2px solid var(--rouge3)' : '2px solid transparent',
          background: eng.bg, color: '#fff', fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 13, letterSpacing: '0.04em',
          cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'border-color 0.2s, transform 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: sel === i ? '0 0 0 3px rgba(193,44,44,0.18)' : 'none'
        }}
        onMouseEnter={(ev) => ev.currentTarget.style.transform = 'scale(1.06)'}
        onMouseLeave={(ev) => ev.currentTarget.style.transform = 'none'}>
            {eng.initiales}
          </button>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--blanc)', fontWeight: 600 }}>{e.nom}<span style={{ color: 'var(--dim)', fontWeight: 400 }}> · {e.spe}</span></div>

      {/* Prix + toggle compact */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 10, borderTop: '1px solid rgba(241,236,231,0.08)' }}>
        <div>
          <div style={{ fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.18em', color: 'rgba(241,236,231,0.5)', textTransform: 'uppercase' }}>Dès</div>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 24, color: 'var(--blanc)', lineHeight: 1 }}>{prix}€<span style={{ fontSize: 12, color: 'var(--dim)', marginLeft: 4, fontWeight: 500 }}>· {urgent ? '48h' : '7j'}</span></div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
          <span style={{
            width: 26, height: 16, borderRadius: 10, position: 'relative',
            background: urgent ? 'var(--rouge)' : 'rgba(241,236,231,0.12)',
            transition: 'background 0.2s', flexShrink: 0
          }}>
            <span style={{ position: 'absolute', top: 2, left: urgent ? 12 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </span>
          <input type="checkbox" checked={urgent} onChange={(ev) => setUrgent(ev.target.checked)} style={{ display: 'none' }} />
          <span style={{ fontSize: 10, color: 'var(--dim)' }}>48h <span style={{ color: 'var(--rouge3)' }}>+50€</span></span>
        </label>
      </div>

      <button onClick={() => window.openMixBookingModal && window.openMixBookingModal({ engineerId: e.id, urgent })} style={{
        marginTop: 10, width: '100%', padding: '10px',
        background: 'var(--rouge)', color: '#fff', border: 'none', borderRadius: 100,
        fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0 8px 24px rgba(139,30,30,0.45)', transition: 'background 0.2s, transform 0.2s'
      }}
      onMouseEnter={(ev) => {ev.currentTarget.style.background = 'var(--rouge2)';ev.currentTarget.style.transform = 'translateY(-1px)';}}
      onMouseLeave={(ev) => {ev.currentTarget.style.background = 'var(--rouge)';ev.currentTarget.style.transform = 'none';}}>
        Commander un mix
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 2l3 4-3 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>);

}

/* ─── MIX CTA SECTION (inline placement on other pages) ─── */
function MixCtaSection({ tone = 'dark' }) {
  const dark = tone === 'dark';
  return (
    <section style={{ padding: '64px 28px', background: dark ? 'var(--s1)' : 'var(--noir)', borderTop: '1px solid var(--br)', borderBottom: '1px solid var(--br)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 80% at 75% 50%, rgba(139,30,30,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 48, alignItems: 'center', position: 'relative', zIndex: 1 }} className="urbe-mix-cta-grid">
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 12 }}>Service à distance</div>
          <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(34px,4.5vw,52px)', letterSpacing: '0.02em', lineHeight: 0.92, marginBottom: 18, textTransform: 'uppercase' }}>Fais mixer ton titre.<br />Où que tu sois.</h2>
          <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.7, maxWidth: 460, fontWeight: 300, marginBottom: 18 }}>Envoie tes pistes, choisis ton ingé, reçois ton mix sous 7 jours. Urgence 48h disponible si tu es dans le rush.</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              '4 ingénieurs spécialisés',
              'Révisions incluses',
              'Livraison stems + master stéréo'
            ].map(t => (
              <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--blanc)' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(139,30,30,0.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="var(--rouge3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <MixWidget variant="inline" />
        </div>
      </div>
    </section>
  );
}

/* ─── PROMO BANNER — 1 mix acheté = 1 mix offert ──────────────── */
function PromoBanner({ setPage }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [countdown, setCountdown] = useState({ j: 0, h: 0, m: 0, s: 0 });
  const PROMO = 'URBEREMIX';
  const SPOTS_LEFT = 8;
  const SPOTS_TOTAL = 20;
  const WAVE = [5, 11, 19, 13, 23, 15, 25, 11, 20, 9, 16, 7];

  useEffect(() => {
    const deadline = new Date('2026-06-20T23:59:59');
    const tick = () => {
      const diff = deadline - new Date();
      if (diff <= 0) return;
      setCountdown({
        j: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000)
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(PROMO).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 12;
    const y = -((e.clientX - rect.left) / rect.width - 0.5) * 12;
    setTilt({ x, y });
  };

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <section style={{ background: 'var(--s1)', borderTop: '1px solid var(--br)', borderBottom: '1px solid var(--br)', position: 'relative', overflow: 'hidden', padding: '80px 28px' }}>

      {/* Photo studio en fond */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${R('studio/cabine.jpg')})`, backgroundSize: 'cover', backgroundPosition: 'center 30%', opacity: 0.07, pointerEvents: 'none', filter: 'blur(2px)', transform: 'scale(1.05)' }} />

      {/* Glow background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 130% at 50% 50%, rgba(139,30,30,0.17) 0%, transparent 65%)' }} />
      {/* Grid texture */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.035, backgroundImage: 'linear-gradient(rgba(241,236,231,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(241,236,231,0.5) 1px, transparent 1px)', backgroundSize: '64px 64px' }} />

      <div className="promo-grid" style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* ── GAUCHE : copy + countdown + CTA ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>

          {/* Pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 100, background: 'rgba(193,44,44,0.14)', border: '1px solid rgba(193,44,44,0.28)', marginBottom: 20 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--rouge3)', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--rouge3)', textTransform: 'uppercase' }}>Offre limitée · {SPOTS_LEFT} places restantes</span>
          </div>

          {/* Headline */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 'clamp(48px,6vw,84px)', lineHeight: 0.88, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'var(--blanc)' }}>1 mix acheté</div>
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 'clamp(48px,6vw,84px)', lineHeight: 0.88, letterSpacing: '0.01em', textTransform: 'uppercase', color: 'var(--rouge3)', fontStyle: 'italic' }}>1 master offert</div>
          </div>

          {/* Desc */}
          <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.7, maxWidth: 400, marginBottom: 28, fontWeight: 300 }}>Commande un mixage pro et reçois un mastering complet offert. Livraison 7 jours · urgence 48h disponible.</p>

          {/* Countdown */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 10, fontWeight: 500 }}>Expire dans</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[{ v: countdown.j, l: 'j' }, { v: countdown.h, l: 'h' }, { v: countdown.m, l: 'm' }, { v: countdown.s, l: 's' }].map(({ v, l }, i) => (
                <React.Fragment key={l}>
                  <div style={{ background: 'var(--s3)', border: '1px solid var(--br2)', borderRadius: 8, padding: '8px 12px', textAlign: 'center', minWidth: 50 }}>
                    <div style={{ fontFamily: 'Space Mono', fontWeight: 700, fontSize: 20, color: 'var(--blanc)', lineHeight: 1 }}>{pad(v)}</div>
                    <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.1em', marginTop: 3, textTransform: 'uppercase' }}>{l}</div>
                  </div>
                  {i < 3 && <span style={{ color: 'var(--rouge3)', fontFamily: 'Space Mono', fontSize: 16, fontWeight: 700, opacity: 0.55 }}>:</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Spots progress */}
          <div style={{ marginBottom: 30, width: '100%', maxWidth: 340 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}>{SPOTS_TOTAL - SPOTS_LEFT} offres réclamées</span>
              <span style={{ fontSize: 11, color: 'var(--rouge3)', fontWeight: 600 }}>{SPOTS_LEFT} restantes</span>
            </div>
            <div style={{ height: 3, background: 'rgba(241,236,231,0.07)', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((SPOTS_TOTAL - SPOTS_LEFT) / SPOTS_TOTAL) * 100}%`, background: 'linear-gradient(90deg, var(--rouge), var(--rouge3))', borderRadius: 100 }} />
            </div>
          </div>

          {/* CTA / Code */}
          {!revealed ? (
            <button onClick={() => setRevealed(true)} style={{
              padding: '15px 30px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
              boxShadow: '0 8px 32px rgba(139,30,30,0.48)', transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(ev) => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 14px 44px rgba(139,30,30,0.65)'; }}
            onMouseLeave={(ev) => { ev.currentTarget.style.transform = 'none'; ev.currentTarget.style.boxShadow = '0 8px 32px rgba(139,30,30,0.48)'; }}>
              Réclamer l'offre
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ padding: '11px 20px', borderRadius: 10, background: 'var(--s3)', border: '1px solid var(--br2)', fontFamily: 'Space Mono', fontSize: 15, fontWeight: 700, color: 'var(--blanc)', letterSpacing: '0.12em' }}>{PROMO}</div>
                <button onClick={handleCopy} style={{
                  padding: '11px 18px', borderRadius: 10, background: copied ? '#1c3b1c' : 'var(--rouge)', color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'background 0.35s'
                }}>
                  {copied
                    ? <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6.5l3 3 6-6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> Copié !</>
                    : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3.5" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.3"/><path d="M3.5 3.5V2A1.5 1.5 0 015 .5h5A1.5 1.5 0 0111.5 2v5A1.5 1.5 0 0110 8.5H8.5" stroke="white" strokeWidth="1.3" strokeLinecap="round"/></svg> Copier</>}
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--dim)', margin: 0, lineHeight: 1.65 }}>Code à mentionner lors de ta commande. Valable jusqu'au 20 juin 2026 · 1 titre offert.</p>
              <button onClick={() => window.openMixBookingModal ? window.openMixBookingModal({}) : setPage('booking')} style={{
                padding: '11px 22px', borderRadius: 100, background: 'transparent', color: 'var(--blanc)', border: '1px solid var(--br2)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'border-color 0.2s'
              }}
              onMouseEnter={(ev) => ev.currentTarget.style.borderColor = 'rgba(241,236,231,0.35)'}
              onMouseLeave={(ev) => ev.currentTarget.style.borderColor = 'var(--br2)'}>
                Commander un mix →
              </button>
            </div>
          )}
        </div>

        {/* ── DROITE : cartes 3D ── */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', perspective: '900px', position: 'relative' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTilt({ x: 0, y: 0 })}>

          {/* Photos flottantes — overlay décoratif */}
          {[
            { src: 'covers/c/nahir.png',   top: '-32px',  left: '-24px',  size: 68, rot: -8,  z: 0 },
            { src: 'covers/sheriff.jpg',    top: '-18px',  right: '-20px', size: 56, rot: 10,  z: 0 },
            { src: 'covers/nono.jpg',       bottom: '-28px', left: '-16px', size: 62, rot: 6,  z: 0 },
            { src: 'covers/gotti.jpg',      bottom: '-22px', right: '-18px', size: 54, rot: -11, z: 0 },
            { src: 'covers/c/bishop.png',   top: '42%',    left: '-44px',  size: 48, rot: 5,  z: 0 },
            { src: 'covers/c/ryflo.png',    top: '38%',    right: '-42px', size: 52, rot: -7, z: 0 },
          ].map(({ src, top, left, right, bottom, size, rot }, i) => (
            <div key={i} style={{
              position: 'absolute',
              top, left, right, bottom,
              width: size, height: size,
              borderRadius: 10,
              overflow: 'hidden',
              transform: `rotate(${rot}deg)`,
              border: '2px solid rgba(241,236,231,0.1)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
              opacity: 0.72,
              transition: 'opacity 0.3s',
              pointerEvents: 'none'
            }}>
              <img src={R(src)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: 'preserve-3d', transition: 'transform 0.14s ease-out' }}>

            {/* Carte 1 — MIX acheté */}
            <div style={{
              width: 172, height: 234, borderRadius: 18, flexShrink: 0,
              background: 'linear-gradient(155deg, #1f1f1f 0%, #111 100%)',
              border: '1px solid rgba(241,236,231,0.12)',
              boxShadow: '0 28px 72px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--rouge), var(--rouge3))', borderRadius: '18px 18px 0 0' }} />
              <div style={{ position: 'absolute', bottom: -24, right: -24, width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,30,30,0.2) 0%, transparent 70%)' }} />
              <svg viewBox="0 0 114 46" style={{ width: 104 }}>
                {WAVE.map((h, i) => <rect key={i} x={i * 9 + 2} y={(46 - h) / 2} width="6" height={h} rx="2" fill={`rgba(193,44,44,${0.45 + (h / 25) * 0.55})`} />)}
              </svg>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--dim)', letterSpacing: '0.1em', marginBottom: 5 }}>MIXAGE</div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 40, color: 'var(--blanc)', lineHeight: 1 }}>120€</div>
                <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'rgba(241,236,231,0.3)', letterSpacing: '0.06em', marginTop: 2 }}>+ MASTER OFFERT</div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.08em' }}>1 titre · 7 jours</div>
              <div style={{ position: 'absolute', bottom: 16, padding: '4px 12px', borderRadius: 100, background: 'rgba(193,44,44,0.16)', border: '1px solid rgba(193,44,44,0.32)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--rouge3)', textTransform: 'uppercase' }}>ACHETÉ</div>
            </div>

            {/* Connecteur */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
              <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 34, color: 'var(--rouge3)', lineHeight: 1 }}>+</span>
              <div style={{ width: 1, height: 22, background: 'rgba(241,236,231,0.09)' }} />
              <span style={{ fontFamily: 'Space Mono', fontSize: 12, color: 'rgba(241,236,231,0.22)', lineHeight: 1 }}>=</span>
            </div>

            {/* Carte 2 — MIX offert */}
            <div style={{
              width: 172, height: 234, borderRadius: 18, flexShrink: 0,
              background: revealed ? 'linear-gradient(155deg, #2e0f0f 0%, #1a0808 100%)' : 'linear-gradient(155deg, #141414, #0d0d0d)',
              border: revealed ? '1px solid rgba(193,44,44,0.42)' : '1px dashed rgba(241,236,231,0.1)',
              boxShadow: revealed ? '0 28px 72px rgba(139,30,30,0.42), 0 0 64px rgba(139,30,30,0.14)' : '0 20px 52px rgba(0,0,0,0.65)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, position: 'relative', overflow: 'hidden',
              transform: revealed ? 'none' : 'rotateY(14deg) translateZ(-8px)',
              transition: 'all 0.75s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: revealed ? 'linear-gradient(90deg, var(--rouge), var(--rouge3))' : 'rgba(241,236,231,0.05)', borderRadius: '18px 18px 0 0', transition: 'background 0.65s' }} />

              {revealed ? (
                <>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 75%, rgba(139,30,30,0.25) 0%, transparent 65%)', pointerEvents: 'none' }} />
                  <svg viewBox="0 0 114 46" style={{ width: 104 }}>
                    {WAVE.map((h, i) => <rect key={i} x={i * 9 + 2} y={(46 - h) / 2} width="6" height={h} rx="2" fill={`rgba(193,44,44,${0.55 + (h / 25) * 0.45})`} />)}
                  </svg>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--dim)', letterSpacing: '0.1em', marginBottom: 5 }}>MASTERING</div>
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 40, color: 'var(--rouge3)', fontStyle: 'italic', lineHeight: 1 }}>0€</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.08em' }}>1 titre · 7 jours</div>
                  <div style={{ position: 'absolute', bottom: 16, padding: '4px 12px', borderRadius: 100, background: 'rgba(193,44,44,0.22)', border: '1px solid rgba(193,44,44,0.48)', fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--rouge3)', textTransform: 'uppercase' }}>OFFERT</div>
                </>
              ) : (
                <>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="rgba(241,236,231,0.18)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 12 20 22 4 22 4 12" />
                    <rect x="2" y="7" width="20" height="5" />
                    <line x1="12" y1="22" x2="12" y2="7" />
                    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                  </svg>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 20, color: 'rgba(241,236,231,0.2)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', lineHeight: 1.25 }}>Ton master<br/>offert</div>
                  <div style={{ fontSize: 9, color: 'rgba(241,236,231,0.13)', letterSpacing: '0.1em' }}>← Réclamer</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── INGÉNIEURS DU SON ──────────────────────────────────────── */
const ENGINEERS = [
{ nom: 'Virgile', role: 'Ingénieur du son', initiales: 'VG', bg: '#8B1E1E', bio: 'Spécialiste rap & musiques urbaines. 10+ ans en studio, mix sur les meilleures productions FR.', youtube: 'https://www.youtube.com/@urbestudio', spotify: 'https://open.spotify.com/playlist/47SYmVwSFHwMFFScujjiul', instagram: 'https://www.instagram.com/urbestudio' },
{ nom: 'Olid', role: 'Ingénieur du son', initiales: 'OL', bg: '#1f1f1f', bio: 'Prise de son et direction artistique. Sessions live, banque de sons sur mesure, edit voix.', youtube: 'https://www.youtube.com/@urbestudio', spotify: 'https://open.spotify.com/playlist/47SYmVwSFHwMFFScujjiul', instagram: 'https://www.instagram.com/urbestudio' },
{ nom: 'Chourak', role: 'Ingénieur du son', initiales: 'CH', bg: '#2a1414', bio: 'Mix pop & R&B, mastering analogique. Finition prête streaming, vinyle et radio.', youtube: 'https://www.youtube.com/@urbestudio', spotify: 'https://open.spotify.com/playlist/47SYmVwSFHwMFFScujjiul', instagram: 'https://www.instagram.com/urbestudio' },
{ nom: 'BMS', role: 'Ingénieur du son', initiales: 'BM', bg: '#161616', bio: 'Composition et production. Création de prods sur-mesure, arrangement et orchestration.', youtube: 'https://www.youtube.com/@urbestudio', spotify: 'https://open.spotify.com/playlist/47SYmVwSFHwMFFScujjiul', instagram: 'https://www.instagram.com/urbestudio' }];


function SocialIcon({ href, hover, title, children }) {
  const real = !!href && href !== '#' && /^https?:\/\//i.test(href);
  const base = { width: 32, height: 32, borderRadius: 8, background: 'rgba(241,236,231,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dim)', textDecoration: 'none', transition: 'all 0.2s' };
  if (!real) {
    // Placeholder profile: render an inert icon instead of a dead "#" link that opens a blank tab.
    return <span title={title} aria-hidden="true" style={{ ...base, opacity: 0.4, cursor: 'default' }}>{children}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title} style={base}
      onMouseEnter={(ev) => { ev.currentTarget.style.background = hover; ev.currentTarget.style.color = '#fff'; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.background = 'rgba(241,236,231,0.06)'; ev.currentTarget.style.color = 'var(--dim)'; }}>{children}</a>);

}

function EngineersSection() {
  return (
    <section style={{ padding: '88px 28px', background: 'var(--noir)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 10 }}>L'équipe</div>
          <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 'clamp(38px,5vw,60px)', letterSpacing: '0.02em', lineHeight: 0.95, margin: 0 }}>NOS INGÉNIEURS DU SON.</h2>
        </div>

        <div className="urbe-eng-grid">
          {ENGINEERS.map((e) =>
          <div key={e.nom} className="urbe-eng-card" style={{
            background: '#111', border: '1px solid rgba(241,236,231,0.08)',
            borderRadius: 12, padding: '24px 22px 22px',
            display: 'flex', flexDirection: 'column', gap: 14
          }}>
              {/* Avatar */}
              <div className="urbe-eng-avatar" style={{
              width: 72, height: 72, borderRadius: '50%', background: e.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 26, letterSpacing: '0.04em',
              boxShadow: '0 8px 20px rgba(0,0,0,0.35)', flexShrink: 0
            }}>{e.initiales}</div>

              <div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 20, letterSpacing: '0.02em', color: 'var(--blanc)', lineHeight: 1.1, marginBottom: 4 }}>{e.nom}</div>
                <div style={{ fontSize: 11, color: 'var(--rouge3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{e.role}</div>
              </div>

              <div style={{ flex: 1 }} />

              {/* Travaux notables */}
              <div style={{ paddingTop: 14, borderTop: '1px solid rgba(241,236,231,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <SocialIcon href={e.youtube} hover="#FF0000" title="YouTube">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" /></svg>
                  </SocialIcon>
                  <SocialIcon href={e.spotify} hover="#1DB954" title="Spotify">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.1a.75.75 0 1 1-.3-1.5c4.5-1 8.4-.6 11.5 1.3.4.2.5.7.2 1.05zm1.5-3.3a1 1 0 0 1-1.3.3c-3.2-2-8.1-2.5-11.9-1.4a1 1 0 0 1-.6-1.9c4.3-1.3 9.7-.7 13.4 1.6a1 1 0 0 1 .4 1.4zm.1-3.5C15.4 8.3 8.9 8 5.2 9.2a1.2 1.2 0 1 1-.7-2.3c4.2-1.3 11.4-1 15.7 1.5a1.2 1.2 0 0 1-1.1 2.1z" /></svg>
                  </SocialIcon>
                </div>
                <SocialIcon href={e.instagram} hover="linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" title="Instagram">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                </SocialIcon>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>);

}

/* ─── TARIFS SECTION ─────────────────────────────────────────── */
function TarifsSection({ setPage }) {
  const [open, setOpen] = useState('mix');

  const CATS = [
    {
      id: 'mix', label: 'Mix & Mastering', tag: 'Service phare · À distance', featured: true,
      items: [
        { id: 'mix-standard',  label: 'Mixage Standard',    desc: 'Mix pro · livraison 7 jours · acompte 50%',              prix: '120€', unit: '/titre', badge: null },
        { id: 'mix-urgent',    label: 'Mixage Urgent 48h',  desc: 'Livraison sous 48h · idéal pour les sorties en urgence', prix: '170€', unit: '/titre', badge: '48h' },
        { id: 'mastering',     label: 'Mastering',          desc: 'Finition prête streaming, radio ou vinyle',              prix: '50€',  unit: '/titre', badge: 'Offert*' },
      ]
    },
    {
      id: 'sessions', label: 'Sessions Studio', tag: 'Paris 10ᵉ · 24h/24', featured: false,
      items: [
        { id: 'session-avec', label: 'Avec Ingénieur du Son', desc: 'Session encadrée · direction artistique · 2h minimum',    prix: '30€', unit: '/h', badge: null },
        { id: 'session-sans', label: 'Sans Ingénieur',        desc: 'Autonomie totale en cabine · ordinateur portable requis', prix: '20€', unit: '/h', badge: 'Ordi requis' },
        { id: 'session-nuit', label: 'Session de Nuit',       desc: 'Après 21h · studio ouvert 24h/24 · 2h minimum',          prix: '35€', unit: '/h', badge: 'Après 21h' },
      ]
    },
    {
      id: 'packs', label: 'Packs Studio', tag: 'Tout-en-un', featured: false,
      items: [
        { id: 'pack-rec-mix-mast', label: 'Pack Rec + Mix + Master',          desc: 'De la prise de son au master final dans un seul forfait',   prix: '200€', unit: '/titre', badge: 'Populaire' },
        { id: 'pack-compo-full',   label: 'Pack Compo + Rec + Mix + Master',  desc: "Création complète : prod sur-mesure jusqu'au master",       prix: '300€', unit: '/titre', badge: null },
      ]
    },
    {
      id: 'forfaits', label: 'Forfaits Prépayés', tag: "Jusqu'à 17% d'économie", featured: false,
      items: [
        { id: 'forfait-10h', label: 'Forfait 10H', desc: "10h de studio prépayées · revient à 27€/h",          prix: '270€',  unit: '', badge: null },
        { id: 'forfait-20h', label: 'Forfait 20H', desc: "20h à votre rythme · 25,50€/h effectif",             prix: '510€',  unit: '', badge: 'Best value' },
        { id: 'forfait-50h', label: 'Forfait 50H', desc: "Projet long terme · 25€/h · le plus avantageux",     prix: '1250€', unit: '', badge: 'Pro' },
      ]
    }
  ];

  const toggle = (id) => setOpen(open === id ? null : id);

  return (
    <section style={{ padding: '88px 28px', background: 'var(--s1)', borderTop: '1px solid var(--br)', borderBottom: '1px solid var(--br)', position: 'relative', overflow: 'hidden' }}>
      <img src={R('studio/cabine.jpg')} alt="" aria-hidden="true" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.12, filter: 'grayscale(0.5) contrast(1.05)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(16,16,16,0.96) 0%, rgba(16,16,16,0.82) 50%, rgba(16,16,16,0.95) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 70% at 50% 30%, rgba(139,30,30,0.09) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 48, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 10 }}>Tarifs</div>
            <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(40px,5.5vw,66px)', letterSpacing: '0.02em', lineHeight: 0.95 }}>TARIFS TRANSPARENTS.<br />SANS SURPRISE.</h2>
          </div>
          
        </div>

        {/* Accordions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CATS.map((cat) => {
            const isOpen = open === cat.id;
            return (
              <div key={cat.id} style={{
                borderRadius: 16, overflow: 'hidden',
                border: `1px solid ${isOpen && cat.featured ? 'rgba(193,44,44,0.38)' : isOpen ? 'var(--br2)' : 'var(--br)'}`,
                background: isOpen ? 'rgba(0,0,0,0.2)' : 'transparent',
                transition: 'border-color 0.3s, background 0.3s'
              }}>

                {/* Accordion header */}
                <button onClick={() => toggle(cat.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '20px 26px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: isOpen ? (cat.featured ? 'var(--rouge3)' : 'var(--blanc)') : 'rgba(241,236,231,0.2)', transition: 'background 0.25s' }} />
                    <div>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 20, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.1, color: isOpen ? 'var(--blanc)' : 'rgba(241,236,231,0.6)', transition: 'color 0.25s' }}>{cat.label}</div>
                      <div style={{ fontSize: 10, letterSpacing: '0.1em', marginTop: 2, color: isOpen && cat.featured ? 'var(--rouge3)' : 'var(--dim)' }}>{cat.tag}</div>
                    </div>
                    {cat.featured && (
                      <div style={{ padding: '3px 10px', borderRadius: 100, background: 'rgba(193,44,44,0.16)', border: '1px solid rgba(193,44,44,0.3)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--rouge3)', textTransform: 'uppercase' }}>★ Priorité</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: '0.06em' }}>{cat.items.length} service{cat.items.length > 1 ? 's' : ''}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)', opacity: 0.45 }}>
                      <path d="M3 6l5 5 5-5" stroke="var(--blanc)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </button>

                {/* Accordion body */}
                <div style={{ maxHeight: isOpen ? '600px' : '0px', overflow: 'hidden', transition: 'max-height 0.48s cubic-bezier(0.4,0,0.2,1)' }}>
                  <div style={{ borderTop: '1px solid var(--br)' }}>
                    {cat.items.map((item, idx) => (
                      <div key={item.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 26px 18px 48px', borderBottom: idx < cat.items.length - 1 ? '1px solid rgba(241,236,231,0.05)' : 'none', transition: 'background 0.18s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(241,236,231,0.025)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        {/* Left: info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--blanc)' }}>{item.label}</span>
                            {item.badge && (
                              <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0, background: item.badge === 'Offert*' ? 'rgba(193,44,44,0.18)' : 'rgba(241,236,231,0.07)', border: `1px solid ${item.badge === 'Offert*' ? 'rgba(193,44,44,0.38)' : 'rgba(241,236,231,0.1)'}`, color: item.badge === 'Offert*' ? 'var(--rouge3)' : 'var(--dim)' }}>{item.badge}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 300 }}>{item.desc}</div>
                        </div>
                        {/* Right: price + CTA */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 28, color: 'var(--blanc)', lineHeight: 1 }}>{item.prix}</span>
                            {item.unit && <span style={{ fontSize: 11, color: 'var(--dim)', marginLeft: 3 }}>{item.unit}</span>}
                          </div>
                          <button onClick={() => (item.id === 'mix-standard' || item.id === 'mix-urgent') && window.openMixBookingModal ? window.openMixBookingModal({ urgent: item.id === 'mix-urgent' }) : setPage('booking', item.id)} style={{
                            padding: '9px 18px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                            background: cat.featured ? 'var(--rouge)' : 'transparent',
                            color: cat.featured ? '#fff' : 'var(--rouge3)',
                            border: `1px solid ${cat.featured ? 'var(--rouge)' : 'rgba(193,44,44,0.38)'}`
                          }}
                          onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--rouge)'; ev.currentTarget.style.color = '#fff'; ev.currentTarget.style.borderColor = 'var(--rouge)'; }}
                          onMouseLeave={(ev) => { ev.currentTarget.style.background = cat.featured ? 'var(--rouge)' : 'transparent'; ev.currentTarget.style.color = cat.featured ? '#fff' : 'var(--rouge3)'; ev.currentTarget.style.borderColor = cat.featured ? 'var(--rouge)' : 'rgba(193,44,44,0.38)'; }}>
                            Commander
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5h7M5.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── NOS ACTUALITÉS (carrousel défilant) ────────────────────── */
function ActuSection({ setPage }) {
  const trackRef = useRef(null);
  const scrollByCards = (dir) => {
    const el = trackRef.current; if (!el) return;
    const card = el.querySelector('[data-actu-card]');
    const step = card ? card.getBoundingClientRect().width + 18 : 318;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  const ITEMS = [
    { type: 'Article', cat: 'Le journal', img: 'covers/nono.jpg', date: '12 JUIN 2026', titre: 'Mixage & mastering audio en ligne : le guide', excerpt: 'Envoyez vos pistes, choisissez votre ingénieur, recevez votre mix prêt pour le streaming sous 7 jours.', href: 'blog/mixage-mastering-en-ligne.html' },
    { type: 'Événement', cat: 'Événement', img: 'covers/fdlm-2026.jpg', date: '21 JUIN 2026', titre: 'Fête de la Musique 2026 à Paris', excerpt: 'Open air gratuit avec Urbe, Saphir & Break The Stage : quand la passion dépasse les obstacles.', href: 'blog/fete-de-la-musique-2026-paris.html' },
    { type: 'Photo', cat: 'Studio', img: 'studio/cabine2.jpg', date: '2 JUIN 2026', titre: "Notre studio d'enregistrement à Paris 10ᵉ", excerpt: 'Cabine traitée, régie pro, ouvert 24h/24 au cœur du 10ᵉ arrondissement.', href: 'blog/studio-enregistrement-paris.html' },
    { type: 'Vidéo', cat: 'En vidéo', img: 'studio/cabine.jpg', date: '28 MAI 2026', titre: 'Visite du studio en vidéo', excerpt: "Micro ouvert, lumières tamisées — un aperçu d'une session d'enregistrement.", href: 'blog/studio-enregistrement-paris.html' },
    { type: 'Article', cat: 'Conseils', img: 'covers/gotti.jpg', date: '20 MAI 2026', titre: 'Mix & mastering : 5 erreurs à éviter', excerpt: 'Les réflexes qui font passer un mix amateur au niveau pro.', href: 'blog/mixage-mastering-en-ligne.html' },
    { type: 'Photo', cat: 'Backstage', img: 'covers/berna.jpg', date: '14 MAI 2026', titre: 'Dans les coulisses du studio', excerpt: 'Une journée type au studio Urbe, côté pile.', href: 'blog/mixage-rap-paris.html' }];

  const typeTone = { 'Vidéo': '#c12c2c', 'Photo': '#3a7bd1', 'Article': '#d1a23a', 'Événement': '#3ad17a' };
  return (
    <section style={{ padding: '88px 28px', background: 'var(--noir)' }}>
      <style>{`.urbe-actu-track::-webkit-scrollbar{display:none}@media(max-width:640px){.urbe-actu-card{flex-basis:82% !important}}`}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 36, gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 10 }}>Le journal</div>
            <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 'clamp(38px,5vw,60px)', letterSpacing: '0.02em', lineHeight: 0.95, margin: 0 }}>NOS ACTUALITÉS.</h2>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[-1, 1].map((d) =>
            <button key={d} onClick={() => scrollByCards(d)} aria-label={d < 0 ? 'Actualité précédente' : 'Actualité suivante'} style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--s1)', border: '1px solid var(--br2)', color: 'var(--blanc)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--rouge)'; e.currentTarget.style.color = 'var(--rouge3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--br2)'; e.currentTarget.style.color = 'var(--blanc)'; }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">{d < 0 ? <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}</svg>
              </button>
            )}
          </div>
        </div>

        <div ref={trackRef} className="urbe-actu-track" style={{ display: 'flex', gap: 18, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 6, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {ITEMS.map((it, i) => {
            const tone = typeTone[it.type] || 'var(--rouge)';
            return (
              <a key={i} href={it.href} data-actu-card className="urbe-actu-card" style={{ flex: '0 0 300px', scrollSnapAlign: 'start', background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', textDecoration: 'none', color: 'inherit', transition: 'border-color 0.2s, transform 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(139,30,30,0.55)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--br)'; e.currentTarget.style.transform = 'none'; }}>
                <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', background: 'var(--s2)' }}>
                  <img src={R(it.img)} alt={it.titre} loading="lazy" decoding="async" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = R('covers/gemen.jpg'); }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 45%, rgba(8,8,8,0.7) 100%)' }} />
                  <span style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: 'rgba(8,8,8,0.72)', backdropFilter: 'blur(6px)', border: `1px solid ${tone}`, color: '#fff', fontFamily: 'Space Mono', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: tone }} />{it.type}
                  </span>
                  {it.type === 'Vidéo' &&
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(139,30,30,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="#fff"><path d="M5 3l8 5-8 5V3z" /></svg>
                      </div>
                    </div>
                  }
                </div>
                <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--rouge3)', textTransform: 'uppercase' }}>{it.cat}</span>
                    <span style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '0.08em', color: 'var(--dim)' }}>{it.date}</span>
                  </div>
                  <h3 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 21, letterSpacing: '0.01em', lineHeight: 1.05, margin: 0, color: 'var(--blanc)' }}>{it.titre}</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.55, fontWeight: 300, margin: 0, flex: 1 }}>{it.excerpt}</p>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--rouge3)', marginTop: 2 }}>Lire l'article →</span>
                </div>
              </a>);

          })}
        </div>
      </div>
    </section>);

}

/* ─── HOMEPAGE ───────────────────────────────────────────────── */
function HomePage({ setPage }) {
  const [formOpen, setFormOpen] = useState(false);
  const [formStep, setFormStep] = useState(0); // 0=idle, 1=sent
  const [formData, setFormData] = useState({ nom: '', email: '', projet: '', message: '' });
  const handleSubmit = () => {
    if (!formData.nom || !formData.email) return;
    postLead({ nom: formData.nom, email: formData.email, type: formData.projet, message: formData.message, source: 'Formulaire accueil' });
    setFormStep(1);
    setTimeout(() => {setFormOpen(false);setFormStep(0);setFormData({ nom: '', email: '', projet: '', message: '' });}, 2800);
  };

  return (
    <div>
      {/* ── HERO · V4 "Now Recording" ─────────────────────────── */}
      <section style={{ minHeight: 'max(720px, 100vh)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>

        {/* Photo cabine background */}
        <img src={R('studio/cabine.jpg')} alt="Studio Urbe" fetchpriority="high" loading="eager" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.92) contrast(1.04)' }} />

        {/* Scrim horizontal pour lisibilité côté gauche */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(95deg, rgba(5,5,5,0.94) 0%, rgba(5,5,5,0.80) 38%, rgba(5,5,5,0.32) 62%, rgba(5,5,5,0.55) 100%)', pointerEvents: 'none' }} />

        {/* Vignette rouge subtile */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 75% 80% at 28% 55%, rgba(139,30,30,0.20) 0%, transparent 60%)', pointerEvents: 'none' }} />

        {/* Fades nav + section suivante */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180, background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 240, background: 'linear-gradient(0deg, rgba(5,5,5,0.95) 0%, transparent 100%)', pointerEvents: 'none' }} />

        {/* MAIN — claim bottom-left */}
        <div style={{ position: 'relative', zIndex: 3, padding: '0 clamp(20px,3vw,56px) 140px', maxWidth: 820 }}>
          {/* Live REC pill — in flow, above eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ad17a', boxShadow: '0 0 8px #3ad17a', animation: 'pulse 2s infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '0.22em', color: 'var(--dim)', textTransform: 'uppercase' }}>Studio disponible · 37 rue d'Hauteville</span>
          </div>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
            <div style={{ width: 36, height: 2, background: 'var(--rouge3)', borderRadius: 2 }} />
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.22em', color: 'rgba(241,236,231,0.65)', textTransform: 'uppercase', fontFamily: 'Space Mono' }}></span>
          </div>

          {/* Title — URBE / STUDIO (ajouré) / PARIS */}
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, lineHeight: 0.86, letterSpacing: '-0.012em', marginBottom: 28 }}>
            <div style={{ fontSize: 'clamp(54px, 9.5vw, 138px)', color: 'var(--blanc)' }}>URBE</div>
            <div style={{ fontSize: 'clamp(54px, 9.5vw, 138px)', color: 'transparent', WebkitTextStroke: '1.5px rgba(241,236,231,0.45)' }}>STUDIO</div>
            <div style={{ fontSize: 'clamp(54px, 9.5vw, 138px)', color: 'var(--blanc)' }}>PARIS</div>
          </h1>

          <p style={{ fontSize: 17, lineHeight: 1.55, fontWeight: 300, color: 'rgba(241,236,231,0.78)', maxWidth: 500, marginBottom: 36 }}>
            Rec, mix, mastering — dans un studio pro <span style={{ color: 'var(--blanc)', fontWeight: 500 }}>ouvert 24h/24</span>, au cœur du 10ᵉ. Tu viens avec ton son, on s'occupe du reste.
          </p>

          {/* CTA buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
            <button onClick={() => setPage('booking')} style={{
              background: 'var(--rouge)', color: '#fff', border: 'none',
              padding: '15px 28px', borderRadius: 100, cursor: 'pointer',
              fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 10px 30px rgba(139,30,30,0.55)', transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {e.currentTarget.style.background = 'var(--rouge2)';e.currentTarget.style.transform = 'translateY(-2px)';e.currentTarget.style.boxShadow = '0 14px 38px rgba(139,30,30,0.65)';}}
            onMouseLeave={(e) => {e.currentTarget.style.background = 'var(--rouge)';e.currentTarget.style.transform = 'none';e.currentTarget.style.boxShadow = '0 10px 30px rgba(139,30,30,0.55)';}}>
              Réserver une session
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button onClick={() => setFormOpen((o) => !o)} style={{
              background: 'rgba(241,236,231,0.07)', color: 'var(--blanc)',
              border: '1px solid var(--br2)', padding: '15px 24px', borderRadius: 100,
              cursor: 'pointer', fontSize: 14, fontWeight: 500, backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(241,236,231,0.12)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(241,236,231,0.07)'}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blanc)', opacity: 0.6 }} />
              {formOpen ? 'Fermer' : 'Nous contacter'}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: formOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>

          {/* ── Formulaire pliant ─────────────────────────────── */}
          <div style={{
            overflow: 'hidden', maxHeight: formOpen ? 420 : 0,
            transition: 'max-height 0.45s cubic-bezier(.4,0,.2,1)'
          }}>
            {formStep === 0 ?
            <div style={{ background: 'rgba(16,16,16,0.85)', backdropFilter: 'blur(20px)', border: '1px solid var(--br2)', borderRadius: '22px', padding: '28px 28px 24px', maxWidth: 520 }}>
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', marginBottom: 18, color: 'var(--blanc)' }}>Dis-nous en quoi on peut t'aider</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {[
                { key: 'nom', label: 'Ton nom ou ton projet', ph: 'Artiste, beatmaker…' },
                { key: 'email', label: 'Email', ph: 'ton@email.fr' }].
                map((f) =>
                <div key={f.key}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginBottom: 6, letterSpacing: '0.04em' }}>{f.label}</label>
                      <input value={formData[f.key]} onChange={(e) => setFormData((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.ph} style={{
                    width: '100%', background: 'var(--s2)', border: '1px solid var(--br)',
                    color: 'var(--blanc)', fontSize: 13, fontWeight: 400,
                    padding: '10px 14px', borderRadius: '8px', outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--rouge)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--br)'} />
                    </div>
                )}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginBottom: 6, letterSpacing: '0.04em' }}>Type de projet</label>
                  <select value={formData.projet} onChange={(e) => setFormData((p) => ({ ...p, projet: e.target.value }))}
                style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--br)', color: formData.projet ? 'var(--blanc)' : 'var(--dim)', fontSize: 13, padding: '10px 14px', borderRadius: '8px', outline: 'none', cursor: 'pointer' }}>
                    <option value="" style={{ color: 'var(--dim)' }}>Choisissez...</option>
                    <option value="enreg">Enregistrement</option>
                    <option value="mix">Mixage / Mastering</option>
                    <option value="prod">Production complète</option>
                    <option value="podcast">Podcast / Voix-off</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginBottom: 6, letterSpacing: '0.04em' }}>Message (optionnel)</label>
                  <textarea value={formData.message} onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                placeholder="Dites-nous en plus sur votre projet..." rows={3}
                style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--br)', color: 'var(--blanc)', fontSize: 13, padding: '10px 14px', borderRadius: '8px', outline: 'none', resize: 'none' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--rouge)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--br)'} />
                </div>
                <button onClick={handleSubmit} style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                background: 'var(--rouge)', color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--rouge2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--rouge)'}>
                  Envoyer la demande →
                </button>
              </div> :

            <div style={{ background: 'rgba(16,16,16,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(139,30,30,0.4)', borderRadius: '22px', padding: '36px 28px', maxWidth: 520, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Message reçu !</div>
                <div style={{ fontSize: 13, color: 'var(--dim)' }}>On te revient dans les 24h.</div>
              </div>
            }
          </div>
        </div>

        {/* Floating MIX EN LIGNE widget — left side (≥1440px) */}
        <MixWidget />

        
        {/* Bottom marquee — récemment au studio */}
        <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, zIndex: 3, padding: '0 clamp(20px,3vw,56px)', display: 'flex', alignItems: 'center', gap: 24, whiteSpace: 'nowrap', overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%)' }}>
          <span style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '0.22em', color: 'rgba(241,236,231,0.6)', textTransform: 'uppercase', fontWeight: 600, flexShrink: 0 }}>Ils sont passés ici →</span>
          <div className="urbe-hero-marquee-track" style={{ display: 'flex', gap: 22, alignItems: 'center', opacity: 0.65, flexShrink: 0 }}>
            {[...Array(2)].flatMap((_, dup) => [
            'NONO LA GRINTA · Compo · Rec',
            'SHERIFF LA ZONE · Compo · Rec',
            'NAHIR · Rec',
            'RICKY BISHOP · Compo · Rec',
            'ASIKI · Compo · Rec',
            'SOMYKE · Compo · Rec',
            'RYFLO · Compo · Rec',
            'SAKI225 · Compo · Rec',
            '63KLUF · Compo · Rec',
            'BERNA · Rec',
            'GOTTI MARRAS · Compo · Rec',
            'MAX DLG · Compo · Rec',
            'GEMEN · Rec',
            'CASH DICO × WESTSIDEBOOGIE · Comp · Rec · Mix/Master',
            'TITI33 · Comp · Rec · Mix/Master',
            'DETOX · Mix · Master'].
            map((s, i) =>
            <React.Fragment key={`${dup}-${i}`}>
                <span style={{ fontFamily: 'Space Mono', fontSize: 11, letterSpacing: '0.06em', color: 'rgba(241,236,231,0.7)', fontWeight: 400 }}>{s}</span>
                <span style={{ width: 4, height: 4, background: 'var(--rouge3)', borderRadius: '50%', flexShrink: 0 }} />
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Scroll cue — bottom-right, off-center to avoid marquee overlap */}
        <div style={{ position: 'absolute', bottom: 24, right: 'clamp(20px,3vw,56px)', zIndex: 4, display: 'flex', alignItems: 'center', gap: 10, opacity: 0.4, pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.22em', color: 'var(--blanc)', textTransform: 'uppercase' }}>défiler</div>
          <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><path d="M5 1v11M1 8l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--blanc)' }} /></svg>
        </div>
      </section>

      {/* ── PROMO BANDEAU ─────────────────────────────────────── */}
      <PromoBanner setPage={setPage} />

      {/* ── TRUST STRIP ──────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--br)', borderBottom: '1px solid var(--br)', background: 'var(--s1)', padding: '20px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          {[
          { n: '80m²', l: 'Cabine traitée' },
          { n: '200+', l: 'Artistes enregistrés' },
          { n: '4', l: 'Ingénieurs certifiés' },
          { n: '7j/7', l: 'Ouvert — même les nuits' },
          { n: '98%', l: 'Satisfaction client' }].
          map((s, i) =>
          <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {i > 0 && <div style={{ width: 1, height: 28, background: 'var(--br)', marginRight: 12 }} />}
              <div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 26, letterSpacing: '0.02em', color: 'var(--rouge3)', lineHeight: 1 }}>{s.n}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2, fontWeight: 400 }}>{s.l}</div>
              </div>
            </div>
          )}
          <button onClick={() => setPage('booking')} style={{
            background: 'var(--rouge)', color: '#fff', border: 'none',
            padding: '10px 22px', borderRadius: 100, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            flexShrink: 0, transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--rouge2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--rouge)'}>
            Réserver →
          </button>
        </div>
      </div>

      {/* ── NOS ACTUALITÉS ───────────────────────────────────── */}
      <ActuSection setPage={setPage} />

      {/* ── CRÉDITS PREVIEW ──────────────────────────────────── */}
      <section style={{ padding: '88px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 44 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 10 }}>2024 · 2025</div>
              <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(38px,5vw,60px)', letterSpacing: '0.02em', lineHeight: 0.95 }}>
                CRÉDITS
                <span style={{ color: 'transparent', WebkitTextStroke: '1px var(--br2)', marginLeft: 16 }}></span>
              </h2>
            </div>
            <button onClick={() => setPage('credits')} style={{
              background: 'none', border: '1px solid var(--br2)', color: 'var(--dim)',
              padding: '9px 20px', borderRadius: 100, cursor: 'pointer',
              fontSize: 13, fontWeight: 500, transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {e.currentTarget.style.color = 'var(--blanc)';e.currentTarget.style.borderColor = 'var(--blanc)';}}
            onMouseLeave={(e) => {e.currentTarget.style.color = 'var(--dim)';e.currentTarget.style.borderColor = 'var(--br2)';}}>
              Voir tout
            </button>
          </div>

          <div className="urbe-r-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
            { nom: 'NONO LA GRINTA', type: 'Composition · Rec', img: 'covers/nono.jpg' },
            { nom: 'RICKY BISHOP', type: 'Composition · Rec', img: 'covers/c/bishop.png' },
            { nom: 'NAHIR', type: 'Rec', img: 'covers/c/nahir.png' },
            { nom: 'GEMEN', type: 'Rec', img: 'covers/gemen.jpg' },
            { nom: 'CASH DICO × WESTSIDEBOOGIE', type: 'Comp · Rec · Mix/Master', img: 'covers/cashdico.jpg' },
            { nom: 'TITI33', type: 'Comp · Rec · Mix/Master', img: 'covers/titi33.jpg' }].
            map((a, i) =>
            <div key={a.nom} style={{
              position: 'relative', overflow: 'hidden', cursor: 'pointer',
              aspectRatio: '1/1', borderRadius: '14px',
              background: '#0a0a0a',
              transition: 'transform 0.3s, box-shadow 0.3s'
            }}
            onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-4px)';e.currentTarget.style.boxShadow = `0 20px 48px rgba(0,0,0,0.6)`;}}
            onMouseLeave={(e) => {e.currentTarget.style.transform = 'none';e.currentTarget.style.boxShadow = 'none';}}>
                {/* Cover photo (already includes Urbe watermark, artist name, role and Recap 2025) */}
                <img src={R(a.img)} alt={a.nom} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── INGÉNIEURS DU SON ────────────────────────────────── */}
      <EngineersSection />

      {/* ── TARIFS ───────────────────────────────────────────── */}
      <TarifsSection setPage={setPage} />

      {/* ── SCHOOL BRIDGE ────────────────────────────────────── */}
      <section style={{ padding: '88px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div onClick={() => setPage('school')} {...cardKeys(() => setPage('school'))} aria-label="Découvrir Urbe School" className="urbe-r-stack" style={{
            border: '1px solid var(--br)', borderRadius: '32px', padding: '64px 56px',
            background: 'var(--s1)', position: 'relative', overflow: 'hidden', cursor: 'pointer',
            display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center',
            transition: 'border-color 0.3s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(139,30,30,0.4)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--br)'}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 80% at 85% 50%, rgba(139,30,30,0.1), transparent)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 160, color: 'transparent', WebkitTextStroke: '1px rgba(241,236,231,0.04)', lineHeight: 1, userSelect: 'none', letterSpacing: '-0.02em' }}>SCHOOL</div>

            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 14 }}>Urbe School · Formation</div>
              <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(36px,4.5vw,58px)', letterSpacing: '0.02em', lineHeight: 0.95, marginBottom: 20 }}>FORMEZ-VOUS AUX<br />MÉTIERS DU SON.</h2>
              <p style={{ fontSize: 15, color: 'var(--dim)', lineHeight: 1.7, maxWidth: 460, fontWeight: 300 }}>Apprenez à enregistrer, mixer et maîtriser votre son dans notre studio — avec des enseignants issus de l'industrie. Formations intensives, certifiées, dispensées en conditions réelles.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end', position: 'relative', flexShrink: 0 }}>
              <button style={{
                background: 'var(--rouge)', color: '#fff', border: 'none',
                padding: '14px 28px', borderRadius: 100, cursor: 'pointer',
                fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                boxShadow: '0 8px 28px rgba(139,30,30,0.35)', transition: 'all 0.2s'
              }}>Découvrir Urbe School
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2v6" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></svg>
              </button>
              <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: '0.08em' }}>Site dédié · bientôt disponible</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer rendu globalement via <SiteFooter> dans App (audit NAV-02) */}
    </div>);

}

/* ─── BOOKING PAGE ───────────────────────────────────────────── */
/* Catalogue complet — tous les produits du studio */
const BOOKING_CATALOG = [
  // Catégorie : Session studio (horaire)
  { id: 'session-avec', cat: 'Session studio', label: 'Avec Ingénieur du Son', desc: 'Session encadrée par un ingénieur. 2h minimum.', prix: 30, unit: '/h', billing: 'hourly', needsDate: true, featured: true, badge: 'Le + réservé', stripeKey: 'session-avec' },
  { id: 'session-sans', cat: 'Session studio', label: 'Sans Ingénieur du Son', desc: 'Autonomie totale. Ordinateur portable requis.', prix: 20, unit: '/h', billing: 'hourly', needsDate: true, stripeKey: 'session-sans' },
  { id: 'session-nuit', cat: 'Session studio', label: 'Session de Nuit', desc: 'Après 21h. Studio ouvert 24/24.', prix: 35, unit: '/h', billing: 'hourly', needsDate: true, stripeKey: 'session-nuit' },
  { id: 'rec-1h', cat: 'Session studio', label: "2h d'enregistrement", desc: 'Séance découverte de deux heures, ingénieur inclus.', prix: 30, unit: ' · 2h', billing: 'flat', needsDate: true, stripeKey: 'rec-1h' },
  // Catégorie : Mix & Master
  { id: 'mix-standard', cat: 'Mix & Master', label: 'Mixage Standard', desc: 'Mix pro · livraison 7 jours · acompte 50%.', prix: 120, unit: '/titre', billing: 'flat', needsDate: false, featured: true, badge: 'Service phare', stripeKey: 'mix-standard' },
  { id: 'mix-urgent', cat: 'Mix & Master', label: 'Mixage Urgent 48h', desc: 'Mix livré sous 48h · supplément 50€.', prix: 170, unit: '/titre', billing: 'flat', needsDate: false, stripeKey: 'mix-urgent' },
  { id: 'mastering', cat: 'Mix & Master', label: 'Mastering', desc: 'Finition streaming · radio · vinyle.', prix: 50, unit: '/titre', billing: 'flat', needsDate: false, stripeKey: 'mastering' },
  // Catégorie : Packs
  { id: 'pack-rec-mix-mast', cat: 'Packs', label: 'Pack Rec + Mix + Master', desc: 'De la prise au master final.', prix: 200, unit: '/titre', billing: 'flat', needsDate: true, featured: true, badge: 'Meilleure offre', stripeKey: 'pack-rec-mix-mast' },
  { id: 'pack-compo-full', cat: 'Packs', label: 'Pack Compo + Rec + Mix + Master', desc: 'Création complète sur-mesure.', prix: 300, unit: '/titre', billing: 'flat', needsDate: true, stripeKey: 'pack-compo-full' },
  // Catégorie : Instrumentals
  { id: 'instru-lease', cat: 'Instrumentals', label: 'Instrumental du catalogue', desc: 'Lease classique · MP3 + WAV · usage non-exclusif.', prix: 50, unit: ' · lease', billing: 'flat', needsDate: false, stripeKey: 'instru-lease' },
  // Catégorie : Forfaits
  { id: 'forfait-10h', cat: 'Forfaits prépayés', label: 'Forfait 10H', desc: '10 heures à votre rythme.', prix: 270, unit: ' forfait', billing: 'flat', needsDate: false, stripeKey: 'forfait-10h' },
  { id: 'forfait-20h', cat: 'Forfaits prépayés', label: 'Forfait 20H', desc: '20 heures · économisez davantage.', prix: 510, unit: ' forfait', billing: 'flat', needsDate: false, stripeKey: 'forfait-20h' },
  { id: 'forfait-50h', cat: 'Forfaits prépayés', label: 'Forfait 50H', desc: 'Le plus avantageux · projets longs.', prix: 1250, unit: ' forfait', billing: 'flat', needsDate: false, stripeKey: 'forfait-50h' },
];

function BookingPage({ initialProductId }) {
  const [step, setStep] = useState(1);
  const [sel, setSel] = useState({ productId: initialProductId || null, date: null, time: null, hours: 2, addons: [] });
  // Identité du client collectée avant paiement → envoyée dans HubSpot avec la commande.
  const [contact, setContact] = useState({ firstName: '', lastName: '', email: '', phone: '', artist: '', project: '' });
  const setC = (k) => (e) => setContact((c) => ({ ...c, [k]: e.target.value }));
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim());
  const contactValid = !!(contact.firstName.trim() && contact.lastName.trim() && emailOk && contact.phone.trim().length >= 6);
  const champStyle = { width: '100%', padding: '11px 13px', borderRadius: 9, background: 'var(--noir)', border: '1px solid var(--br)', color: 'var(--blanc)', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--dim)', marginBottom: 6, display: 'block', letterSpacing: '0.02em' };
  const [openCat, setOpenCat] = useState(() => { const f = BOOKING_CATALOG.find((p) => !p.featured); return f ? f.cat : null; });
  useEffect(() => { if (initialProductId) setSel((p) => ({ ...p, productId: initialProductId })); }, [initialProductId]);
  // Créneaux réellement disponibles : on récupère les heures occupées du studio (Google Calendar via n8n).
  const [slotsBusy, setSlotsBusy] = useState({});
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  useEffect(() => {
    const u = URBE_CONFIG.slotsWebhook;
    if (!u) { setSlotsLoaded(true); return; }
    let alive = true;
    fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Urbe-Key': URBE_WEBHOOK_KEY }, body: '{}' }).
    then((r) => r.json()).then((d) => { if (alive) { setSlotsBusy((d && d.busy) || {}); setSlotsLoaded(true); } }).
    catch(() => { if (alive) setSlotsLoaded(true); });
    return () => { alive = false; };
  }, []);

  // Génération calendrier : 14 jours à partir d'aujourd'hui
  const nextDays = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    nextDays.push(d);
  }
  const jourLabel = (d) => {
    const noms = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return `${noms[d.getDay()]} ${d.getDate()}`;
  };
  // Clé de date en heure LOCALE (et non UTC) : toISOString() décalait d'un jour la nuit
  // (minuit Paris = 22h UTC la veille), ce qui désalignait les créneaux occupés et la date envoyée à Stripe/agenda.
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const heures = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];
  // Heures déjà prises pour la date sélectionnée (lues sur le calendrier studio).
  // On n'AFFICHE que les créneaux libres (les occupés sont masqués, pas barrés).
  const product = BOOKING_CATALOG.find((p) => p.id === sel.productId);
  const occupes = (sel.date && slotsBusy[sel.date]) || [];
  // Chaque créneau occupé renvoyé par n8n = 1h pleine → on le convertit en intervalle de minutes.
  const busyMin = occupes.map((h) => { const hh = parseInt(h, 10); return [hh * 60, hh * 60 + 60]; });
  // Durée de la session à réserver : sessions horaires = sel.hours ; produits datés au forfait = 2h.
  const bookingHours = (product && product.billing === 'hourly') ? (sel.hours || 2) : 2;
  // Un créneau de DÉBUT n'est libre que si TOUTE la session [début → début+durée] ne chevauche AUCUN créneau occupé.
  // (corrige le cas : 2h réservées à 9h qui mordaient sur une session déjà notée à 10h30).
  const slotLibre = (h) => {
    const hh = parseInt(h, 10);
    const s = hh * 60, e = s + bookingHours * 60;
    return !busyMin.some(([bs, be]) => s < be && e > bs);
  };
  // Réservation possible au plus tôt 24h à l'avance : on masque les créneaux trop proches.
  const MIN_LEAD_MS = 24 * 60 * 60 * 1000;
  const nowTs = Date.now();
  const heuresLibres = heures.filter((h) => slotLibre(h) && (sel.date ? (new Date(`${sel.date}T${h}:00`).getTime() - nowTs) >= MIN_LEAD_MS : false));
  const durees = [2, 3, 4, 6, 8];
  // Si la durée change et rend l'heure choisie incompatible (chevauchement), on la désélectionne.
  useEffect(() => {
    if (sel.time && !heuresLibres.includes(sel.time)) setSel((p) => ({ ...p, time: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.hours, sel.date, slotsLoaded]);

  const addonsOpts = [
    { id: 'mix-standard', label: 'Ajouter Mixage', desc: 'Mix pro · 7j de livraison.', prix: 120 },
    { id: 'mastering', label: 'Ajouter Mastering', desc: 'Finition streaming / radio.', prix: 50 },
    { id: 'pack-com-1', label: 'Pack Com · Shooting + 1 reel', desc: 'Shooting photo studio + 1 réel social media.', prix: 250 },
    { id: 'pack-com-3', label: 'Pack Com · Shooting + 3 reels', desc: 'Shooting photo + 3 réels (2 studio + 1 extérieur).', prix: 450 },
  ];

  const addTotal = sel.addons.reduce((s, id) => { const a = addonsOpts.find((x) => x.id === id); return s + (a?.prix || 0); }, 0);
  // Tarif nuit : à partir de 21h, le tarif horaire passe à 35€/h (plancher).
  // Se déclenche automatiquement selon l'heure de début choisie.
  const NIGHT_RATE = 35;
  const NIGHT_FROM = 21; // heure de bascule (21h)
  const startHour = sel.time ? parseInt(sel.time.slice(0, 2), 10) : null;
  const isHourly = !!product && product.billing === 'hourly';
  const isNight = isHourly && startHour !== null && startHour >= NIGHT_FROM;
  const hourlyRate = isHourly ? (isNight ? Math.max(product.prix, NIGHT_RATE) : product.prix) : null;
  const baseTotal = product ? (isHourly ? hourlyRate * sel.hours : product.prix) : 0;
  const total = baseTotal + addTotal;

  // Skip step 2 si produit n'a pas besoin de date
  const skipDate = product && !product.needsDate;
  const steps = ['Produit', 'Date & Heure', 'Options', 'Paiement', 'Confirmation'];

  const goNext = () => {
    if (step === 1 && skipDate) setStep(3);
    else setStep((s) => s + 1);
  };
  const goBack = () => {
    if (step === 3 && skipDate) setStep(1);
    else setStep((s) => Math.max(1, s - 1));
  };

  // Build calendar / Stripe summary
  const buildBookingSummary = () => {
    const startDate = sel.date && sel.time
      ? new Date(`${sel.date}T${sel.time}:00`)
      : null;
    return {
      productLabel: product?.label || '—',
      date: sel.date,
      time: sel.time,
      hours: sel.hours,
      addons: sel.addons.map((id) => addonsOpts.find((a) => a.id === id)?.label).filter(Boolean),
      total,
      startDate,
    };
  };

  const handlePayWithStripe = () => {
    if (!contactValid) return;
    const summary = buildBookingSummary();
    const productKey = product?.stripeKey || product?.id;
    const hasDate = summary.date && summary.time;
    const addonsRef = (sel.addons || []).join('.');
    // Réf encodée (sert aussi au recalcul prix serveur). Calculée avant tout pour le lead.
    const ref = hasDate
      ? `B~${summary.date}~${String(summary.time).replace(':', '')}~${summary.hours || 2}~${productKey}~${addonsRef}`
      : `M~${productKey}`;
    // 1) On enregistre le prospect + la commande dans HubSpot (non bloquant).
    postLead({
      type: 'reservation',
      firstName: contact.firstName.trim(),
      lastName: contact.lastName.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
      artist: contact.artist.trim(),
      project: contact.project.trim(),
      productLabel: summary.productLabel,
      productId: product?.id || '',
      date: summary.date || '',
      time: summary.time || '',
      hours: product?.billing === 'hourly' ? (summary.hours || null) : null,
      addons: summary.addons,
      total: summary.total,
      ref,
    });
    // 2) Session Stripe dynamique = montant exact (durée incluse). On ouvre la fenêtre
    // tout de suite (geste utilisateur, anti-popup-blocker) puis on y charge l'URL.
    if (URBE_CONFIG.paymentMode === 'live' && URBE_CONFIG.sessionWebhook) {
      const payWin = window.open('', '_blank');
      // Le prix est recalculé côté serveur (n8n) d'après la réf — le total client n'est qu'indicatif.
      fetch(URBE_CONFIG.sessionWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Urbe-Key': URBE_WEBHOOK_KEY },
        body: JSON.stringify({ productLabel: summary.productLabel, ref, email: contact.email.trim(), name: `${contact.firstName.trim()} ${contact.lastName.trim()}`.trim() }),
      }).then((r) => r.json()).then((d) => {
        if (d && d.url) { if (payWin) payWin.location.href = d.url; else window.location.href = d.url; }
        else { if (payWin) payWin.close(); redirectToStripe(productKey, summary); }
      }).catch(() => { if (payWin) payWin.close(); redirectToStripe(productKey, summary); });
    } else {
      redirectToStripe(productKey, summary);
    }
    // Enregistre la réservation dans l'espace membre
    if (typeof urbeAuth !== 'undefined') {
      urbeAuth.addBooking({ productLabel: summary.productLabel, date: summary.date, time: summary.time, hours: summary.hours, total: summary.total, billing: product?.billing, addons: summary.addons });
    }
    // L'événement agenda + l'email de confirmation sont créés APRÈS paiement réel,
    // par le webhook Stripe (plus de réservation fantôme si le client abandonne).
    setStep(5);
  };

  const handleAddToGcal = () => {
    const summary = buildBookingSummary();
    if (!summary.startDate) {
      // Pas de date → ouvrir le calendrier studio s'il existe, sinon ne rien faire de trompeur
      if (URBE_CONFIG.gcal.embedSrc) window.open(URBE_CONFIG.gcal.embedSrc, '_blank', 'noopener,noreferrer');
      return;
    }
    const url = buildGCalAddLink({
      title: `Urbe Studio · ${summary.productLabel}`,
      date: summary.date,
      time: summary.time,
      hours: product?.billing === 'hourly' ? sel.hours : 2,
      description: `Réservation Urbe Studio\nProduit : ${summary.productLabel}\nTotal : ${summary.total}€\n\n${URBE_CONFIG.gcal.location}`,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadICS = () => {
    const summary = buildBookingSummary();
    if (!summary.startDate) return;
    const url = buildICSDataUrl({
      title: `Urbe Studio · ${summary.productLabel}`,
      date: summary.date,
      time: summary.time,
      hours: product?.billing === 'hourly' ? sel.hours : 2,
      description: `Réservation Urbe Studio · Total ${summary.total}€`,
    });
    const a = document.createElement('a');
    a.href = url;
    a.download = `urbe-studio-${summary.date || 'reservation'}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  // Produits en exergue + reste groupé par catégorie (catégories déroulantes)
  const featuredProducts = BOOKING_CATALOG.filter((p) => p.featured);
  const groupedCatalog = BOOKING_CATALOG.filter((p) => !p.featured).reduce((acc, p) => {
    (acc[p.cat] = acc[p.cat] || []).push(p);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: '100vh', paddingTop: 60 }}>
      {/* Hero booking */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--br)', padding: '48px 28px 0' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 56, letterSpacing: '0.02em', lineHeight: 0.95, marginBottom: 8 }}>RÉSERVER UNE SESSION</h1>
          <p style={{ fontSize: 14, color: 'var(--dim)', fontWeight: 300, marginBottom: 36 }}>Choisis ton service, sélectionne un créneau et finalise en ligne.</p>

          {/* Progress */}
          <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 0 }}>
            {steps.map((l, i) => {
              const n = i + 1;const done = step > n;const active = step === n;
              return (
                <div key={l} style={{ display: 'flex', alignItems: 'center', flex: i < 4 ? 1 : 'none' }}>
                  <button onClick={() => n < step && !(n === 2 && skipDate) && setStep(n)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '18px 0', background: 'none', border: 'none',
                    cursor: n < step ? 'pointer' : 'default', flexShrink: 0, borderBottom: active ? '2px solid var(--rouge)' : '2px solid transparent'
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${done || active ? 'var(--rouge)' : 'var(--br2)'}`, background: done ? 'var(--rouge)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: done ? '#fff' : active ? 'var(--rouge)' : 'var(--dim)', flexShrink: 0 }}>{done ? '✓' : n}</div>
                    <span className="urbe-step-label" style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, color: active ? 'var(--blanc)' : 'var(--dim)', whiteSpace: 'nowrap' }}>{l}</span>
                  </button>
                  {i < 4 && <div style={{ flex: 1, height: 1, background: done ? 'var(--rouge)' : 'var(--br)', margin: '0 10px' }} />}
                </div>);

            })}
          </div>
        </div>
      </div>

      <div className="urbe-booking-grid" style={{ maxWidth: 1040, margin: '0 auto', padding: '44px 28px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 28 }}>
        <div>
          {/* STEP 1 — Produit (catalogue complet) */}
          {step === 1 &&
          <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Que voulez-vous réserver ?</h2>
              <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 26, fontWeight: 300 }}>Nos prestations phares, ou parcourez le catalogue complet par catégorie.</p>

              {/* Produits en exergue */}
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 12 }}>Les plus demandés</div>
              <div className="urbe-featured-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
                {featuredProducts.map((p) => {
                  const actif = sel.productId === p.id;
                  return (
                    <div key={p.id} onClick={() => setSel((s) => ({ ...s, productId: p.id }))} {...cardKeys(() => setSel((s) => ({ ...s, productId: p.id })))} aria-pressed={actif} aria-label={`${p.label} — ${p.prix}€`} style={{
                      position: 'relative', overflow: 'hidden',
                      border: `1.5px solid ${actif ? 'var(--rouge)' : 'rgba(193,44,44,0.34)'}`,
                      borderRadius: 16, padding: '18px 18px 17px', cursor: 'pointer',
                      background: actif ? 'rgba(139,30,30,0.1)' : 'var(--s1)',
                      display: 'flex', flexDirection: 'column', transition: 'all 0.18s'
                    }}
                    onMouseEnter={(e) => { if (!actif) e.currentTarget.style.borderColor = 'var(--rouge)'; }}
                    onMouseLeave={(e) => { if (!actif) e.currentTarget.style.borderColor = 'rgba(193,44,44,0.34)'; }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 60% at 50% 0%, rgba(139,30,30,0.13), transparent 70%)', pointerEvents: 'none' }} />
                      {p.badge && <div style={{ position: 'relative', alignSelf: 'flex-start', whiteSpace: 'nowrap', marginBottom: 12, padding: '4px 11px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{p.badge}</div>}
                      <div style={{ position: 'relative', marginBottom: 16 }}>
                        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 19, letterSpacing: '0.01em', lineHeight: 1.2, minHeight: 46, marginBottom: 6 }}>{p.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 300, lineHeight: 1.45 }}>{p.desc}</div>
                      </div>
                      <div style={{ position: 'relative', marginTop: 'auto' }}>
                        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 30, color: actif ? 'var(--rouge3)' : 'var(--blanc)', lineHeight: 1 }}>{p.prix}€</div>
                        <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>{p.unit}</div>
                      </div>
                      {actif && <div style={{ position: 'absolute', top: 14, right: 14, width: 20, height: 20, borderRadius: '50%', background: 'var(--rouge)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="11" height="9" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
                    </div>);
                })}
              </div>

              {/* Catalogue complet — catégories déroulantes */}
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 12 }}>Catalogue complet</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(groupedCatalog).map(([cat, items]) => {
                  const isOpen = openCat === cat;
                  const hasActive = items.some((it) => it.id === sel.productId);
                  return (
                    <div key={cat} style={{ border: `1px solid ${isOpen ? 'var(--br2)' : 'var(--br)'}`, borderRadius: 14, overflow: 'hidden', background: isOpen ? 'rgba(0,0,0,0.18)' : 'transparent', transition: 'border-color 0.2s, background 0.2s' }}>
                      <button onClick={() => setOpenCat(isOpen ? null : cat)} aria-expanded={isOpen} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: hasActive ? 'var(--rouge3)' : (isOpen ? 'var(--blanc)' : 'rgba(241,236,231,0.25)') }} />
                        <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: isOpen ? 'var(--blanc)' : 'var(--dim)' }}>{cat}</span>
                        <span style={{ fontSize: 11, color: 'var(--dim)' }}>{items.length}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M6 9l6 6 6-6" stroke="var(--dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                      {isOpen &&
                        <div className="urbe-cat-grid" style={{ padding: '0 14px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {items.map((p) => {
                            const actif = sel.productId === p.id;
                            return (
                              <div key={p.id} onClick={() => setSel((s) => ({ ...s, productId: p.id }))} {...cardKeys(() => setSel((s) => ({ ...s, productId: p.id })))} aria-pressed={actif} aria-label={`${p.label} — ${p.prix}€`} style={{
                                border: `1.5px solid ${actif ? 'var(--rouge)' : 'var(--br)'}`,
                                borderRadius: 12, padding: '13px 15px', cursor: 'pointer',
                                background: actif ? 'rgba(139,30,30,0.08)' : 'var(--s1)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, transition: 'all 0.18s'
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{p.label}</div>
                                  <div style={{ fontSize: 11.5, color: 'var(--dim)', fontWeight: 300, lineHeight: 1.4 }}>{p.desc}</div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 23, color: actif ? 'var(--rouge3)' : 'var(--blanc)', lineHeight: 1 }}>{p.prix}€</div>
                                  <div style={{ fontSize: 10, color: 'var(--dim)' }}>{p.unit}</div>
                                </div>
                              </div>);
                          })}
                        </div>
                      }
                    </div>);
                })}
              </div>
              <button onClick={() => sel.productId && goNext()} disabled={!sel.productId} style={{ marginTop: 22, padding: '12px 28px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: sel.productId ? 'pointer' : 'not-allowed', opacity: sel.productId ? 1 : 0.4 }}>Continuer →</button>
            </div>
          }

          {/* STEP 2 — Date & Heure (Google Calendar) */}
          {step === 2 &&
          <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Date & horaire</h2>
              <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 18, fontWeight: 300 }}>Choisissez un créneau — nous confirmons votre réservation sous 24h.</p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(58,209,122,0.06)', border: '1px solid rgba(58,209,122,0.25)', borderRadius: 10, marginBottom: 22 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="#3ad17a" strokeWidth="1.5"/><path d="M3 9h18M8 3v4M16 3v4" stroke="#3ad17a" strokeWidth="1.5" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 12, color: '#3ad17a', fontWeight: 500 }}>{slotsLoaded ? 'Créneaux libres en temps réel · confirmation sous 24h' : 'Chargement des disponibilités…'}</span>
              </div>

              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 12 }}>14 prochains jours <span style={{ color: 'var(--rouge3)', fontWeight: 500 }}>· min. 24h à l'avance</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                  {nextDays.map((d) => {
                    const k = dateKey(d);
                    return (
                      <button key={k} onClick={() => setSel((p) => ({ ...p, date: k, time: null }))} className="urbe-tap" style={{ padding: '10px 4px', borderRadius: 8, background: sel.date === k ? 'var(--rouge)' : 'var(--s1)', color: sel.date === k ? '#fff' : 'var(--dim)', border: `1px solid ${sel.date === k ? 'var(--rouge)' : 'var(--br)'}`, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{jourLabel(d)}</button>);
                  })}
                </div>
              </div>

              {sel.date &&
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 12 }}>Heure de début <span style={{ color: 'var(--rouge3)', fontWeight: 500 }}>· créneaux libres</span></div>
                  {heuresLibres.length > 0 ?
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {heuresLibres.map((h) =>
                      <button key={h} onClick={() => setSel((p) => ({ ...p, time: h }))} className="urbe-tap" style={{ padding: '10px 16px', borderRadius: 8, background: sel.time === h ? 'var(--rouge)' : 'var(--s1)', color: sel.time === h ? '#fff' : 'var(--dim)', border: `1px solid ${sel.time === h ? 'var(--rouge)' : 'var(--br)'}`, fontFamily: 'Space Mono', fontSize: 12, cursor: 'pointer' }}>{h}</button>
                    )}
                  </div> :
                  <div style={{ fontSize: 13, color: 'var(--dim)', fontWeight: 300, padding: '8px 0' }}>{slotsLoaded ? 'Aucun créneau disponible (complet ou trop proche — réservation min. 24h à l\'avance). Choisis une autre date. 🙏' : 'Chargement des créneaux…'}</div>
                  }
                </div>
              }

              {sel.time && product && product.billing === 'hourly' &&
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 12 }}>Durée <span style={{ color: 'var(--rouge3)', fontWeight: 500 }}>· 2h minimum</span></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {durees.map((h) =>
                      <button key={h} onClick={() => setSel((p) => ({ ...p, hours: h }))} className="urbe-tap" style={{ padding: '10px 20px', borderRadius: 8, background: sel.hours === h ? 'var(--rouge)' : 'var(--s1)', color: sel.hours === h ? '#fff' : 'var(--dim)', border: `1px solid ${sel.hours === h ? 'var(--rouge)' : 'var(--br)'}`, fontFamily: 'Barlow Condensed', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>{h}h</button>
                    )}
                  </div>
                  {/* Bannière tarif nuit — apparaît automatiquement à partir de 21h */}
                  {isNight &&
                    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(139,30,30,0.1)', border: '1px solid var(--rouge)', borderRadius: 10 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="var(--rouge3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blanc)', marginBottom: 2 }}>Tarif nuit appliqué — {NIGHT_RATE}€/h</div>
                        <div style={{ fontSize: 11.5, color: 'var(--dim)', fontWeight: 300 }}>Créneau à partir de 21h · {NIGHT_RATE}€ × {sel.hours}h = <strong style={{ color: 'var(--rouge3)' }}>{hourlyRate * sel.hours}€</strong></div>
                      </div>
                    </div>
                  }
                  {!isNight &&
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--dim)', fontWeight: 300 }}>{hourlyRate}€/h × {sel.hours}h = <strong style={{ color: 'var(--blanc)' }}>{hourlyRate * sel.hours}€</strong> · tarif nuit ({NIGHT_RATE}€/h) automatique dès 21h.</div>
                  }
                </div>
              }

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={goBack} style={{ padding: '12px 22px', borderRadius: 100, background: 'none', color: 'var(--dim)', border: '1px solid var(--br)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>← Retour</button>
                <button onClick={() => sel.date && sel.time && setStep(3)} disabled={!sel.date || !sel.time} style={{ padding: '12px 28px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: sel.date && sel.time ? 'pointer' : 'not-allowed', opacity: sel.date && sel.time ? 1 : 0.4 }}>Continuer →</button>
              </div>
            </div>
          }

          {/* STEP 3 — Options */}
          {step === 3 &&
          <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Options</h2>
              <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 26, fontWeight: 300 }}>Services additionnels optionnels.</p>
              <div className="urbe-options-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 26 }}>
                {addonsOpts.map((a) => {const actif = sel.addons.includes(a.id);return (
                  <div key={a.id} onClick={() => setSel((p) => ({ ...p, addons: actif ? p.addons.filter((x) => x !== a.id) : [...p.addons, a.id] }))} {...cardKeys(() => setSel((p) => ({ ...p, addons: actif ? p.addons.filter((x) => x !== a.id) : [...p.addons, a.id] })))} aria-pressed={actif} aria-label={`${a.label} +${a.prix}€`} style={{ border: `1.5px solid ${actif ? 'var(--rouge)' : 'var(--br)'}`, borderRadius: 14, padding: 20, cursor: 'pointer', background: actif ? 'rgba(139,30,30,0.08)' : 'var(--s1)', transition: 'all 0.18s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${actif ? 'var(--rouge)' : 'var(--br2)'}`, background: actif ? 'var(--rouge)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {actif && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</span>
                    </div>
                    {a.desc && <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.45, fontWeight: 300, marginBottom: 10 }}>{a.desc}</div>}
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 30, color: actif ? 'var(--rouge3)' : 'var(--blanc)' }}>+{a.prix}€<span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}> forfait</span></div>
                  </div>);
              })}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={goBack} style={{ padding: '12px 22px', borderRadius: 100, background: 'none', color: 'var(--dim)', border: '1px solid var(--br)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>← Retour</button>
                <button onClick={() => setStep(4)} style={{ padding: '12px 28px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Continuer →</button>
              </div>
            </div>
          }

          {/* STEP 4 — Paiement Stripe */}
          {step === 4 &&
          <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Vos informations & paiement</h2>
              <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 24, fontWeight: 300 }}>On a besoin de ces infos pour préparer ta session et t'envoyer ta confirmation. Le paiement est ensuite traité par Stripe.</p>

              {/* Collecte d'identité → HubSpot (CRM) */}
              <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 22, marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--dim)', textTransform: 'uppercase', marginBottom: 16 }}>Tes coordonnées</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div><label style={labelStyle}>Prénom *</label><input value={contact.firstName} onChange={setC('firstName')} placeholder="Prénom" autoComplete="given-name" style={champStyle} /></div>
                  <div><label style={labelStyle}>Nom *</label><input value={contact.lastName} onChange={setC('lastName')} placeholder="Nom" autoComplete="family-name" style={champStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div><label style={labelStyle}>Email *</label><input type="email" value={contact.email} onChange={setC('email')} placeholder="toi@email.com" autoComplete="email" style={{ ...champStyle, borderColor: contact.email && !emailOk ? 'var(--rouge)' : 'var(--br)' }} /></div>
                  <div><label style={labelStyle}>Téléphone *</label><input type="tel" value={contact.phone} onChange={setC('phone')} placeholder="06 12 34 56 78" autoComplete="tel" style={champStyle} /></div>
                </div>
                <div style={{ marginBottom: 12 }}><label style={labelStyle}>Nom d'artiste</label><input value={contact.artist} onChange={setC('artist')} placeholder="Ton blaze / nom de scène" style={champStyle} /></div>
                <div><label style={labelStyle}>Projet musical</label><textarea value={contact.project} onChange={setC('project')} placeholder="Quelques mots sur ton projet (style, nb de titres, deadline…)" rows={3} style={{ ...champStyle, resize: 'vertical', lineHeight: 1.5 }} /></div>
                {!contactValid && (contact.firstName || contact.lastName || contact.email || contact.phone) &&
                  <div style={{ fontSize: 11.5, color: 'var(--rouge3)', marginTop: 10 }}>Prénom, nom, email valide et téléphone sont requis pour continuer.</div>}
              </div>

              <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 24, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--br)' }}>
                  <svg width="38" height="24" viewBox="0 0 60 25" fill="#635BFF"><path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-8.08-2.75h4.34c0-1.84-1.07-2.6-2.13-2.6-1.09 0-2.21.76-2.21 2.6zM44.05 5.47c-1.4 0-2.31.66-2.82 1.12l-.19-.89h-3.7v18.96l4.21-.89.01-4.6c.6.43 1.5 1.04 2.97 1.04 3.01 0 5.76-2.42 5.76-7.77-.01-4.9-2.79-7.97-6.25-6.97zM44 17.84c-.99 0-1.57-.35-1.97-.79l-.03-6.24c.43-.48 1.02-.82 2-.82 1.53 0 2.59 1.72 2.59 3.91 0 2.25-1.04 3.94-2.59 3.94zM36.16 4.47l-4.23.9v3.43l4.23-.9zM31.93 9.6h4.23v11.32h-4.23zM27.4 10.85l-.27-1.25h-3.64v11.32h4.21v-7.67c.99-1.3 2.67-1.06 3.19-.87V9.6c-.54-.2-2.5-.57-3.49 1.25zM18.97 6.78l-4.11.88-.02 13.5c0 2.5 1.87 4.33 4.36 4.33 1.38 0 2.39-.25 2.95-.55v-3.42c-.54.22-3.2 1-3.2-1.5v-4.59h3.2V9.6h-3.2zM9.39 9.6H5.16v11.32h4.23zM9.39 4.47l-4.23.9v3.43l4.23-.9zM4.96 13.04c0-.66.54-.92 1.44-.92 1.29 0 2.92.39 4.21 1.09V9.27a11.2 11.2 0 0 0-4.21-.77c-3.44 0-5.73 1.8-5.73 4.8 0 4.68 6.44 3.94 6.44 5.96 0 .78-.68 1.03-1.63 1.03-1.41 0-3.2-.58-4.62-1.36v4.01a11.73 11.73 0 0 0 4.62.96c3.53 0 5.96-1.75 5.96-4.79-.01-5.05-6.48-4.16-6.48-6.07z"/></svg>
                  <span style={{ fontSize: 12.5, color: 'var(--dim)', fontWeight: 300 }}>Cartes, Apple Pay, Google Pay & paiement en plusieurs fois acceptés.</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sel.date && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--dim)' }}>Date</span><span style={{ fontWeight: 600 }}>{sel.date} · {sel.time}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--dim)' }}>{product?.label}{isHourly ? ` · ${hourlyRate}€/h × ${sel.hours}h${isNight ? ' (nuit)' : ''}` : ''}</span><span style={{ fontWeight: 600 }}>{baseTotal}€</span></div>
                  {sel.addons.map((id) => { const a = addonsOpts.find((x) => x.id === id); return a ? <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--dim)' }}>{a.label}</span><span style={{ fontWeight: 600 }}>+{a.prix}€</span></div> : null; })}
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>🔒 Connexion chiffrée · TVA 20% incluse · facture envoyée par email</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={goBack} style={{ padding: '12px 22px', borderRadius: 100, background: 'none', color: 'var(--dim)', border: '1px solid var(--br)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>← Retour</button>
                <button onClick={handlePayWithStripe} disabled={!contactValid} style={{ flex: 1, padding: 14, borderRadius: 8, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: contactValid ? 'pointer' : 'not-allowed', opacity: contactValid ? 1 : 0.45, boxShadow: contactValid ? '0 8px 28px rgba(139,30,30,0.4)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  Payer {total}€ avec Stripe
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M17 7H8M17 7v9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          }

          {/* STEP 5 — Confirmation + Google Calendar */}
          {step === 5 &&
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(58,209,122,0.12)', border: '1.5px solid #3ad17a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 28, color: '#3ad17a' }}>✓</div>
              <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>Demande envoyée !</h2>
              <p style={{ fontSize: 14, color: 'var(--dim)', lineHeight: 1.7, marginBottom: 8, fontWeight: 300 }}>Finalise ton paiement dans l'onglet Stripe ouvert à côté. Dès le paiement validé, tu reçois ta confirmation par email et ton créneau est réservé.</p>
              {sel.date && <p style={{ fontSize: 14, color: 'var(--blanc)', lineHeight: 1.7, marginBottom: 30, fontWeight: 500 }}>{product?.label} · {sel.date} à {sel.time}{product?.billing === 'hourly' ? ` · ${sel.hours}h` : ''}</p>}
              {!sel.date && <p style={{ fontSize: 14, color: 'var(--blanc)', marginBottom: 30, fontWeight: 500 }}>{product?.label} · {total}€</p>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
                <button onClick={handleAddToGcal} style={{ padding: '12px 22px', borderRadius: 100, background: 'var(--s1)', color: 'var(--blanc)', border: '1px solid var(--br2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 3v4M16 3v4M12 13v4M10 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Ajouter à Google Agenda
                </button>
                {sel.date &&
                  <button onClick={handleDownloadICS} style={{ padding: '12px 22px', borderRadius: 100, background: 'none', color: 'var(--dim)', border: '1px solid var(--br)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Télécharger .ics</button>
                }
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => { setStep(1); setSel({ productId: null, date: null, time: null, hours: 2, addons: [] }); setContact({ firstName: '', lastName: '', email: '', phone: '', artist: '', project: '' }); }} style={{ padding: '11px 20px', borderRadius: 100, background: 'none', color: 'var(--dim)', border: '1px solid var(--br)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Nouvelle réservation</button>
                <button onClick={() => window.__urbeNav && window.__urbeNav('home')} style={{ padding: '11px 22px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Retour à l'accueil</button>
              </div>
            </div>
          }
        </div>

        {/* Sidebar récap */}
        {step < 5 &&
        <div style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 14, padding: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dim)', marginBottom: 18 }}>Récapitulatif</div>
            {product && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 3 }}>Produit</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{product.label}</div></div>}
            {sel.date && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 3 }}>Date</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{sel.date} · {sel.time}</div></div>}
            {product && product.billing === 'hourly' && sel.date && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 3 }}>Durée</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{sel.hours} heures <span style={{ color: 'var(--dim)', fontWeight: 400 }}>· {hourlyRate}€/h</span>{isNight && <span style={{ marginLeft: 6, padding: '2px 7px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Nuit</span>}</div></div>}
            {sel.addons.length > 0 && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 10, color: 'var(--dim)', marginBottom: 3 }}>Options</div>{sel.addons.map((id) => <div key={id} style={{ fontSize: 12.5, fontWeight: 500 }}>{addonsOpts.find((a) => a.id === id)?.label}</div>)}</div>}
            <div style={{ borderTop: '1px solid var(--br)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>Total</span>
              <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 34, color: 'var(--rouge3)', lineHeight: 1 }}>{total > 0 ? `${total}€` : '—'}</span>
            </div>
          </div>
          <p style={{ fontSize: 10.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 12, fontWeight: 300 }}>Paiement sécurisé par Stripe. Annulation gratuite jusqu'à 48h avant la session.</p>
        </div>
        }
      </div>
    </div>);

}

/* ─── CREDITS PAGE ───────────────────────────────────────────── */
function CreditsPage() {
  const [tab, setTab] = useState('studio');
  const [selected, setSelected] = useState(null);

  // Productions Studio — artistes passés au studio (pas de prods solo)
  const studio = [
  { nom: 'NONO LA GRINTA', type: 'Composition · Rec', img: 'covers/nono.jpg', spotify: '6CcoMrijDlPb1bDJxwvlCK' },
  { nom: 'SHERIFF LA ZONE', type: 'Composition · Rec', img: 'covers/sheriff.jpg', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'NAHIR', type: 'Rec', img: 'covers/c/nahir.png', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'RICKY BISHOP', type: 'Composition · Rec', img: 'covers/c/bishop.png', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'ASIKI', type: 'Composition · Rec', img: 'covers/c/asiki.png', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'SOMYKE', type: 'Composition · Rec', img: 'covers/c/somyke.png', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'RYFLO', type: 'Composition · Rec', img: 'covers/c/ryflo.png', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'SAKI225', type: 'Composition · Rec', img: 'covers/saki225.jpg', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: '63KLUF', type: 'Composition · Rec', img: 'covers/63kluf.jpg', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'BERNA', type: 'Rec', img: 'covers/berna.jpg', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'GOTTI MARRAS', type: 'Composition · Rec', img: 'covers/gotti.jpg', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'MAX DLG', type: 'Composition · Rec', img: 'covers/c/maxdlg.png', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'GEMEN', type: 'Rec', img: 'covers/gemen.jpg', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'CASH DICO × WESTSIDEBOOGIE', type: 'Comp · Rec · Mix/Master', img: 'covers/cashdico.jpg', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'TITI33', type: 'Comp · Rec · Mix/Master', img: 'covers/titi33.jpg', spotify: '4iJyoBOLtHqaGxP12qzhQI' },
  { nom: 'DETOX', type: 'Mix · Master', img: 'covers/detox.jpg', spotify: '4iJyoBOLtHqaGxP12qzhQI' }];


  // Son à l'image — voix off, pub, doc, podcast
  const sonImage = [
  { nom: 'EMMANUEL GREGOIRE', type: 'Voix Off · Direction artistique', img: 'covers/c/gregoire.png' }];


  const list = tab === 'studio' ? studio : sonImage;

  return (
    <div style={{ minHeight: '100vh', paddingTop: 60 }}>
      <div style={{ padding: '56px 28px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 10 }}>2024 · 2025</div>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(44px,6vw,72px)', letterSpacing: '0.02em', marginBottom: 14 }}>
            CRÉDITS <span style={{ color: 'transparent', WebkitTextStroke: '1px var(--br2)' }}></span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--dim)', marginBottom: 32, maxWidth: 620, lineHeight: 1.6 }}>Une sélection des artistes passés au studio et de nos productions maison.

          </p>

          {/* Tabs */}
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 100, marginBottom: 36 }}>
            {[{ k: 'studio', l: 'Crédits Musique', n: studio.length }, { k: 'solo', l: "Son à l'image", n: sonImage.length }].map((t) =>
            <button key={t.k} onClick={() => setTab(t.k)} style={{ background: tab === t.k ? 'var(--rouge)' : 'transparent', color: tab === t.k ? '#fff' : 'var(--dim)', border: 'none', padding: '9px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}>
                {t.l}
                <span style={{ fontSize: 11, opacity: 0.7 }}>{t.n}</span>
              </button>
            )}
          </div>

          <div className="urbe-r-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 56 }}>
            {list.map((a) =>
            <div key={a.nom} onClick={() => setSelected(a)} {...cardKeys(() => setSelected(a))} aria-label={`${a.nom} — voir le crédit`} style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', aspectRatio: '1/1', borderRadius: '14px', background: '#0a0a0a', transition: 'transform 0.3s, box-shadow 0.3s' }}
            onMouseEnter={(e) => {e.currentTarget.style.transform = 'translateY(-4px)';e.currentTarget.style.boxShadow = '0 20px 48px rgba(0,0,0,0.6)';const ov = e.currentTarget.querySelector('[data-ov]');if (ov) ov.style.opacity = '1';}}
            onMouseLeave={(e) => {e.currentTarget.style.transform = 'none';e.currentTarget.style.boxShadow = 'none';const ov = e.currentTarget.querySelector('[data-ov]');if (ov) ov.style.opacity = '0';}}>
                <img src={R(a.img)} alt={a.nom} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div data-ov style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(5,5,5,0.95) 100%)', opacity: 0, transition: 'opacity 0.25s', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{a.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 300 }}>{a.type}</div>
                  {a.spotify &&
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, color: '#1DB954', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.56.3z" /></svg>
                      Écouter
                    </div>
                }
                </div>
              </div>
            )}
          </div>

          {/* Mix CTA inline */}
          <div style={{ marginTop: 56 }}>
            <MixCtaSection tone="dark" />
          </div>

          {/* ── PLAYLIST SPOTIFY · Leurs crédits ─────────────────── */}
          <div style={{ marginTop: 56, paddingTop: 44, borderTop: '1px solid var(--br)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#1DB954', boxShadow: '0 0 0 4px rgba(29,185,84,0.18)', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '0.18em', color: '#1DB954', textTransform: 'uppercase', fontWeight: 700 }}>Playlist officielle · Spotify</span>
                </div>
                <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(30px,3.6vw,46px)', letterSpacing: '0.02em', lineHeight: 0.95 }}>
                  NOS CRÉDITS <span style={{ color: 'transparent', WebkitTextStroke: '1px var(--br2)' }}></span>
                </h2>
                <p style={{ fontSize: 14, color: 'var(--dim)', fontWeight: 300, marginTop: 12, maxWidth: 520, lineHeight: 1.6 }}>Les sons sur lesquels nos équipes ont travaillé 

                </p>
              </div>
              <a href="https://open.spotify.com/playlist/47SYmVwSFHwMFFScujjiul" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 100, background: 'none', border: '1px solid var(--br2)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.2s' }}
              onMouseEnter={(e) => {e.currentTarget.style.borderColor = '#1DB954';e.currentTarget.style.color = '#1DB954';}}
              onMouseLeave={(e) => {e.currentTarget.style.borderColor = 'var(--br2)';e.currentTarget.style.color = 'var(--dim)';}}>
                Ouvrir dans Spotify ↗
              </a>
            </div>
            <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--br)', boxShadow: '0 20px 48px rgba(0,0,0,0.5)', background: '#121212' }}>
              <ThirdPartyEmbed label="Spotify" height={352}>
              <iframe
                title="Urbe Studio — Leurs crédits"
                src="https://open.spotify.com/embed/playlist/47SYmVwSFHwMFFScujjiul?utm_source=generator&theme=0"
                width="100%" height="352" frameBorder="0" loading="lazy"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                style={{ border: 'none', display: 'block' }} />
              </ThirdPartyEmbed>
            </div>
            <div style={{ fontFamily: 'Space Mono', fontSize: 11, letterSpacing: '0.1em', color: 'var(--dim)', textAlign: 'center', marginTop: 16, fontStyle: 'italic' }}>
              Connectez-vous à Spotify pour l'écoute complète. Sinon, extraits de 30 secondes.
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selected &&
      <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: '22px', maxWidth: 520, width: '100%', overflow: 'hidden', position: 'relative' }}>
            <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--br2)', color: 'var(--blanc)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, backdropFilter: 'blur(6px)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            <div style={{ position: 'relative', aspectRatio: '1/1', background: '#0a0a0a' }}>
              <img src={R(selected.img)} alt={selected.nom} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(5,5,5,0.95) 100%)' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 6 }}>{selected.type}</div>
                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 32, letterSpacing: '0.02em', lineHeight: 1, color: '#fff' }}>{selected.nom}</div>
              </div>
            </div>
            {selected.spotify ?
          <div style={{ padding: 20 }}>
                <ThirdPartyEmbed label="Spotify" height={152}>
                <iframe
              title={selected.nom}
              src={`https://open.spotify.com/embed/track/${selected.spotify}?theme=0`}
              width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"
              style={{ borderRadius: 12, border: 'none', display: 'block' }} />
                </ThirdPartyEmbed>
              </div> :

          <div style={{ padding: '20px 24px 24px', fontSize: 13, color: 'var(--dim)', fontWeight: 300, lineHeight: 1.6 }}>Pas d'extrait disponible publiquement.</div>
          }
          </div>
        </div>
      }
    </div>);

}

/* ─── SCHOOL PAGE ────────────────────────────────────────────── */
function SchoolPage({ setPage }) {
  return (
    <div style={{ minHeight: '100vh', paddingTop: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(139,30,30,0.1), transparent)' }} />
      <div style={{ position: 'absolute', fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: '28vw', color: 'transparent', WebkitTextStroke: '1px rgba(241,236,231,0.03)', lineHeight: 1, userSelect: 'none', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', whiteSpace: 'nowrap' }}>SCHOOL</div>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: '0 28px', maxWidth: 680 }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '28px 0 22px' }}>
          <div style={{ width: 36, height: 1.5, background: 'var(--rouge)', borderRadius: 2 }} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--rouge3)', textTransform: 'uppercase' }}>Formation Audio · Plateforme dédiée</span>
          <div style={{ width: 36, height: 1.5, background: 'var(--rouge)', borderRadius: 2 }} />
        </div>
        <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 'clamp(72px,12vw,130px)', lineHeight: 0.88, letterSpacing: '0.01em', marginBottom: 30 }}>
          URBE<br /><span style={{ color: 'var(--rouge3)' }}>SCHOOL</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--dim)', lineHeight: 1.75, marginBottom: 44, fontWeight: 300 }}>Plateforme de formation dédiée aux métiers du son. Cours filmés en studio, certifications reconnues, enseignants issus de l'industrie musicale.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div aria-disabled="true" title="Le site dédié ouvre prochainement" style={{ background: 'var(--s1)', color: 'var(--blanc)', border: '1px solid var(--br2)', padding: '14px 30px', borderRadius: 100, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 9, cursor: 'not-allowed' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="var(--rouge3)" strokeWidth="1.8"/><path d="M8 11V8a4 4 0 018 0v3" stroke="var(--rouge3)" strokeWidth="1.8"/></svg>
            Site bientôt disponible
          </div>
          <button onClick={() => setPage && setPage('contact')} style={{ background: 'var(--rouge)', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: 100, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 28px rgba(139,30,30,0.35)' }}>S’informer
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 44, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>Le site dédié <span style={{ color: 'var(--blanc)' }}>urbe-school.fr</span> ouvre prochainement. Écris-nous pour être prévenu·e du lancement ou en savoir plus sur les formations.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', border: '1px solid var(--br)', borderRadius: '14px', maxWidth: 420, margin: '0 auto', overflow: 'hidden' }}>
          {[['2026', 'Ouverture'], ['Studio', 'Cours filmés'], ['Pro', 'Enseignants']].map(([n, l], i) =>
          <div key={l} style={{ padding: '20px 16px', borderRight: i < 2 ? '1px solid var(--br)' : 'none', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 28 }}>{n}</div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>{l}</div>
            </div>
          )}
        </div>
      </div>
    </div>);

}

/* ─── CONTACT PAGE ───────────────────────────────────────────── */
function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ nom: '', email: '', type: '', message: '' });
  const [errors, setErrors] = useState({});
  const upd = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const fieldStyle = (k) => ({ width: '100%', background: 'var(--s1)', border: `1px solid ${errors[k] ? 'var(--rouge3)' : 'var(--br)'}`, color: 'var(--blanc)', fontSize: 14, padding: '11px 14px', borderRadius: '8px', outline: 'none' });
  const validate = () => {
    const e = {};
    if (!form.nom.trim()) e.nom = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = true;
    if (!form.message.trim()) e.message = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const submit = () => {
    if (!validate()) return;
    // Capture le lead dans le CRM via n8n. Repli mailto uniquement si le webhook échoue.
    postLead({ nom: form.nom, email: form.email, type: form.type, message: form.message, source: 'Formulaire contact' }).then((ok) => {
      if (!ok) {
        const subject = `Demande de projet — ${form.nom}${form.type ? ' · ' + form.type : ''}`;
        const body = `Nom : ${form.nom}\nEmail : ${form.email}\nType de projet : ${form.type || 'Non précisé'}\n\n${form.message}`;
        mailtoBooking({ subject, body });
      }
    });
    setSent(true);
  };
  return (
    <div style={{ minHeight: '100vh', paddingTop: 60 }}>
      <div style={{ padding: '64px 28px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 12 }}>Contact</div>
        <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(48px,6vw,72px)', letterSpacing: '0.02em', marginBottom: 48 }}>PARLONS DE<br />VOTRE PROJET.</h1>
        {sent ?
        <div style={{ background: 'var(--s1)', border: '1px solid rgba(139,30,30,0.4)', borderRadius: '22px', padding: '56px 48px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Message prêt à envoyer !</div>
            <div style={{ fontSize: 14, color: 'var(--dim)' }}>Votre logiciel mail s'est ouvert avec votre demande. On te revient dans les 24h.</div>
          </div> :

        <div className="urbe-contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
              <div className="urbe-contact-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                {[{ k: 'nom', l: 'Ton nom ou ton projet', ph: 'Artiste, beatmaker…', type: 'text', ac: 'name', im: 'text' }, { k: 'email', l: 'Email', ph: 'ton@email.fr', type: 'email', ac: 'email', im: 'email' }].map((f) =>
              <div key={f.k}>
                    <label htmlFor={`contact-${f.k}`} style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--dim)', marginBottom: 7 }}>{f.l} <span style={{ color: 'var(--rouge3)' }}>*</span></label>
                    <input id={`contact-${f.k}`} name={f.k} type={f.type} inputMode={f.im} autoComplete={f.ac} required value={form[f.k]} onChange={upd(f.k)} placeholder={f.ph} style={fieldStyle(f.k)} onFocus={(e) => e.target.style.borderColor = 'var(--rouge)'} onBlur={(e) => e.target.style.borderColor = errors[f.k] ? 'var(--rouge3)' : 'var(--br)'} aria-invalid={!!errors[f.k]} />
                  </div>
              )}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="contact-type" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--dim)', marginBottom: 7 }}>Type de projet</label>
                <select id="contact-type" name="type" value={form.type} onChange={upd('type')} style={{ width: '100%', background: 'var(--s1)', border: '1px solid var(--br)', color: form.type ? 'var(--blanc)' : 'var(--dim)', fontSize: 14, padding: '11px 14px', borderRadius: '8px', outline: 'none', cursor: 'pointer' }}>
                  <option value="">Choisissez...</option>
                  <option>Enregistrement</option>
                  <option>Mixage / Mastering</option>
                  <option>Production complète</option>
                  <option>Podcast / Voix-off</option>
                  <option>Autre</option>
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="contact-message" style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--dim)', marginBottom: 7 }}>Message <span style={{ color: 'var(--rouge3)' }}>*</span></label>
                <textarea id="contact-message" name="message" rows={5} required value={form.message} onChange={upd('message')} placeholder="Décrivez votre projet..." style={{ ...fieldStyle('message'), resize: 'vertical' }} onFocus={(e) => e.target.style.borderColor = 'var(--rouge)'} onBlur={(e) => e.target.style.borderColor = errors.message ? 'var(--rouge3)' : 'var(--br)'} aria-invalid={!!errors.message} />
              </div>
              {Object.keys(errors).length > 0 && <div style={{ fontSize: 12.5, color: 'var(--rouge3)', marginBottom: 14 }}>Merci de renseigner votre nom, un email valide et un message.</div>}
              <button type="submit" className="urbe-tap" style={{ padding: '13px 32px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 28px rgba(139,30,30,0.4)', transition: 'all 0.2s' }}>Envoyer la demande →</button>
            </form>
            <div>
              {[{ l: 'Adresse', v: '37 Rue d\'Hauteville\nParis 10ème' }, { l: 'Email', v: 'contact@urbestudio.fr' }, { l: 'Horaires', v: 'Ouvert 24h/24 · 7j/7' }, { l: 'Réseaux', v: '@urbestudio' }].map((i) =>
            <div key={i.l} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--rouge3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{i.l}</div>
                  <div style={{ fontSize: 15, color: 'var(--blanc)', lineHeight: 1.6, fontWeight: 300, whiteSpace: 'pre-line' }}>{i.v}</div>
                </div>
            )}
            </div>
          </div>
        }
      </div>
    </div>);

}

/* ─── STUDIO PAGE ────────────────────────────────────────────── */
function StudioPage({ setPage }) {
  const [activeMedia, setActiveMedia] = useState(0);
  const [playing, setPlaying] = useState({});
  const [openService, setOpenService] = useState('enreg');

  const mediaSlides = [
  { type: 'photo', img: 'studio/cabine.jpg',  label: 'Salon & Régie', pos: 'center center' },
  { type: 'photo', img: 'studio/cabine2.jpg', label: 'La Cabine · Enregistrement', pos: 'center 15%' },
  { type: 'photo', bg: 'radial-gradient(ellipse 70% 60% at 60% 35%, #1a1008 0%, #080806 60%, #050505 100%)', label: 'Régie · Console & Monitoring' },
  { type: 'video', src: 'studio/session-live.mp4', label: 'Session live · Enregistrement' }];

  const videos = [
  { id: '4CpV_ymIeso', titre: 'Kei — OG Bounce', desc: '', featured: true },
  { id: 'RcbEQQVLXRQ', titre: 'TITI33 — Caramel', desc: '' }];

  const GEAR = ['Apollo Twin X', 'FC Atlantis 387', 'Neumann TLM 103', 'Focal Shape 60', 'Console & monitoring pro', 'Instruments de composition'];

  const SERVICES = [
    { id: 'enreg', titre: 'Enregistrement', prix: 'Dès 20€/h', desc: 'Prise de son en cabine acoustique avec ou sans ingénieur. Voix, instruments, podcasts, voix off.', tags: ['Voix', 'Instruments', 'Groupe', 'Podcast'], options: [{ label: 'Avec Ingénieur', prix: '30€/h', pid: 'session-avec' }, { label: 'Sans Ingénieur', prix: '20€/h', pid: 'session-sans' }, { label: 'Session de Nuit', prix: '35€/h', pid: 'session-nuit' }] },
    { id: 'mix', titre: 'Mixage', prix: '120€/titre', desc: 'Mix professionnel par titre. Acompte 50% obligatoire. Livraison stem + master stéréo.', tags: ['Stéréo', 'Stems', 'Révisions'], options: [{ label: 'Standard · 7 jours', prix: '120€', pid: 'mix-standard' }, { label: 'Urgent · 48h', prix: '170€', pid: 'mix-urgent' }] },
    { id: 'master', titre: 'Mastering', prix: '50€/titre', badge: 'Offert avec mix*', desc: 'Finition prête pour diffusion : streaming, radio ou vinyle. Loudness optimisé.', tags: ['Spotify', 'Apple Music', 'Radio', 'Vinyle'], options: [{ label: 'Mastering standard', prix: '50€', pid: 'mastering' }] },
    { id: 'compo', titre: 'Composition', prix: 'Sur devis', desc: 'Composition sur mesure. Sound design, beat, arrangement, orchestration. Du concept au produit fini.', tags: ['Beat', 'Arrangement', 'Orchestration'], options: null, ctaLabel: 'Nous contacter', ctaAction: 'contact' },
  ];

  return (
    <div style={{ minHeight: '100vh', paddingTop: 60 }}>

      {/* ── HERO SLIDER ─────────────────────────────────────────────── */}
      <section style={{ height: '72vh', minHeight: 480, position: 'relative', overflow: 'hidden' }}>
        {mediaSlides.map((m, i) =>
        <div key={i} style={{ position: 'absolute', inset: 0, opacity: activeMedia === i ? 1 : 0, transition: 'opacity 0.7s ease' }}>
            {m.src
            ? <video src={activeMedia === i ? R(m.src) : undefined} autoPlay muted loop playsInline preload="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : m.img
            ? <img src={R(m.img)} alt={m.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: m.pos || 'center center' }} />
            : <div style={{ position: 'absolute', inset: 0, background: m.bg }} />
            }
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(180deg, rgba(5,5,5,0.85) 0%, rgba(5,5,5,0.5) 50%, transparent 100%)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', background: 'linear-gradient(0deg, rgba(5,5,5,0.95) 0%, rgba(5,5,5,0.5) 40%, transparent 100%)' }} />
            {m.src && <div style={{ position: 'absolute', top: 28, right: 'calc(28px + 140px)', zIndex: 3, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 100, background: 'rgba(8,8,8,0.55)', border: '1px solid var(--br2)', backdropFilter: 'blur(8px)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rouge)', boxShadow: '0 0 8px var(--rouge)', animation: 'pulse 2s infinite' }} />
                <span style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '0.16em', color: 'var(--blanc)', fontWeight: 700 }}>LIVE</span>
              </div>}
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 28, left: 28, zIndex: 3 }}>
          <div style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(241,236,231,0.5)', marginBottom: 8 }}>{mediaSlides[activeMedia].label}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {mediaSlides.map((_, i) => <button key={i} onClick={() => setActiveMedia(i)} style={{ width: i === activeMedia ? 28 : 8, height: 3, borderRadius: 2, border: 'none', cursor: 'pointer', background: i === activeMedia ? 'var(--rouge)' : 'rgba(241,236,231,0.25)', transition: 'all 0.3s' }} />)}
          </div>
        </div>
        <button onClick={() => setActiveMedia((p) => (p - 1 + mediaSlides.length) % mediaSlides.length)} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(8,8,8,0.6)', border: '1px solid var(--br2)', color: 'var(--blanc)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', zIndex: 3 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <button onClick={() => setActiveMedia((p) => (p + 1) % mediaSlides.length)} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(8,8,8,0.6)', border: '1px solid var(--br2)', color: 'var(--blanc)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', zIndex: 3 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <div style={{ position: 'absolute', top: 28, left: 28, zIndex: 3 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 8 }}>Nos espaces</div>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(40px,5vw,64px)', letterSpacing: '0.02em', lineHeight: 0.9 }}>LE STUDIO</h1>
        </div>
      </section>

      {/* ── NOTRE STUDIO ─────────────────────────────────────────────── */}
      <section style={{ padding: '64px 28px', maxWidth: 1100, margin: '0 auto' }}>
        <div className="urbe-r-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 18, alignItems: 'stretch', marginBottom: 14 }}>

          {/* Photo gauche */}
          <div style={{ borderRadius: 18, overflow: 'hidden', position: 'relative', minHeight: 370 }}>
            <img src={R('studio/cabine.jpg')} alt="Régie Urbe" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 55%, rgba(5,5,5,0.85) 100%)' }} />
            <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 10, color: 'rgba(241,236,231,0.65)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Salon & Régie</div>
          </div>

          {/* Info centrale */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 18, padding: '34px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -16, right: -8, fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 170, color: 'rgba(139,30,30,0.05)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>A</div>
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 8 }}>Notre studio</div>
              <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 40, letterSpacing: '0.02em', lineHeight: 0.95, marginBottom: 14 }}>URBE</div>
              <p style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.7, fontWeight: 300, marginBottom: 0 }}>Cabine traitée acoustiquement, régie modulable, salon intégré. Pensé pour le rap, la pop et le podcast. Confort et confidentialité totale.</p>
            </div>
            <div style={{ position: 'relative', paddingTop: 22, borderTop: '1px solid var(--br)', marginTop: 22 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sessions dès</span>
                <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 30, color: 'var(--rouge3)', lineHeight: 1 }}>20€<span style={{ fontSize: 15, color: 'var(--dim)' }}>/h</span></span>
              </div>
            </div>
          </div>

          {/* Photo droite */}
          <div style={{ borderRadius: 18, overflow: 'hidden', position: 'relative', minHeight: 370 }}>
            <img src={R('studio/cabine2.jpg')} alt="Cabine Urbe" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 55%, rgba(5,5,5,0.85) 100%)' }} />
            <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 10, color: 'rgba(241,236,231,0.65)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>La Cabine</div>
          </div>
        </div>

        {/* Equipment bar */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.16em', textTransform: 'uppercase', flexShrink: 0 }}>Équipement</span>
          <div style={{ width: 1, height: 14, background: 'var(--br)', flexShrink: 0 }} />
          {GEAR.map(g => (
            <span key={g} style={{ padding: '3px 11px', borderRadius: 100, background: 'rgba(241,236,231,0.04)', border: '1px solid var(--br)', fontSize: 12, color: 'var(--blanc)', whiteSpace: 'nowrap' }}>{g}</span>
          ))}
        </div>
      </section>

      {/* ── SERVICES & TARIFS (formules + accordéon) ──────────────────── */}
      <section style={{ padding: '0 28px 64px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 34, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 10 }}>Ce qu'on propose</div>
            <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(36px,4.5vw,56px)', letterSpacing: '0.02em', lineHeight: 0.95 }}>SERVICES & TARIFS</h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--dim)', maxWidth: 200, textAlign: 'right', lineHeight: 1.65 }}>Studio & à distance</p>
        </div>

          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--dim)', textTransform: 'uppercase', margin: '0 0 16px' }}>Sessions studio · Un studio, trois formules</div>
        <div className="urbe-r-stack" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 14 }}>
            {[
            { id: 'A', nom: 'Avec Ingénieur', desc: 'Tu joues, il cadre. Prise de son, placement micro, direction artistique — tout est géré. Idéal pour aller vite sans se rater.', tarif: '30€/h', surface: 'Studio A · 80m²', gear: ['Apollo Twin X', 'FC Atlantis 387', 'Neumann TLM 103', 'Focal Shape 60'], featured: true },
            { id: 'B', nom: 'Sans Ingénieur', desc: 'Autonomie totale en cabine. Installation prête à l\'emploi. Ordinateur portable requis. Studio Urbe en libre accès.', tarif: '20€/h', surface: 'Studio A · 80m²', gear: ['Installation préconfigurée', 'Cabine traitée', 'Apollo Twin X', 'Ordinateur portable requis'], featured: false },
            { id: 'N', nom: 'Session de Nuit', desc: 'Après 21h, le studio est plus calme — et souvent plus inspirant. Tarif nuit, avec ingénieur, accès toute la nuit.', tarif: '35€/h', surface: 'Studio A · 80m²', gear: ['Avec ingénieur', 'Après 21h', 'Accès 24h/24', 'Installation complète'], featured: false }].
            map((s) =>
            <div key={s.id} style={{
              background: s.featured ? 'var(--s1)' : 'var(--s1)',
              border: `1px solid ${s.featured ? 'rgba(139,30,30,0.5)' : 'var(--br)'}`,
              borderRadius: '22px', padding: s.featured ? '36px 32px' : '28px 24px',
              position: 'relative', overflow: 'hidden',
              transition: 'all 0.25s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {e.currentTarget.style.borderColor = 'rgba(139,30,30,0.7)';e.currentTarget.style.transform = 'translateY(-3px)';}}
            onMouseLeave={(e) => {e.currentTarget.style.borderColor = s.featured ? 'rgba(139,30,30,0.5)' : 'var(--br)';e.currentTarget.style.transform = 'none';}}>
                {s.featured && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rouge)', borderRadius: '22px 22px 0 0' }} />}
                {s.featured && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139,30,30,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />}

                <div style={{ position: 'absolute', top: 20, right: 20, fontFamily: 'Barlow Condensed', fontWeight: 900, fontSize: 56, color: 'rgba(241,236,231,0.04)', lineHeight: 1 }}>{s.id}</div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--dim)', letterSpacing: '0.06em' }}>{s.surface}</div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 26, color: 'var(--rouge3)', letterSpacing: '0.02em' }}>{s.tarif}</div>
                </div>

                <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: s.featured ? 28 : 22, letterSpacing: '0.04em', marginBottom: 12 }}>{s.nom}</div>
                <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.65, fontWeight: 300, marginBottom: 20 }}>{s.desc}</p>

                <div style={{ borderTop: '1px solid var(--br)', paddingTop: 16, marginBottom: 20 }}>
                  {s.gear.map((g) =>
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--rouge)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 400 }}>{g}</span>
                    </div>
                )}
                </div>

                <button onClick={() => setPage('booking', { A: 'session-avec', B: 'session-sans', N: 'session-nuit' }[s.id])} style={{
                width: '100%', padding: '11px', borderRadius: '8px',
                background: s.featured ? 'var(--rouge)' : 'none',
                color: s.featured ? '#fff' : 'var(--rouge3)',
                border: `1px solid var(--rouge)`,
                fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
              }}>Réserver ce studio</button>
              </div>
            )}
          </div>

        <div style={{ height: 1, background: 'var(--br)', margin: '36px 0 28px' }} />
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--dim)', textTransform: 'uppercase', margin: '0 0 16px' }}>Production & livraison</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SERVICES.filter(ss => ss.id !== 'enreg').map(s => {
            const isOpen = openService === s.id;
            return (
              <div key={s.id} style={{ borderRadius: 16, overflow: 'hidden', border: `1px solid ${isOpen ? 'var(--br2)' : 'var(--br)'}`, background: isOpen ? 'rgba(0,0,0,0.18)' : 'transparent', transition: 'border-color 0.3s, background 0.3s' }}>
                <button onClick={() => setOpenService(isOpen ? null : s.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOpen ? 'var(--blanc)' : 'rgba(241,236,231,0.2)', transition: 'background 0.25s', flexShrink: 0 }} />
                    <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 19, letterSpacing: '0.04em', textTransform: 'uppercase', color: isOpen ? 'var(--blanc)' : 'rgba(241,236,231,0.6)', transition: 'color 0.25s' }}>{s.titre}</div>
                    {s.badge && <span style={{ padding: '2px 9px', borderRadius: 100, background: 'rgba(193,44,44,0.16)', border: '1px solid rgba(193,44,44,0.3)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--rouge3)', textTransform: 'uppercase' }}>{s.badge}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 20, color: isOpen ? 'var(--blanc)' : 'var(--dim)', transition: 'color 0.25s' }}>{s.prix}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.32s', opacity: 0.4 }}><path d="M3 6l5 5 5-5" stroke="var(--blanc)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </button>
                <div style={{ maxHeight: isOpen ? '400px' : '0px', overflow: 'hidden', transition: 'max-height 0.45s cubic-bezier(0.4,0,0.2,1)' }}>
                  <div style={{ padding: '0 24px 24px 42px', borderTop: '1px solid var(--br)' }}>
                    <p style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.7, fontWeight: 300, margin: '16px 0 14px' }}>{s.desc}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                      {s.tags.map(t => <span key={t} style={{ padding: '3px 10px', borderRadius: 100, background: 'rgba(193,44,44,0.08)', border: '1px solid rgba(193,44,44,0.2)', fontSize: 11, color: 'var(--rouge3)', fontWeight: 500 }}>{t}</span>)}
                    </div>
                    {s.options ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {s.options.map(o => (
                          <button key={o.pid} onClick={() => (o.pid === 'mix-standard' || o.pid === 'mix-urgent') && window.openMixBookingModal ? window.openMixBookingModal({ urgent: o.pid === 'mix-urgent' }) : setPage('booking', o.pid)} style={{ padding: '9px 18px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'transform 0.2s' }}
                          onMouseEnter={(ev) => ev.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseLeave={(ev) => ev.currentTarget.style.transform = 'none'}>
                            {o.label} <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 15 }}>{o.prix}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button onClick={() => setPage(s.ctaAction || 'booking')} style={{ padding: '9px 20px', borderRadius: 100, background: 'transparent', color: 'var(--rouge3)', border: '1px solid rgba(193,44,44,0.4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--rouge)'; ev.currentTarget.style.color = '#fff'; ev.currentTarget.style.borderColor = 'var(--rouge)'; }}
                      onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.color = 'var(--rouge3)'; ev.currentTarget.style.borderColor = 'rgba(193,44,44,0.4)'; }}>
                        {s.ctaLabel || 'Commander'} →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── EN VIDÉO ─────────────────────────────────────────────────── */}
      <section style={{ padding: '0 28px 64px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
          <span style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '0.18em', color: 'var(--dim)', textTransform: 'uppercase', fontWeight: 700 }}>YOUTUBE</span>
        </div>
        <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(36px,4.5vw,56px)', letterSpacing: '0.02em', lineHeight: 0.95, marginBottom: 8 }}>EN VIDÉO.</h2>
        <p style={{ fontSize: 14, color: 'var(--dim)', fontWeight: 300, marginBottom: 28, maxWidth: 500, lineHeight: 1.6 }}>Des sessions, des making-of, ce qui se passe vraiment dans la cabine.</p>
        <div className="urbe-r-stack" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14, alignItems: 'start' }}>
          {videos.map((v, i) => (
            <div key={v.id} style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--s1)', border: '1px solid var(--br)' }}>
              <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', background: '#000' }}>
                {playing[v.id]
                ? <iframe title={v.titre} src={`https://www.youtube.com/embed/${v.id}?rel=0&modestbranding=1&color=white&iv_load_policy=3&autoplay=1`} frameBorder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen loading="lazy" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} />
                : <button onClick={() => setPlaying(p => ({ ...p, [v.id]: true }))} style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', overflow: 'hidden' }}>
                    <img src={`https://img.youtube.com/vi/${v.id}/maxresdefault.jpg`} onError={(e) => { e.currentTarget.src = `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`; }} alt={v.titre} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 45%, rgba(0,0,0,0.55) 100%)' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: i === 0 ? 80 : 60, height: i === 0 ? 80 : 60, borderRadius: '50%', background: 'rgba(139,30,30,0.92)', border: '1.5px solid rgba(255,255,255,0.22)', boxShadow: '0 12px 36px rgba(139,30,30,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width={i === 0 ? 24 : 18} height={i === 0 ? 24 : 18} viewBox="0 0 24 24" fill="white"><path d="M8 5l13 7-13 7V5z" /></svg>
                    </div>
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                      <span style={{ fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.14em', color: '#fff', fontWeight: 700 }}>YOUTUBE</span>
                    </div>
                    {v.featured && <div style={{ position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 100, background: 'var(--rouge)', boxShadow: '0 4px 12px rgba(139,30,30,0.5)' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'pulse 2s infinite' }} />
                      <span style={{ fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.14em', color: '#fff', fontWeight: 700 }}>À LA UNE</span>
                    </div>}
                  </button>
                }
              </div>
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blanc)', marginBottom: 4 }}>{v.titre}</div>
                <div style={{ fontSize: 12, color: 'var(--dim)', fontWeight: 300, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {v.desc && <span>{v.desc}</span>}
                  <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--dim)', textDecoration: 'none', borderBottom: '1px solid var(--br)', transition: 'color 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--rouge3)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--dim)'}>Ouvrir sur YouTube ↗</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────────── */}
      <section style={{ padding: '0 28px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div className="urbe-r-stack" style={{ background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 22, padding: '48px 44px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 40 }}>
          <div>
            <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '0.02em', lineHeight: 0.95, marginBottom: 14 }}>ÇA SE PASSE OÙ ?</h2>
            <p style={{ fontSize: 14, color: 'var(--dim)', fontWeight: 300, lineHeight: 1.7 }}>37 rue d'Hauteville, Paris 10ᵉ — réserve en ligne ou écris-nous pour un projet sur mesure.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
            <button onClick={() => setPage('booking')} style={{ background: 'var(--rouge)', color: '#fff', border: 'none', padding: '13px 28px', borderRadius: 100, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 28px rgba(139,30,30,0.4)', whiteSpace: 'nowrap' }}>Réserver →</button>
            <button onClick={() => setPage('contact')} style={{ background: 'none', border: '1px solid var(--br2)', color: 'var(--dim)', padding: '13px 24px', borderRadius: 100, fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>Contact</button>
          </div>
        </div>
      </section>
    </div>);

}

/* ═══ AUTH + MAILING STORE (localStorage) ═══════════════════════ */
const URBE_USER_KEY = 'urbe_user_v1';
const URBE_BOOKINGS_KEY = 'urbe_bookings_v1';
const URBE_NEWS_KEY = 'urbe_newsletter_v1';
const URBE_FORFAIT_LOG_KEY = 'urbe_forfait_log_v1';
const URBE_PROJECTS_KEY = 'urbe_projects_v1';
const URBE_NOTIFS_KEY = 'urbe_notifs_v1';
const forfaitHoursOf = (label) => { const m = /forfait\s*(\d+)\s*h/i.exec(label || ''); return m ? parseInt(m[1], 10) : 0; };

/* In-memory blob store for uploaded/delivered files (survives nav, not reload) */
const urbeFiles = new Map();
function urbeStoreFile(file) {
  const id = 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  urbeFiles.set(id, file);
  return { id, name: file.name, size: file.size, type: file.type || 'audio/*' };
}
function urbeFmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' Ko';
  return (bytes / 1048576).toFixed(1) + ' Mo';
}
/* Generate a short sine-tone WAV so deliverables are always downloadable in the demo */
function makeStubWav(seconds = 3, freq = 196) {
  const sr = 11025, n = Math.floor(sr * seconds);
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); wr(8, 'WAVE'); wr(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 800) * Math.min(1, (n - i) / 800);
    const s = Math.sin((2 * Math.PI * freq * i) / sr) * 0.25 * env;
    dv.setInt16(44 + i * 2, s * 32767, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
function urbeDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
}
/* Télécharge une version : fichier réel si l'ingénieur en a uploadé un, sinon extrait généré */
function downloadVersion(v) {
  const f = v && v.fileId ? urbeFiles.get(v.fileId) : null;
  if (f) urbeDownload(f, v.name);
  else urbeDownload(makeStubWav(v && v.master ? 4 : 3, v && v.master ? 174 : 220), v ? v.name : 'mix.wav');
}

/* ── Comptes staff (admin = dirigeant, engineer = ingénieur) ── */
const URBE_USERS_KEY = 'urbe_users_v1';
/* v1 : espace abonné masqué et identifiants retirés du code public (sécurité).
   À remplacer par une vraie auth serveur (Supabase) avant de réactiver l'espace. */
const URBE_STAFF = [];
const resolveStaff = (email, pw) => URBE_STAFF.find(s => s.email === (email || '').toLowerCase() && s.password === pw) || null;
const staffPlan = (role) => role === 'admin' ? 'Direction' : 'Ingénieur';
const urbeAuth = {
  _subs: new Set(),
  _read(k, fb) { try { const v = JSON.parse(localStorage.getItem(k)); return (v === null || v === undefined) ? fb : v; } catch (e) { return fb; } },
  _write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} this.emit(); },
  _guestId() { let g = null; try { g = localStorage.getItem('urbe_guest_v1'); } catch (e) {} if (!g) { g = 'g_' + Date.now() + Math.random().toString(36).slice(2, 7); try { localStorage.setItem('urbe_guest_v1', g); } catch (e) {} } return g; },
  getUser() { return this._read(URBE_USER_KEY, null); },
  getBookings() { return this._read(URBE_BOOKINGS_KEY, []); },
  getNewsletter() { return this._read(URBE_NEWS_KEY, []); },
  getAllUsers() { return this._read(URBE_USERS_KEY, []); },
  _upsertUser(u) {
    const list = this.getAllUsers();
    const i = list.findIndex(x => x.email === u.email);
    const rec = { name: u.name, email: u.email, newsletter: !!u.newsletter, createdAt: (i > -1 ? list[i].createdAt : (u.createdAt || Date.now())) };
    if (i === -1) list.push(rec); else list[i] = rec;
    this._write(URBE_USERS_KEY, list);
  },
  signup(d) {
    const email = (d.email || '').toLowerCase();
    const staff = resolveStaff(email, d.password);
    if (staff) { const su = { name: staff.name, email: staff.email, role: staff.role, plan: staffPlan(staff.role), createdAt: Date.now(), newsletter: false }; this._write(URBE_USER_KEY, su); return su; }
    const user = { name: d.name, email, role: 'client', plan: 'Membre', createdAt: Date.now(), newsletter: !!d.newsletter };
    this._write(URBE_USER_KEY, user);
    this._upsertUser(user);
    if (d.newsletter) this.subscribeNews(email);
    this._claimGuestBookings(email);
    return user;
  },
  login(d) {
    const email = (d.email || '').toLowerCase();
    const staff = resolveStaff(email, d.password);
    if (staff) { const su = { name: staff.name, email: staff.email, role: staff.role, plan: staffPlan(staff.role), createdAt: Date.now(), newsletter: false }; this._write(URBE_USER_KEY, su); return su; }
    const prev = this.getUser();
    const reg = this.getAllUsers().find(u => u.email === email);
    const base = reg || (prev && prev.email === email ? prev : null);
    const user = base ? Object.assign({}, base, { role: 'client', plan: base.plan || 'Membre' }) : { name: email.split('@')[0], email: email, role: 'client', plan: 'Membre', createdAt: Date.now(), newsletter: false };
    this._write(URBE_USER_KEY, user);
    this._upsertUser(user);
    this._claimGuestBookings(email);
    return user;
  },
  logout() { try { localStorage.removeItem(URBE_USER_KEY); } catch (e) {} this.emit(); },
  update(patch) { const u = this.getUser(); if (!u) return; const nu = Object.assign({}, u, patch); this._write(URBE_USER_KEY, nu); if (nu.role === 'client') this._upsertUser(nu); if (patch.newsletter) this.subscribeNews(u.email); },
  addBooking(b) {
    const list = this.getBookings();
    const u = this.getUser();
    const fh = forfaitHoursOf(b.productLabel);
    list.unshift(Object.assign({ id: 'bk_' + Date.now(), email: u ? u.email : null, guestId: u ? null : this._guestId(), createdAt: Date.now(), status: 'Confirmé', forfaitHours: fh }, b));
    this._write(URBE_BOOKINGS_KEY, list);
    // Crée automatiquement un projet pour les mix / packs
    if (/mix|pack/i.test(b.productLabel || '') && !/forfait/i.test(b.productLabel || '')) {
      this.createProject({ title: b.productLabel, productLabel: b.productLabel, total: b.total, guestId: u ? null : this._guestId() });
    }
  },
  /* ── Forfaits : suivi des heures ── */
  getForfaitLog() { return this._read(URBE_FORFAIT_LOG_KEY, []); },
  logForfaitHours(d) {
    const u = this.getUser();
    const list = this.getForfaitLog();
    const email = (d.email || (u ? u.email : null) || '').toLowerCase() || null;
    list.unshift({ id: 'fl_' + Date.now(), email, hours: Number(d.hours) || 0, date: d.date || null, note: (d.note || '').trim(), by: u ? u.name : null, createdAt: Date.now() });
    this._write(URBE_FORFAIT_LOG_KEY, list);
  },
  removeForfaitLog(id) { const list = this.getForfaitLog().filter(x => x.id !== id); this._write(URBE_FORFAIT_LOG_KEY, list); },

  /* ── Projets mix : workflow dépôt → versions → validation ── */
  getProjects() { return this._read(URBE_PROJECTS_KEY, []); },
  _saveProjects(list) { this._write(URBE_PROJECTS_KEY, list); },
  getProject(id) { return this.getProjects().find(p => p.id === id) || null; },
  createProject(d) {
    const u = this.getUser();
    const list = this.getProjects();
    const proj = {
      id: 'pj_' + Date.now(),
      email: d.email || (u ? u.email : null),
      guestId: d.guestId || (u ? null : this._guestId()),
      clientName: d.clientName || (u ? u.name : null),
      engineer: null,
      title: d.title || 'Nouveau projet',
      productLabel: d.productLabel || 'Mixage',
      total: Number(d.total) || 0,
      paid: false,
      stage: 0, // 0 dépôt · 1 mixage · 2 à valider · 3 retouches · 4 master · 5 livré
      rounds: 0,
      maxRounds: d.maxRounds || 3,
      tracks: [],
      versions: [],
      revisions: [],
      events: [{ t: 'Projet créé', at: Date.now() }],
      createdAt: Date.now(),
    };
    list.unshift(proj);
    this._saveProjects(list);
    this.notify('Projet « ' + proj.title + ' » créé. Dépose tes pistes pour démarrer.');
    return proj;
  },
  _mutate(id, fn) {
    const list = this.getProjects();
    const i = list.findIndex(p => p.id === id);
    if (i === -1) return;
    fn(list[i]);
    this._saveProjects(list);
  },
  /* ── Actions staff (ingénieur / admin) ── */
  assignProject(id, engineerName) { this._mutate(id, p => { p.engineer = engineerName || null; p.events.unshift({ t: engineerName ? ('Assigné à ' + engineerName) : 'Désassigné', at: Date.now() }); }); },
  _pushVersion(id, opts) {
    opts = opts || {};
    const me = this.getUser();
    let pushed = null;
    this._mutate(id, p => {
      const isMaster = !!opts.master;
      if (isMaster && p.versions.some(v => v.master)) return; // pas de master en double
      const vNum = p.versions.filter(x => !x.master).length + 1;
      const meta = opts.file ? urbeStoreFile(opts.file) : null;
      const label = isMaster ? 'MASTER' : 'V' + vNum;
      const by = opts.by || (me ? me.name : 'Studio');
      const v = {
        id: (isMaster ? 'm_' : 'v_') + Date.now(),
        label,
        name: meta ? meta.name : (p.title.replace(/\s+/g, '_') + '_' + label + '.wav'),
        size: meta ? meta.size : null,
        fileId: meta ? meta.id : null,
        sentAt: Date.now(),
        note: (opts.note || '').trim() || (isMaster ? 'Master final prêt pour diffusion.' : 'Nouvelle version de mix.'),
        master: isMaster,
        by,
      };
      p.versions.unshift(v);
      p.stage = isMaster ? 4 : 2;
      if (!p.engineer && me && me.role === 'engineer') p.engineer = me.name;
      p.events.unshift({ t: label + ' livré' + (by ? ' par ' + by : ''), at: Date.now() });
      pushed = v;
    });
    const p = this.getProject(id);
    if (p && pushed) this.notifyEmail(p.email, pushed.master ? 'Master final disponible' : 'Nouvelle version ' + pushed.label, 'La ' + (pushed.master ? 'version master' : pushed.label) + ' de « ' + p.title + ' » est disponible dans ton espace. Écoute, valide ou demande une retouche.');
    return pushed;
  },
  /* Livraison manuelle (ingénieur / direction) — chemin unique via _pushVersion */
  staffDeliverVersion(id, opts) { return this._pushVersion(id, opts || {}); },
  addTracks(id, files) {
    this._mutate(id, p => {
      files.forEach(f => p.tracks.push(Object.assign({}, urbeStoreFile(f), { uploadedAt: Date.now() })));
      p.events.unshift({ t: files.length + ' piste(s) déposée(s)', at: Date.now() });
    });
  },
  removeTrack(id, fileId) { this._mutate(id, p => { p.tracks = p.tracks.filter(t => t.id !== fileId); }); },
  sendToStudio(id) {
    this._mutate(id, p => {
      if (p.tracks.length === 0) return;
      p.stage = 1;
      p.events.unshift({ t: 'Pistes envoyées au studio', at: Date.now() });
    });
    const p = this.getProject(id);
    if (p) this.notifyEmail(p.email, 'Pistes bien reçues', 'Nous avons reçu ' + p.tracks.length + ' piste(s) pour « ' + p.title + ' ». Mixage en cours.');
    // Studio livre la V1 (simulé)
    setTimeout(() => this._studioDeliver(id), 1400);
  },
  /* Livraison automatique simulée — uniquement si AUCUN ingénieur n'est assigné (mode démo self-serve) */
  _studioDeliver(id) {
    const p = this.getProject(id);
    if (!p || p.engineer) return; // un humain s'en charge → pas de livraison auto
    this._pushVersion(id, { by: 'Studio', note: p.versions.length === 0 ? 'Première version de mix.' : 'Nouvelle version après retouches.' });
  },
  requestRevision(id, note, file) {
    this._mutate(id, p => {
      p.rounds += 1;
      p.revisions.unshift({ id: 'r_' + Date.now(), note: (note || '').trim(), ref: file ? urbeStoreFile(file) : null, at: Date.now() });
      p.stage = 3;
      p.events.unshift({ t: 'Retouche demandée (tour ' + p.rounds + ')', at: Date.now() });
    });
    const p = this.getProject(id);
    if (p) this.notifyEmail(p.email, 'Demande de retouche reçue', 'Ta demande de retouche pour « ' + p.title + ' » a été transmise. Nouvelle version sous peu.');
    setTimeout(() => this._studioDeliver(id), 1600);
  },
  validateVersion(id) {
    this._mutate(id, p => {
      p.stage = 4;
      p.events.unshift({ t: 'Version validée par le client', at: Date.now() });
      const v = p.versions[0];
      if (v) v.validated = true;
    });
    const p = this.getProject(id);
    if (p) this.notifyEmail(p.email, 'Version validée', 'Tu as validé le mix de « ' + p.title + ' ». Master final en préparation. Règle le solde pour débloquer le téléchargement.');
    setTimeout(() => { const pp = this.getProject(id); if (!pp || pp.engineer) return; this._pushVersion(id, { by: 'Studio', master: true }); }, 1500);
  },
  payProject(id) {
    this._mutate(id, p => { p.paid = true; p.stage = 5; p.events.unshift({ t: 'Solde réglé · téléchargements débloqués', at: Date.now() }); });
    const p = this.getProject(id);
    if (p) this.notifyEmail(p.email, 'Paiement confirmé', 'Merci ! Tes fichiers de « ' + p.title + ' » sont débloqués dans l\'onglet Téléchargements.');
  },
  deleteProject(id) { this._saveProjects(this.getProjects().filter(p => p.id !== id)); },

  /* ── Notifications / email simulé ── */
  getNotifs() { return this._read(URBE_NOTIFS_KEY, []); },
  notify(msg) { const u = this.getUser(); const l = this.getNotifs(); l.unshift({ id: 'n_' + Date.now() + Math.random().toString(36).slice(2, 5), kind: 'app', to: u ? u.email : null, msg, at: Date.now(), read: false }); this._write(URBE_NOTIFS_KEY, l.slice(0, 40)); this._toast(msg, 'app'); },
  notifyEmail(to, subject, body) { const l = this.getNotifs(); l.unshift({ id: 'n_' + Date.now() + Math.random().toString(36).slice(2, 5), kind: 'email', to, subject, body, at: Date.now(), read: false }); this._write(URBE_NOTIFS_KEY, l.slice(0, 40)); this._toast('Email envoyé à ' + (to || 'toi') + ' · ' + subject, 'email'); },
  markNotifsRead() { const l = this.getNotifs(); let ch = false; l.forEach(n => { if (!n.read) { n.read = true; ch = true; } }); if (ch) this._write(URBE_NOTIFS_KEY, l); },
  clearNotifs(email) { const l = this.getNotifs().filter(n => email ? n.to !== email : false); this._write(URBE_NOTIFS_KEY, l); },
  _toast(msg, kind) { if (typeof window !== 'undefined' && window.__urbeToast) window.__urbeToast(msg, kind); },
  _claimGuestBookings(email) { const gid = this._guestId(); const claim = (rec) => { if (!rec.email && rec.guestId === gid) { rec.email = email; rec.guestId = null; return true; } return false; }; const list = this.getBookings(); let c1 = false; list.forEach(b => { if (claim(b)) c1 = true; }); if (c1) this._write(URBE_BOOKINGS_KEY, list); const log = this.getForfaitLog(); let c2 = false; log.forEach(x => { if (claim(x)) c2 = true; }); if (c2) this._write(URBE_FORFAIT_LOG_KEY, log); const pj = this.getProjects(); let c3 = false; pj.forEach(p => { if (claim(p)) c3 = true; }); if (c3) this._saveProjects(pj); },
  subscribeNews(email) { const list = this.getNewsletter(); const e = (email || "").toLowerCase(); if (e && list.indexOf(e) === -1) { list.push(e); this._write(URBE_NEWS_KEY, list); } },
  subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn); },
  emit() { this._subs.forEach(f => f()); },
};
function useAuth() {
  const [, force] = useState(0);
  useEffect(() => urbeAuth.subscribe(() => force(x => x + 1)), []);
  return urbeAuth;
}
const initialsOf = (name) => ((name || '').trim().split(/\s+/).map(s => s[0] || '').slice(0, 2).join('') || 'U').toUpperCase();

/* ─── CLOCHE NOTIFICATIONS (inbox) ─────────────────────────────── */
function NotifBell() {
  const auth = useAuth();
  const user = auth.getUser();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  if (!user) return null;
  const all = auth.getNotifs().filter(n => n.to === user.email);
  const unread = all.filter(n => !n.read).length;
  const fmt = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const toggle = (e) => { const willOpen = !open; if (willOpen) { const r = e.currentTarget.getBoundingClientRect(); setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) }); } setOpen(willOpen); if (willOpen && unread) setTimeout(() => auth.markNotifsRead(), 700); };
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={toggle} aria-label={'Notifications' + (unread ? ' (' + unread + ' non lues)' : '')} style={{ position: 'relative', width: 40, height: 40, borderRadius: 100, background: open ? 'var(--s3)' : 'none', border: '1px solid var(--br2)', color: 'var(--dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M13.7 21a2 2 0 01-3.4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        {unread > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans', boxSizing: 'border-box' }}>{unread}</span>}
      </button>
      {open && (
        <div style={{ position: 'fixed', top: pos ? pos.top : 96, right: pos ? pos.right : 16, width: 340, maxHeight: 440, overflowY: 'auto', background: 'rgba(14,14,14,0.98)', border: '1px solid var(--br2)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.7)', zIndex: 6000, backdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: '1px solid var(--br)', position: 'sticky', top: 0, background: 'rgba(14,14,14,0.98)', zIndex: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--blanc)' }}>Notifications</span>
            {all.length > 0 && <button onClick={async () => { const ok = await urbeConfirm({ title: 'Effacer les notifications ?', message: 'Toutes tes notifications seront retirées de cette liste.', confirmLabel: 'Effacer', cancelLabel: 'Garder' }); if (ok) auth.clearNotifs(user.email); }} style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 11.5, cursor: 'pointer', fontWeight: 600 }}>Tout effacer</button>}
          </div>
          {all.length === 0 ? (
            <div style={{ padding: '34px 22px', textAlign: 'center' }}>
              <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6 }}>Aucune notification.<br />Tes mises à jour de projet et confirmations apparaîtront ici.</p>
            </div>
          ) : (
            <div>
              {all.map(n => (
                <div key={n.id} style={{ display: 'flex', gap: 11, padding: '13px 16px', borderBottom: '1px solid var(--br)', background: n.read ? 'none' : 'rgba(193,44,44,0.06)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: n.kind === 'email' ? 'rgba(193,44,44,0.16)' : 'rgba(241,236,231,0.06)', border: '1px solid ' + (n.kind === 'email' ? 'rgba(193,44,44,0.34)' : 'var(--br2)'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {n.kind === 'email'
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="var(--rouge3)" strokeWidth="1.6"/><path d="M4 7l8 6 8-6" stroke="var(--rouge3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#3ad17a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {n.kind === 'email'
                      ? <React.Fragment><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--blanc)' }}>{n.subject}</div><div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.5, marginTop: 2 }}>{n.body}</div></React.Fragment>
                      : <div style={{ fontSize: 12.5, color: 'var(--blanc)', lineHeight: 1.5 }}>{n.msg}</div>}
                    <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 5 }}>{n.kind === 'email' ? 'Email · ' : ''}{fmt(n.at)}</div>
                  </div>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rouge)', flexShrink: 0, marginTop: 6 }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── NEWSLETTER (mailing) ─────────────────────────────────────── */
function NewsletterForm({ compact }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr('Adresse email invalide.'); return; }
    setErr('');
    auth.subscribeNews(email);
    setDone(true);
  };
  if (done) {
    return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 12, background: "rgba(58,209,122,0.08)", border: "1px solid rgba(58,209,122,0.3)" } },
      React.createElement("span", { style: { color: "#3ad17a", fontSize: 18 } }, "✓"),
      React.createElement("span", { style: { fontSize: 13, color: "var(--blanc)" } }, "Inscrit à la newsletter. À bientôt !"));
  }
  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: compact ? "nowrap" : "wrap" }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ton@email.com" aria-label="Email newsletter"
          style={{ flex: 1, minWidth: 0, padding: "12px 16px", borderRadius: 100, background: "var(--noir)", border: "1px solid var(--br2)", color: "var(--blanc)", fontSize: 13, fontFamily: "Plus Jakarta Sans", outline: "none" }} />
        <button type="submit" style={{ padding: "12px 22px", borderRadius: 100, background: "var(--rouge)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>S’inscrire</button>
      </div>
      {err && <span style={{ fontSize: 11, color: "var(--rouge3)" }}>{err}</span>}
    </form>
  );
}

/* ─── AUTH SCREEN (connexion / inscription) ────────────────────── */
function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState('signup');
  const [form, setForm] = useState({ name: '', email: '', password: '', newsletter: true });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm(f => Object.assign({}, f, { [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (mode === 'signup' && !form.name.trim()) { setErr('Indique ton nom.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) { setErr('Adresse email invalide.'); return; }
    if (form.password.length < 4) { setErr('Mot de passe : 4 caractères minimum.'); return; }
    setErr('');
    if (mode === 'signup') auth.signup(form); else auth.login(form);
  };
  const inputStyle = { width: "100%", padding: "13px 16px", borderRadius: 12, background: "var(--noir)", border: "1px solid var(--br2)", color: "var(--blanc)", fontSize: 14, fontFamily: "Plus Jakarta Sans", outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ minHeight: "100vh", paddingTop: 60, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 55% 60% at 50% 35%, rgba(139,30,30,0.14), transparent 70%)", pointerEvents: "none" }} />
      <img src={R("studio/cabine2.jpg")} alt="" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.06, filter: "blur(3px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", fontFamily: "Barlow Condensed", fontWeight: 900, fontSize: "24vw", color: "transparent", WebkitTextStroke: "1px rgba(241,236,231,0.03)", lineHeight: 1, userSelect: "none", pointerEvents: "none", whiteSpace: "nowrap" }}>URBE</div>
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, padding: "0 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", color: "var(--rouge3)", textTransform: "uppercase", marginBottom: 10 }}>Mon espace</div>
          <h1 style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 46, letterSpacing: "0.02em", lineHeight: 0.95 }}>{mode === "signup" ? "CRÉE TON COMPTE" : "RAVI DE TE REVOIR"}</h1>
          <p style={{ fontSize: 13, color: "var(--dim)", fontWeight: 300, marginTop: 8 }}>{mode === "signup" ? "Suis tes sessions, ta formation et tes factures." : "Connecte-toi pour accéder à ton espace."}</p>
        </div>
        <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--s1)", border: "1px solid var(--br)", borderRadius: 100, marginBottom: 22 }}>
          {[["signup", "Créer un compte"], ["login", "Connexion"]].map(([m, lbl]) => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: "10px", borderRadius: 100, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "Plus Jakarta Sans", transition: "all 0.2s", background: mode === m ? "var(--rouge)" : "transparent", color: mode === m ? "#fff" : "var(--dim)" }}>{lbl}</button>
          ))}
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && <input type="text" value={form.name} onChange={set("name")} placeholder="Nom complet" aria-label="Nom complet" style={inputStyle} />}
          <input type="email" value={form.email} onChange={set("email")} placeholder="Email" aria-label="Email" style={inputStyle} />
          <input type="password" value={form.password} onChange={set("password")} placeholder="Mot de passe" aria-label="Mot de passe" style={inputStyle} />
          {mode === "signup" && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "4px 2px" }}>
              <input type="checkbox" checked={form.newsletter} onChange={set("newsletter")} style={{ width: 17, height: 17, accentColor: "var(--rouge)", cursor: "pointer", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.5 }}>Recevoir la newsletter Urbe (offres, dates, nouveautés).</span>
            </label>
          )}
          {err && <div style={{ fontSize: 12, color: "var(--rouge3)", padding: "2px 2px" }}>{err}</div>}
          <button type="submit" style={{ marginTop: 4, padding: "14px", borderRadius: 100, background: "var(--rouge)", color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 28px rgba(139,30,30,0.4)" }}>{mode === "signup" ? "Créer mon compte →" : "Se connecter →"}</button>
        </form>
        <p style={{ fontSize: 11, color: "var(--dim)", textAlign: "center", marginTop: 18, lineHeight: 1.6, opacity: 0.7 }}>Démo · tes infos restent sur cet appareil (aucun serveur). Pour un envoi d’emails réel, connecte un service de mailing.</p>
        <details style={{ marginTop: 14, fontSize: 11, color: "var(--dim)", textAlign: "center" }}>
          <summary style={{ cursor: "pointer", color: "var(--rouge3)", fontWeight: 600, listStyle: "none" }}>Accès staff (démo)</summary>
          <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, background: "var(--noir)", border: "1px solid var(--br)", lineHeight: 1.8, textAlign: "left" }}>
            <div><strong style={{ color: "var(--blanc)" }}>Direction :</strong> direction@urbestudio.fr · urbe2026</div>
            <div><strong style={{ color: "var(--blanc)" }}>Ingénieur :</strong> virgile@urbestudio.fr · virgile</div>
            <div style={{ marginTop: 6, opacity: 0.7 }}>On se connecte au même endroit — le rôle est défini par les identifiants.</div>
          </div>
        </details>
      </div>
    </div>
  );
}

/* ─── FORFAIT LOGGER (pointer des heures) ──────────────────────── */
function ForfaitLogger({ maxHours }) {
  const auth = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [hours, setHours] = useState(2);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [flash, setFlash] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (!hours || hours <= 0) return;
    auth.logForfaitHours({ hours, date, note });
    setHours(2); setNote(''); setDate(today);
    setFlash(true); setTimeout(() => setFlash(false), 1800);
  };
  const fieldStyle = { padding: "11px 14px", borderRadius: 10, background: "var(--noir)", border: "1px solid var(--br2)", color: "var(--blanc)", fontSize: 13, fontFamily: "Plus Jakarta Sans", outline: "none", boxSizing: "border-box" };
  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ fontSize: 10, color: "var(--dim)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Heures effectuées</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" onClick={() => setHours(h => Math.max(0.5, Math.round((h - 0.5) * 2) / 2))} style={{ width: 34, height: 38, borderRadius: 10, border: "1px solid var(--br2)", background: "var(--noir)", color: "var(--blanc)", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>−</button>
            <input type="number" step="0.5" min="0.5" value={hours} onChange={(e) => setHours(parseFloat(e.target.value) || 0)} aria-label="Heures" style={Object.assign({}, fieldStyle, { width: "100%", textAlign: "center" })} />
            <button type="button" onClick={() => setHours(h => Math.round((h + 0.5) * 2) / 2)} style={{ width: 34, height: 38, borderRadius: 10, border: "1px solid var(--br2)", background: "var(--noir)", color: "var(--blanc)", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>+</button>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 10, color: "var(--dim)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Date de la session</label>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" style={Object.assign({}, fieldStyle, { width: "100%", colorScheme: "dark" })} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 10, color: "var(--dim)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Note (optionnel)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex : prise voix, mix titre 2…" aria-label="Note" style={Object.assign({}, fieldStyle, { width: "100%" })} />
      </div>
      {typeof maxHours === "number" && hours > maxHours && maxHours >= 0 && (
        <div style={{ fontSize: 11, color: "var(--rouge3)" }}>Attention : dépasse le crédit restant ({maxHours}h).</div>
      )}
      <button type="submit" style={{ padding: "12px", borderRadius: 100, background: flash ? "#1c3b1c" : "var(--rouge)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "background 0.35s" }}>{flash ? "✓ Heures enregistrées" : "Pointer ces heures"}</button>
    </form>
  );
}

/* ─── MIX PROJECTS : workflow & sous-composants ────────────────── */
const MIX_STAGES = ['Dépôt des pistes', 'Mixage en cours', 'À valider', 'Retouches', 'Master final', 'Livré'];

function StageStepper({ stage }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
      {MIX_STAGES.map((s, i) => {
        const done = i < stage, active = i === stage;
        return (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: done ? 'var(--rouge)' : active ? 'rgba(193,44,44,0.16)' : 'var(--s3)', border: '1px solid ' + (done || active ? 'var(--rouge)' : 'var(--br2)'), color: done ? '#fff' : active ? 'var(--rouge3)' : 'var(--dim)' }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--blanc)' : done ? 'var(--dim)' : 'rgba(241,236,231,0.35)', whiteSpace: 'nowrap' }}>{s}</span>
            </div>
            {i < MIX_STAGES.length - 1 && <div style={{ width: 18, height: 1, margin: '0 8px', background: done ? 'var(--rouge)' : 'var(--br)', flexShrink: 0 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function AudioStubButton({ name, master }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    if (!ref.current) {
      const url = URL.createObjectURL(makeStubWav(master ? 4 : 3, master ? 174 : 220));
      ref.current = new Audio(url);
      ref.current.onended = () => setPlaying(false);
    }
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.currentTime = 0; ref.current.play(); setPlaying(true); }
  };
  useEffect(() => () => { if (ref.current) ref.current.pause(); }, []);
  return (
    <button onClick={toggle} aria-label={playing ? 'Pause' : 'Écouter'} style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, border: '1px solid var(--br2)', background: playing ? 'var(--rouge)' : 'var(--noir)', color: playing ? '#fff' : 'var(--blanc)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {playing
        ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1.5" width="3" height="9" rx="1"/><rect x="7" y="1.5" width="3" height="9" rx="1"/></svg>
        : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2.5 1.5l8 4.5-8 4.5z"/></svg>}
    </button>
  );
}

function TrackUploader({ projectId }) {
  const auth = useAuth();
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const handle = (files) => { const arr = Array.from(files || []); if (arr.length) auth.addTracks(projectId, arr); };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      onClick={() => inputRef.current && inputRef.current.click()}
      style={{ border: '1.5px dashed ' + (drag ? 'var(--rouge)' : 'var(--br2)'), borderRadius: 14, padding: '26px 20px', textAlign: 'center', cursor: 'pointer', background: drag ? 'rgba(193,44,44,0.06)' : 'rgba(241,236,231,0.015)', transition: 'all 0.2s' }}>
      <input ref={inputRef} type="file" multiple accept="audio/*,.wav,.mp3,.aiff,.zip,.logicx" onChange={(e) => { handle(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 10px' }}><path d="M12 16V4M7 9l5-5 5 5" stroke="var(--rouge3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="var(--dim)" strokeWidth="1.6" strokeLinecap="round"/></svg>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--blanc)', marginBottom: 4 }}>Dépose tes pistes ici</div>
      <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>WAV · MP3 · AIFF · stems ZIP — glisse-dépose ou clique</div>
    </div>
  );
}

function RevisionForm({ projectId, roundsLeft }) {
  const auth = useAuth();
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const fileMeta = useRef(null);
  const inputRef = useRef(null);
  const submit = () => { if (!note.trim()) return; auth.requestRevision(projectId, note, file); setNote(''); setFile(null); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Décris les retouches souhaitées (ex : plus de voix, moins de réverb sur le refrain…)" rows={3} style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'var(--noir)', border: '1px solid var(--br2)', color: 'var(--blanc)', fontSize: 13, fontFamily: 'Plus Jakarta Sans', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={inputRef} type="file" accept="audio/*" onChange={(e) => setFile(e.target.files[0] || null)} style={{ display: 'none' }} />
        <button type="button" onClick={() => inputRef.current && inputRef.current.click()} style={{ padding: '9px 14px', borderRadius: 100, background: 'none', border: '1px solid var(--br2)', color: 'var(--dim)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M7 9l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {file ? file.name.slice(0, 22) : 'Joindre une réf (optionnel)'}
        </button>
        <button type="button" onClick={submit} disabled={!note.trim()} style={{ padding: '10px 18px', borderRadius: 100, background: note.trim() ? 'var(--rouge)' : 'var(--s3)', color: note.trim() ? '#fff' : 'var(--dim)', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: note.trim() ? 'pointer' : 'not-allowed', marginLeft: 'auto' }}>Envoyer la demande</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)' }}>{roundsLeft > 0 ? roundsLeft + ' tour(s) de retouche inclus restants' : 'Tours inclus épuisés — retouches supplémentaires sur devis'}</div>
    </div>
  );
}

function FileRow({ f, downloadable, onDownload, onRemove, accent, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 10, background: 'var(--noir)', border: '1px solid var(--br)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: accent ? 'rgba(193,44,44,0.14)' : 'rgba(241,236,231,0.05)', border: '1px solid ' + (accent ? 'rgba(193,44,44,0.3)' : 'var(--br)'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18V6l10-2v12" stroke={accent ? 'var(--rouge3)' : 'var(--dim)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="18" r="3" stroke={accent ? 'var(--rouge3)' : 'var(--dim)'} strokeWidth="1.6"/><circle cx="19" cy="16" r="3" stroke={accent ? 'var(--rouge3)' : 'var(--dim)'} strokeWidth="1.6"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blanc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
        {f.size != null && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>{urbeFmtSize(f.size)}</div>}
      </div>
      {right}
      {onDownload && (
        downloadable
          ? <button onClick={onDownload} aria-label="Télécharger" style={{ padding: '7px 14px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 4v12M7 11l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>Télécharger</button>
          : <span style={{ padding: '6px 12px', borderRadius: 100, background: 'rgba(241,236,231,0.04)', border: '1px solid var(--br2)', fontSize: 11, color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.8"/></svg>Verrouillé</span>
      )}
      {onRemove && <button onClick={onRemove} aria-label="Retirer" style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--br)', background: 'none', color: 'var(--dim)', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>}
    </div>
  );
}

function ProjectDetail({ project, setPage }) {
  const auth = useAuth();
  const p = project;
  const latest = p.versions[0];
  const roundsLeft = Math.max(0, p.maxRounds - p.rounds);
  const dlVersion = (v) => downloadVersion(v);
  const dlTrack = (t) => { const f = urbeFiles.get(t.id); if (f) urbeDownload(f, t.name); else urbeDownload(makeStubWav(2, 260), t.name); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stepper */}
      <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--noir)', padding: '18px 20px', overflowX: 'auto' }}>
        <StageStepper stage={p.stage} />
      </div>

      {/* STAGE 0 — Dépôt */}
      {p.stage === 0 && (
        <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)', padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>1 · Dépose tes pistes</div>
          <p style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.6 }}>Voix, instrus, stems… Une fois prêt, envoie au studio pour lancer le mix.</p>
          <TrackUploader projectId={p.id} />
          {p.tracks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 14 }}>
              {p.tracks.map(t => <FileRow key={t.id} f={t} onRemove={() => auth.removeTrack(p.id, t.id)} />)}
            </div>
          )}
          <button onClick={() => auth.sendToStudio(p.id)} disabled={p.tracks.length === 0} style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 100, background: p.tracks.length ? 'var(--rouge)' : 'var(--s3)', color: p.tracks.length ? '#fff' : 'var(--dim)', border: 'none', fontSize: 13.5, fontWeight: 700, cursor: p.tracks.length ? 'pointer' : 'not-allowed' }}>Envoyer au studio →</button>
        </div>
      )}

      {/* STAGE 1 / 3 — en cours */}
      {(p.stage === 1 || p.stage === 3) && (
        <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)', padding: '30px 22px', textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, margin: '0 auto 14px', border: '3px solid var(--s3)', borderTopColor: 'var(--rouge)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{p.stage === 1 ? 'Mixage en cours…' : 'Retouches en cours…'}</div>
          <p style={{ fontSize: 12.5, color: 'var(--dim)' }}>Le studio prépare ta version. Tu recevras un email dès qu'elle est prête.</p>
        </div>
      )}

      {/* STAGE 2 — À valider */}
      {p.stage === 2 && latest && (
        <div style={{ border: '1px solid rgba(193,44,44,0.3)', borderRadius: 14, background: 'var(--s1)', padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>2 · Écoute & valide la version {latest.label}</div>
            <span style={{ fontSize: 11, color: 'var(--rouge3)', fontWeight: 600 }}>Nouvelle version</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 10, background: 'var(--noir)', border: '1px solid var(--br)' }}>
            <AudioStubButton name={latest.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{latest.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 1 }}>{latest.note}</div>
            </div>
            <button onClick={() => dlVersion(latest)} style={{ padding: '7px 14px', borderRadius: 100, background: 'none', border: '1px solid var(--br2)', color: 'var(--blanc)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Aperçu ↓</button>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={() => auth.validateVersion(p.id)} style={{ flex: 1, minWidth: 160, padding: '13px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>✓ Valider cette version</button>
          </div>
          <details style={{ marginTop: 14 }}>
            <summary style={{ fontSize: 12.5, color: 'var(--rouge3)', cursor: 'pointer', fontWeight: 600, listStyle: 'none' }}>Demander une retouche →</summary>
            <div style={{ marginTop: 14, paddingTop: 16, borderTop: '1px solid var(--br)' }}>
              <RevisionForm projectId={p.id} roundsLeft={roundsLeft} />
            </div>
          </details>
        </div>
      )}

      {/* STAGE 4/5 — Master / livraison */}
      {(p.stage === 4 || p.stage === 5) && (
        <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)', padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{p.paid ? '✓ Livré' : '3 · Règle le solde pour télécharger'}</div>
          <p style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 16, lineHeight: 1.6 }}>{p.paid ? 'Tous tes fichiers sont débloqués ci-dessous et dans l\'onglet Téléchargements.' : 'Le master est prêt. Le téléchargement se débloque après règlement du solde.'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {p.versions.map(v => <FileRow key={v.id} f={v} accent={v.master} downloadable={p.paid || !v.master} onDownload={() => dlVersion(v)} right={<span style={{ fontSize: 10, fontWeight: 700, color: v.master ? 'var(--rouge3)' : 'var(--dim)', border: '1px solid ' + (v.master ? 'rgba(193,44,44,0.4)' : 'var(--br2)'), padding: '3px 8px', borderRadius: 100, flexShrink: 0 }}>{v.label}</span>} />)}
          </div>
          {!p.paid && (
            <button onClick={() => auth.payProject(p.id)} style={{ marginTop: 16, width: '100%', padding: '14px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(139,30,30,0.4)' }}>Régler le solde · {p.total}€ →</button>
          )}
          {p.paid && (
            <button onClick={() => setPage('dashboard')} style={{ marginTop: 16, width: '100%', padding: '12px', borderRadius: 100, background: 'none', border: '1px solid var(--br2)', color: 'var(--blanc)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Voir tous mes téléchargements →</button>
          )}
        </div>
      )}

      {/* Timeline + source files */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)', padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Pistes sources</div>
          {p.tracks.length === 0 ? <p style={{ fontSize: 12, color: 'var(--dim)' }}>Aucune piste déposée.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{p.tracks.map(t => <FileRow key={t.id} f={t} downloadable onDownload={() => dlTrack(t)} />)}</div>
          )}
        </div>
        <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)', padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Historique</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {p.events.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 13 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: i === 0 ? 'var(--rouge)' : 'var(--br2)', marginTop: 4 }} />
                  {i < p.events.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--br)', marginTop: 3 }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--blanc)', lineHeight: 1.4 }}>{e.t}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 1 }}>{new Date(e.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {new Date(e.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MixProjectsTab({ setPage }) {
  const auth = useAuth();
  const user = auth.getUser();
  const projects = auth.getProjects().filter(p => p.email === user.email);
  const [selId, setSelId] = useState(projects[0] ? projects[0].id : null);
  const selected = projects.find(p => p.id === selId) || projects[0] || null;

  if (projects.length === 0) {
    return (
      <div style={{ border: '1px solid var(--br)', borderRadius: 16, background: 'var(--s1)', padding: '48px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 80% at 50% 0%, rgba(139,30,30,0.12), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 30, marginBottom: 10 }}>AUCUN PROJET MIX</h2>
          <p style={{ fontSize: 13.5, color: 'var(--dim)', marginBottom: 22, lineHeight: 1.6, maxWidth: 440, margin: '0 auto 22px' }}>Commande un mixage ou un pack : ton projet s'ouvre ici automatiquement. Tu déposes tes pistes, on t'envoie les versions, tu valides en ligne.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => (window.openMixBookingModal ? window.openMixBookingModal({}) : setPage('booking', 'mix-standard'))} style={{ padding: '12px 24px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Commander un mix → 120€</button>
            <button onClick={() => auth.createProject({ title: 'Projet démo', productLabel: 'Mixage Standard', total: 120 })} style={{ padding: '12px 22px', borderRadius: 100, background: 'none', border: '1px solid var(--br2)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Créer un projet démo</button>
          </div>
        </div>
      </div>
    );
  }

  const stageBadge = (p) => p.paid ? 'Livré' : MIX_STAGES[p.stage];
  return (
    <div className="urbe-r-sidebar" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, alignItems: 'start' }}>
      {/* Liste projets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {projects.map(p => {
          const on = selected && p.id === selected.id;
          return (
            <button key={p.id} onClick={() => setSelId(p.id)} style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: '1px solid ' + (on ? 'var(--rouge)' : 'var(--br)'), background: on ? 'rgba(193,44,44,0.07)' : 'var(--s1)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--blanc)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.paid ? '#3ad17a' : 'var(--rouge3)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--dim)' }}>{stageBadge(p)}</span>
              </div>
            </button>
          );
        })}
        <button onClick={() => auth.createProject({ title: 'Nouveau projet', productLabel: 'Mixage Standard', total: 120 })} style={{ padding: '11px', borderRadius: 12, border: '1px dashed var(--br2)', background: 'none', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>+ Nouveau projet</button>
      </div>
      {/* Détail */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 28, letterSpacing: '0.01em', lineHeight: 1 }}>{selected.title}</h2>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>{selected.productLabel} · {selected.total}€ · {selected.paid ? 'Réglé' : 'Solde dû'}</div>
          </div>
          <button onClick={async () => { const ok = await urbeConfirm({ title: 'Supprimer ce projet ?', message: '« ' + selected.title + ' », ses pistes et toutes ses versions seront définitivement retirés de ton espace. Action irréversible.', confirmLabel: 'Supprimer', cancelLabel: 'Conserver' }); if (ok) { auth.deleteProject(selected.id); setSelId(null); } }} style={{ padding: '8px 14px', borderRadius: 100, background: 'none', border: '1px solid var(--br)', color: 'var(--dim)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Supprimer</button>
        </div>
        <ProjectDetail project={selected} setPage={setPage} />
      </div>
    </div>
  );
}

function DownloadsTab({ setPage }) {
  const auth = useAuth();
  const user = auth.getUser();
  const projects = auth.getProjects().filter(p => p.email === user.email);
  const items = [];
  projects.forEach(p => p.versions.forEach(v => items.push({ project: p, v })));
  const ready = items.filter(it => it.project.paid || !it.v.master);
  const dlVersion = (v) => downloadVersion(v);

  if (items.length === 0) {
    return (
      <div style={{ border: '1px solid var(--br)', borderRadius: 16, background: 'var(--s1)', padding: '48px 24px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 28, marginBottom: 10 }}>AUCUN FICHIER</h2>
        <p style={{ fontSize: 13.5, color: 'var(--dim)', marginBottom: 22, lineHeight: 1.6 }}>Tes mix et masters livrés apparaîtront ici, téléchargeables une fois le solde réglé.</p>
        <button onClick={() => (window.openMixBookingModal ? window.openMixBookingModal({}) : setPage('booking', 'mix-standard'))} style={{ padding: '12px 24px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Commander un mix →</button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(({ project, v }) => {
        const locked = v.master && !project.paid;
        return (
          <div key={v.id} style={{ border: '1px solid ' + (v.master ? 'rgba(193,44,44,0.28)' : 'var(--br)'), borderRadius: 14, background: 'var(--s1)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            {!locked && <AudioStubButton name={v.name} master={v.master} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>{v.name}{v.master && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--rouge3)', border: '1px solid rgba(193,44,44,0.4)', padding: '2px 7px', borderRadius: 100 }}>MASTER</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 3 }}>{project.title} · {new Date(v.sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
            </div>
            {locked
              ? <button onClick={() => auth.payProject(project.id)} style={{ padding: '9px 16px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Débloquer · {project.total}€</button>
              : <button onClick={() => dlVersion(v)} style={{ padding: '9px 18px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 4v12M7 11l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>Télécharger</button>}
          </div>
        );
      })}
    </div>
  );
}

/* ═══ STAFF / ADMIN (ingénieur & dirigeant) ═══════════════════════ */
const ENGINEER_NAMES = URBE_STAFF.filter(s => s.role === 'engineer').map(s => s.name);

function computeForfaits(auth) {
  const byEmail = {};
  const touch = (e) => { e = e || 'invité'; if (!byEmail[e]) byEmail[e] = { email: e, credit: 0, used: 0, logs: [] }; return byEmail[e]; };
  auth.getBookings().forEach(b => { if (b.forfaitHours) touch(b.email).credit += b.forfaitHours; });
  auth.getForfaitLog().forEach(l => { const r = touch(l.email); r.used += (l.hours || 0); r.logs.push(l); });
  return Object.values(byEmail);
}
const nameForEmail = (auth, email) => { const u = auth.getAllUsers().find(x => x.email === email); return u ? u.name : (email || '—'); };

function StaffHeader({ user, setPage, sub }) {
  const auth = useAuth();
  return (
    <div style={{ borderBottom: '1px solid var(--br)', background: 'var(--s1)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 120% at 80% 50%, rgba(139,30,30,0.12), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px', position: 'relative', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: user.role === 'admin' ? '#111' : 'var(--rouge)', border: user.role === 'admin' ? '1px solid var(--rouge)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(139,30,30,0.35)' }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 20, color: '#fff' }}>{initialsOf(user.name)}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 32, letterSpacing: '0.01em', lineHeight: 1 }}>{user.name}</h1>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 11px', borderRadius: 100, background: user.role === 'admin' ? 'rgba(193,44,44,0.18)' : 'rgba(241,236,231,0.07)', border: '1px solid ' + (user.role === 'admin' ? 'rgba(193,44,44,0.4)' : 'var(--br2)'), color: user.role === 'admin' ? 'var(--rouge3)' : 'var(--blanc)' }}>{user.role === 'admin' ? 'Espace direction' : 'Espace ingénieur'}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--dim)', marginTop: 4 }}>{sub}</div>
        </div>
        <NotifBell />
        <button onClick={() => auth.logout()} style={{ padding: '10px 18px', borderRadius: 100, background: 'none', border: '1px solid var(--br2)', color: 'var(--dim)', fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>Déconnexion</button>
      </div>
    </div>
  );
}

function StaffTabs({ tabs, onglet, setOnglet }) {
  return (
    <div style={{ borderBottom: '1px solid var(--br)', background: 'var(--s1)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 28px', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {tabs.map(([id, lbl]) => (
          <button key={id} onClick={() => setOnglet(id)} style={{ padding: '13px 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: onglet === id ? 700 : 500, color: onglet === id ? 'var(--blanc)' : 'var(--dim)', borderBottom: '2px solid ' + (onglet === id ? 'var(--rouge)' : 'transparent'), whiteSpace: 'nowrap', fontFamily: 'Plus Jakarta Sans' }}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}

function StaffVersionUploader({ projectId }) {
  const auth = useAuth();
  const [file, setFile] = useState(null);
  const [master, setMaster] = useState(false);
  const [note, setNote] = useState('');
  const inputRef = useRef(null);
  const send = () => { auth.staffDeliverVersion(projectId, { file, master, note }); setFile(null); setNote(''); setMaster(false); };
  return (
    <div style={{ border: '1px solid rgba(193,44,44,0.3)', borderRadius: 12, background: 'rgba(193,44,44,0.04)', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M7 9l5-5 5 5" stroke="var(--rouge3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" stroke="var(--rouge3)" strokeWidth="1.6" strokeLinecap="round"/></svg>
        Envoyer un son au client
      </div>
      <input ref={inputRef} type="file" accept="audio/*,.wav,.mp3,.aiff" onChange={(e) => setFile(e.target.files[0] || null)} style={{ display: 'none' }} />
      <button type="button" onClick={() => inputRef.current && inputRef.current.click()} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--noir)', border: '1px dashed var(--br2)', color: file ? 'var(--blanc)' : 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left', marginBottom: 10 }}>
        {file ? ('🎵 ' + file.name + ' · ' + urbeFmtSize(file.size)) : 'Choisir le fichier audio (WAV/MP3)…'}
      </button>
      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note pour le client (optionnel)" style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: 'var(--noir)', border: '1px solid var(--br2)', color: 'var(--blanc)', fontSize: 13, fontFamily: 'Plus Jakarta Sans', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={master} onChange={(e) => setMaster(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--rouge)', cursor: 'pointer' }} />
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Livrer comme master final</span>
        </label>
        <button onClick={send} style={{ padding: '10px 20px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{master ? 'Livrer le master →' : 'Envoyer la version →'}</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 10, lineHeight: 1.5 }}>Le client est notifié par email et retrouve le fichier dans son espace.</div>
    </div>
  );
}

function StaffProjectManager({ project, isAdmin }) {
  const auth = useAuth();
  const p = project;
  const dlTrack = (t) => { const f = urbeFiles.get(t.id); if (f) urbeDownload(f, t.name); else urbeDownload(makeStubWav(2, 260), t.name); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Client info */}
      <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)', padding: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(241,236,231,0.06)', border: '1px solid var(--br2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 16 }}>{initialsOf(p.clientName || p.email || 'Client')}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{p.clientName || 'Client'}</div>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>{p.email || '—'} · {p.productLabel} · {p.total}€ {p.paid ? '· réglé' : '· solde dû'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <select value={p.engineer || ''} onChange={(e) => auth.assignProject(p.id, e.target.value || null)} style={{ padding: '8px 12px', borderRadius: 100, background: 'var(--noir)', border: '1px solid var(--br2)', color: 'var(--blanc)', fontSize: 12, fontFamily: 'Plus Jakarta Sans', cursor: 'pointer' }}>
              <option value="">Assigner un ingé…</option>
              {ENGINEER_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: p.paid ? '#3ad17a' : 'var(--rouge3)', border: '1px solid ' + (p.paid ? 'rgba(58,209,122,0.4)' : 'rgba(193,44,44,0.4)'), padding: '5px 11px', borderRadius: 100, whiteSpace: 'nowrap' }}>{p.paid ? 'Livré' : MIX_STAGES[p.stage]}</span>
        </div>
      </div>

      {/* Stepper */}
      <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--noir)', padding: '16px 20px', overflowX: 'auto' }}><StageStepper stage={p.stage} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Client tracks + brief */}
        <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)', padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Pistes & infos client</div>
          {p.tracks.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--dim)', marginBottom: 14 }}>En attente du dépôt des pistes par le client.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>{p.tracks.map(t => <FileRow key={t.id} f={t} downloadable onDownload={() => dlTrack(t)} />)}</div>
          )}
          {p.revisions.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--dim)', textTransform: 'uppercase', margin: '6px 0 10px' }}>Demandes de retouche</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.revisions.map(r => (
                  <div key={r.id} style={{ padding: '11px 13px', borderRadius: 10, background: 'var(--noir)', border: '1px solid var(--br)' }}>
                    <div style={{ fontSize: 12.5, color: 'var(--blanc)', lineHeight: 1.5 }}>{r.note}</div>
                    {r.ref && <div style={{ fontSize: 11, color: 'var(--rouge3)', marginTop: 6, cursor: 'pointer' }} onClick={() => { const f = urbeFiles.get(r.ref.id); if (f) urbeDownload(f, r.ref.name); }}>📎 {r.ref.name}</div>}
                    <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 5 }}>{new Date(r.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Livraison + versions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StaffVersionUploader projectId={p.id} />
          <div style={{ border: '1px solid var(--br)', borderRadius: 14, background: 'var(--s1)', padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Versions livrées</div>
            {p.versions.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--dim)' }}>Aucune version envoyée.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{p.versions.map(v => <FileRow key={v.id} f={v} accent={v.master} downloadable onDownload={() => downloadVersion(v)} right={<span style={{ fontSize: 10, fontWeight: 700, color: v.master ? 'var(--rouge3)' : 'var(--dim)', border: '1px solid ' + (v.master ? 'rgba(193,44,44,0.4)' : 'var(--br2)'), padding: '3px 8px', borderRadius: 100, flexShrink: 0 }}>{v.label}</span>} />)}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ForfaitManager() {
  const auth = useAuth();
  const rows = computeForfaits(auth).filter(r => r.credit > 0 || r.used > 0);
  const [sel, setSel] = useState(rows[0] ? rows[0].email : '');
  const [hours, setHours] = useState(2);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const log = () => { if (!sel || !hours) return; auth.logForfaitHours({ email: sel, hours, date }); setHours(2); };
  const card = { border: '1px solid var(--br)', borderRadius: 16, background: 'var(--s1)' };
  if (rows.length === 0) return <div style={Object.assign({}, card, { padding: '40px 24px', textAlign: 'center' })}><p style={{ fontSize: 13.5, color: 'var(--dim)' }}>Aucun forfait client actif pour l'instant.</p></div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, alignItems: 'start' }}>
      <div style={Object.assign({}, card, { padding: 22 })}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Forfaits clients</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => {
            const left = Math.max(0, r.credit - r.used);
            const pct = r.credit > 0 ? Math.min(100, (r.used / r.credit) * 100) : 0;
            return (
              <div key={r.email} style={{ padding: '14px 16px', border: '1px solid var(--br)', borderRadius: 12, background: 'var(--noir)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{nameForEmail(auth, r.email)}</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)' }}><span style={{ color: 'var(--rouge3)', fontWeight: 700 }}>{left}h</span> / {r.credit}h</div>
                </div>
                <div style={{ height: 4, background: 'var(--s3)', borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: pct + '%', background: 'var(--rouge)', borderRadius: 2 }} /></div>
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>{r.email} · {r.used}h effectuées</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={Object.assign({}, card, { padding: 22 })}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Pointer des heures</div>
        <p style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 16 }}>Décompte des heures effectuées sur le forfait d'un client.</p>
        <label style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Client</label>
        <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--noir)', border: '1px solid var(--br2)', color: 'var(--blanc)', fontSize: 13, fontFamily: 'Plus Jakarta Sans', marginBottom: 12, cursor: 'pointer' }}>
          {rows.map(r => <option key={r.email} value={r.email}>{nameForEmail(auth, r.email)} ({Math.max(0, r.credit - r.used)}h restantes)</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Heures</label>
            <input type="number" step="0.5" min="0.5" value={hours} onChange={(e) => setHours(parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--noir)', border: '1px solid var(--br2)', color: 'var(--blanc)', fontSize: 13, fontFamily: 'Plus Jakarta Sans', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: 'var(--dim)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Date</label>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'var(--noir)', border: '1px solid var(--br2)', color: 'var(--blanc)', fontSize: 13, fontFamily: 'Plus Jakarta Sans', colorScheme: 'dark', boxSizing: 'border-box' }} />
          </div>
        </div>
        <button onClick={log} style={{ width: '100%', padding: '12px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Décompter ces heures</button>
      </div>
    </div>
  );
}

function StaffProjectsTab({ isAdmin }) {
  const auth = useAuth();
  const me = auth.getUser();
  let projects = auth.getProjects();
  const [filterMine, setFilterMine] = useState(false);
  if (!isAdmin && filterMine) projects = projects.filter(p => p.engineer === me.name);
  const [selId, setSelId] = useState(projects[0] ? projects[0].id : null);
  const selected = projects.find(p => p.id === selId) || projects[0] || null;
  const card = { border: '1px solid var(--br)', borderRadius: 16, background: 'var(--s1)' };
  if (projects.length === 0 && !filterMine) return <div style={Object.assign({}, card, { padding: '40px 24px', textAlign: 'center' })}><p style={{ fontSize: 13.5, color: 'var(--dim)' }}>Aucun projet mix pour l'instant.</p></div>;
  return (
    <div>
      {!isAdmin && (
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--s1)', border: '1px solid var(--br)', borderRadius: 100, marginBottom: 16, width: 'fit-content' }}>
          {[[false, 'Tous les projets'], [true, 'Mes projets']].map(([v, l]) => (
            <button key={String(v)} onClick={() => setFilterMine(v)} style={{ padding: '8px 16px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: filterMine === v ? 'var(--rouge)' : 'transparent', color: filterMine === v ? '#fff' : 'var(--dim)' }}>{l}</button>
          ))}
        </div>
      )}
      {projects.length === 0 ? <div style={Object.assign({}, card, { padding: '40px 24px', textAlign: 'center' })}><p style={{ fontSize: 13.5, color: 'var(--dim)' }}>Aucun projet ne t'est assigné.</p></div> : (
        <div className="urbe-r-sidebar" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projects.map(p => {
              const on = selected && p.id === selected.id;
              return (
                <button key={p.id} onClick={() => setSelId(p.id)} style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: '1px solid ' + (on ? 'var(--rouge)' : 'var(--br)'), background: on ? 'rgba(193,44,44,0.07)' : 'var(--s1)', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 4 }}>{p.clientName || p.email}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.paid ? '#3ad17a' : 'var(--rouge3)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--dim)' }}>{p.paid ? 'Livré' : MIX_STAGES[p.stage]}{p.engineer ? ' · ' + p.engineer : ''}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <div>
            <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 26, lineHeight: 1, marginBottom: 14 }}>{selected.title}</h2>
            <StaffProjectManager project={selected} isAdmin={isAdmin} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ESPACE INGÉNIEUR ─────────────────────────────────────────── */
function StaffDashboard({ setPage }) {
  const auth = useAuth();
  const user = auth.getUser();
  const [onglet, setOnglet] = useState('projets');
  const projects = auth.getProjects();
  const active = projects.filter(p => !p.paid).length;
  return (
    <div style={{ minHeight: '100vh', paddingTop: 60 }}>
      <StaffHeader user={user} setPage={setPage} sub={projects.length + ' projet(s) · ' + active + ' en cours'} />
      <StaffTabs tabs={[['projets', 'Projets'], ['forfaits', 'Forfaits clients']]} onglet={onglet} setOnglet={setOnglet} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px 80px' }}>
        {onglet === 'projets' && <StaffProjectsTab isAdmin={false} />}
        {onglet === 'forfaits' && <ForfaitManager />}
      </div>
    </div>
  );
}

/* ─── ESPACE DIRECTION (ADMIN) ─────────────────────────────────── */
function AdminDashboard({ setPage }) {
  const auth = useAuth();
  const user = auth.getUser();
  const [onglet, setOnglet] = useState('overview');
  const users = auth.getAllUsers();
  const bookings = auth.getBookings();
  const projects = auth.getProjects();
  const news = auth.getNewsletter();
  const revenue = bookings.reduce((s, b) => s + (Number(b.total) || 0), 0) + projects.filter(p => p.paid).reduce((s, p) => s + (Number(p.total) || 0), 0);
  const activeProjects = projects.filter(p => !p.paid).length;
  const card = { border: '1px solid var(--br)', borderRadius: 16, background: 'var(--s1)' };
  const fmtD = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const stats = [
    [users.length, 'Clients'],
    [projects.length, 'Projets mix'],
    [activeProjects, 'En cours'],
    [revenue + '€', 'Volume d\'affaires'],
    [news.length, 'Abonnés news'],
  ];

  return (
    <div style={{ minHeight: '100vh', paddingTop: 60 }}>
      <StaffHeader user={user} setPage={setPage} sub={'Accès complet · ' + users.length + ' clients · ' + projects.length + ' projets'} />
      <StaffTabs tabs={[['overview', 'Vue d\'ensemble'], ['clients', 'Clients'], ['projets', 'Projets'], ['forfaits', 'Forfaits'], ['reservations', 'Réservations'], ['newsletter', 'Newsletter'], ['equipe', 'Équipe']]} onglet={onglet} setOnglet={setOnglet} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px 80px' }}>

        {onglet === 'overview' && (
          <div>
            <div className="urbe-r-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 14 }}>
              {stats.map(([v, l], i) => (
                <div key={i} style={Object.assign({}, card, { padding: '20px 18px' })}>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 8 }}>{l}</div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 30, color: 'var(--rouge3)', lineHeight: 1 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={Object.assign({}, card, { padding: 24 })}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Projets récents</div>
              {projects.length === 0 ? <p style={{ fontSize: 13, color: 'var(--dim)' }}>Aucun projet.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {projects.slice(0, 6).map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', border: '1px solid var(--br)', borderRadius: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>{p.clientName || p.email} · {p.engineer || 'non assigné'}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: p.paid ? '#3ad17a' : 'var(--rouge3)', border: '1px solid ' + (p.paid ? 'rgba(58,209,122,0.4)' : 'rgba(193,44,44,0.4)'), padding: '4px 10px', borderRadius: 100, whiteSpace: 'nowrap' }}>{p.paid ? 'Livré' : MIX_STAGES[p.stage]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {onglet === 'clients' && (
          users.length === 0 ? <div style={Object.assign({}, card, { padding: '40px 24px', textAlign: 'center' })}><p style={{ fontSize: 13.5, color: 'var(--dim)' }}>Aucun client inscrit.</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {users.map(u => {
                const ub = bookings.filter(b => b.email === u.email);
                const spent = ub.reduce((s, b) => s + (Number(b.total) || 0), 0);
                const up = projects.filter(p => p.email === u.email).length;
                return (
                  <div key={u.email} style={Object.assign({}, card, { padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 })}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(241,236,231,0.06)', border: '1px solid var(--br2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 15 }}>{initialsOf(u.name)}</span></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{u.name} {u.newsletter && <span style={{ fontSize: 9, color: 'var(--rouge3)', border: '1px solid rgba(193,44,44,0.4)', padding: '2px 7px', borderRadius: 100, marginLeft: 6 }}>NEWSLETTER</span>}</div>
                      <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{u.email} · inscrit le {fmtD(u.createdAt)}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 20, color: 'var(--blanc)' }}>{spent}€</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>{ub.length} résa · {up} projet(s)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {onglet === 'projets' && <StaffProjectsTab isAdmin={true} />}
        {onglet === 'forfaits' && <ForfaitManager />}

        {onglet === 'reservations' && (
          bookings.length === 0 ? <div style={Object.assign({}, card, { padding: '40px 24px', textAlign: 'center' })}><p style={{ fontSize: 13.5, color: 'var(--dim)' }}>Aucune réservation.</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bookings.map(b => (
                <div key={b.id} style={Object.assign({}, card, { padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 })}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{b.productLabel}{b.billing === 'hourly' && b.hours ? ' · ' + b.hours + 'h' : ''}</div>
                    <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{nameForEmail(auth, b.email)} · {b.date ? new Date(b.date + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'date à confirmer'}{b.time ? ' · ' + b.time : ''}</div>
                  </div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 22 }}>{b.total}€</div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--rouge3)', border: '1px solid rgba(193,44,44,0.4)', padding: '4px 10px', borderRadius: 100, whiteSpace: 'nowrap', flexShrink: 0 }}>{b.status || 'Confirmé'}</span>
                </div>
              ))}
            </div>
          )
        )}

        {onglet === 'newsletter' && (
          <div style={Object.assign({}, card, { padding: 24 })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Abonnés newsletter · {news.length}</div>
              <button onClick={() => urbeDownload(new Blob([news.join('\n')], { type: 'text/csv' }), 'newsletter-urbe.csv')} disabled={news.length === 0} style={{ padding: '9px 18px', borderRadius: 100, background: news.length ? 'var(--rouge)' : 'var(--s3)', color: news.length ? '#fff' : 'var(--dim)', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: news.length ? 'pointer' : 'not-allowed' }}>Exporter (.csv)</button>
            </div>
            {news.length === 0 ? <p style={{ fontSize: 13, color: 'var(--dim)' }}>Aucun abonné pour l'instant.</p> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {news.map(e => <span key={e} style={{ padding: '6px 13px', borderRadius: 100, background: 'var(--noir)', border: '1px solid var(--br)', fontSize: 12.5, color: 'var(--blanc)' }}>{e}</span>)}
              </div>
            )}
          </div>
        )}

        {onglet === 'equipe' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {URBE_STAFF.map(s => (
              <div key={s.email} style={Object.assign({}, card, { padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 })}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: s.role === 'admin' ? '#111' : 'var(--rouge)', border: s.role === 'admin' ? '1px solid var(--rouge)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 15, color: '#fff' }}>{initialsOf(s.name)}</span></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)' }}>{s.email}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.role === 'admin' ? 'var(--rouge3)' : 'var(--dim)', border: '1px solid ' + (s.role === 'admin' ? 'rgba(193,44,44,0.4)' : 'var(--br2)'), padding: '4px 11px', borderRadius: 100 }}>{s.role === 'admin' ? 'Direction' : 'Ingénieur'}</span>
              </div>
            ))}
            <p style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.6, marginTop: 4 }}>Démo · les identifiants staff sont prédéfinis dans le code. En production, ils seraient gérés côté serveur avec mots de passe chiffrés.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── DASHBOARD ──────────────────────────────────────────────── */
function DashboardPage({ setPage }) {
  const auth = useAuth();
  const user = auth.getUser();
  const [onglet, setOnglet] = useState('aperçu');
  if (!user) return <AuthScreen />;
  if (user.role === 'admin') return <AdminDashboard setPage={setPage} />;
  if (user.role === 'engineer') return <StaffDashboard setPage={setPage} />;

  const bookings = auth.getBookings().filter(b => b.email === user.email);
  const parseDate = (b) => b.date ? new Date(b.date + (b.time ? ("T" + b.time) : "T00:00")) : null;
  const now = new Date();
  const upcoming = bookings.filter(b => { const d = parseDate(b); return d && d >= now; }).sort((a, b) => parseDate(a) - parseDate(b));
  const totalSpent = bookings.reduce((s, b) => s + (Number(b.total) || 0), 0);
  const totalHours = bookings.reduce((s, b) => s + (b.billing === "hourly" ? (Number(b.hours) || 0) : 0), 0);
  const fmtDate = (b) => { const d = parseDate(b); if (!d) return "Date à confirmer"; return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + (b.time ? (" · " + b.time) : ""); };

  /* ── Forfaits : crédit & suivi heures ── */
  const forfaitLog = auth.getForfaitLog().filter(x => x.email === user.email);
  const forfaitCredit = bookings.reduce((s, b) => s + (Number(b.forfaitHours) || 0), 0);
  const forfaitUsed = forfaitLog.reduce((s, x) => s + (Number(x.hours) || 0), 0);
  const forfaitLeft = Math.max(0, forfaitCredit - forfaitUsed);
  const forfaitPct = forfaitCredit > 0 ? Math.min(100, (forfaitUsed / forfaitCredit) * 100) : 0;
  const fmtLogDate = (x) => x.date ? new Date(x.date + "T00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : new Date(x.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  const tabs = [["aperçu", "Aperçu"], ["réservations", "Réservations"], ["mix", "Mes mix"], ["forfait", "Mon forfait"], ["téléchargements", "Téléchargements"], ["profil", "Profil"]];
  const stats = [
    [bookings.length, bookings.length > 1 ? "Réservations" : "Réservation"],
    [totalHours + "h", "Heures studio"],
    [totalSpent + "€", "Total commandé"],
    [upcoming.length, "À venir"],
  ];

  const card = { border: "1px solid var(--br)", borderRadius: 16, background: "var(--s1)" };

  return (
    <div style={{ minHeight: "100vh", paddingTop: 60 }}>
      {/* Header bar */}
      <div style={{ borderBottom: "1px solid var(--br)", background: "var(--s1)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 120% at 80% 50%, rgba(139,30,30,0.10), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px 0", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--rouge)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 8px 24px rgba(139,30,30,0.4)" }}>
              <span style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 22, color: "#fff" }}>{initialsOf(user.name)}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 34, letterSpacing: "0.01em", lineHeight: 1 }}>Bonjour, {(user.name || "").split(" ")[0]}.</h1>
              <div style={{ fontSize: 12.5, color: "var(--dim)", marginTop: 4 }}>{user.email} · <span style={{ color: "var(--rouge3)", fontWeight: 600 }}>{user.plan}</span></div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <NotifBell />
              <button onClick={() => setPage("booking")} style={{ padding: "10px 22px", borderRadius: 100, background: "var(--rouge)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(139,30,30,0.35)" }}>Réserver →</button>
              <button onClick={() => auth.logout()} style={{ padding: "10px 18px", borderRadius: 100, background: "none", border: "1px solid var(--br2)", color: "var(--dim)", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>Déconnexion</button>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
            {tabs.map(([id, lbl]) => (
              <button key={id} onClick={() => setOnglet(id)} style={{ padding: "12px 18px", border: "none", background: "none", cursor: "pointer", fontSize: 13.5, fontWeight: onglet === id ? 700 : 500, color: onglet === id ? "var(--blanc)" : "var(--dim)", borderBottom: "2px solid " + (onglet === id ? "var(--rouge)" : "transparent"), whiteSpace: "nowrap", transition: "all 0.2s", fontFamily: "Plus Jakarta Sans" }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 28px 80px" }}>

        {onglet === "aperçu" && (
          <div>
            <div className="urbe-r-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
              {stats.map(([v, l], i) => (
                <div key={i} style={Object.assign({}, card, { padding: "22px 20px" })}>
                  <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 10 }}>{l}</div>
                  <div style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 36, color: "var(--rouge3)", lineHeight: 1 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
              <div style={Object.assign({}, card, { padding: 24 })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Prochaines sessions</div>
                  <button onClick={() => setOnglet("réservations")} style={{ fontSize: 12, color: "var(--rouge3)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Tout voir</button>
                </div>
                {upcoming.length === 0 ? (
                  <div style={{ padding: "24px 0", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16, lineHeight: 1.6 }}>Aucune session prévue pour l’instant.</p>
                    <button onClick={() => setPage("booking")} style={{ padding: "10px 20px", borderRadius: 100, background: "var(--rouge)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Réserver une session</button>
                  </div>
                ) : upcoming.slice(0, 4).map((b) => (
                  <div key={b.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, border: "1px solid var(--br)", borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(139,30,30,0.14)", border: "1px solid rgba(139,30,30,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="var(--rouge3)" strokeWidth="1.6"/><path d="M3 9h18M8 3v4M16 3v4" stroke="var(--rouge3)" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{b.productLabel}{b.billing === "hourly" && b.hours ? (" · " + b.hours + "h") : ""}</div>
                      <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 2 }}>{fmtDate(b)}</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--rouge3)", border: "1px solid rgba(139,30,30,0.4)", padding: "3px 9px", borderRadius: 100, whiteSpace: "nowrap" }}>{b.status || "Confirmé"}</div>
                  </div>
                ))}
              </div>
              <div style={Object.assign({}, card, { padding: 24, display: "flex", flexDirection: "column" })}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Newsletter Urbe</div>
                <p style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.6, marginBottom: 16 }}>{user.newsletter ? "Tu reçois nos offres et dates de sessions." : "Reçois nos offres, dates et nouveautés."}</p>
                {user.newsletter ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 12, background: "rgba(58,209,122,0.08)", border: "1px solid rgba(58,209,122,0.3)" }}>
                    <span style={{ color: "#3ad17a", fontSize: 17 }}>✓</span>
                    <span style={{ fontSize: 12.5, color: "var(--blanc)" }}>Inscrit avec {user.email}</span>
                  </div>
                ) : <NewsletterForm />}
                <div style={{ marginTop: "auto", paddingTop: 20 }}>
                  <div style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.6, marginBottom: 8 }}>Promo en cours</div>
                  <button onClick={() => setPage("booking")} style={{ width: "100%", padding: "12px", borderRadius: 12, background: "rgba(139,30,30,0.1)", border: "1px solid rgba(139,30,30,0.32)", color: "var(--rouge3)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>1 mix acheté = 1 master offert →</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {onglet === "réservations" && (
          <div>
            {bookings.length === 0 ? (
              <div style={Object.assign({}, card, { padding: "48px 24px", textAlign: "center" })}>
                <h2 style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 28, marginBottom: 10 }}>AUCUNE RÉSERVATION</h2>
                <p style={{ fontSize: 13.5, color: "var(--dim)", marginBottom: 22, lineHeight: 1.6 }}>Tes réservations apparaîtront ici automatiquement.</p>
                <button onClick={() => setPage("booking")} style={{ padding: "12px 26px", borderRadius: 100, background: "var(--rouge)", color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Réserver une session →</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {bookings.map((b) => (
                  <div key={b.id} style={Object.assign({}, card, { padding: "18px 22px", display: "flex", alignItems: "center", gap: 16 })}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(139,30,30,0.14)", border: "1px solid rgba(139,30,30,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="var(--rouge3)" strokeWidth="1.6"/><path d="M3 9h18M8 3v4M16 3v4" stroke="var(--rouge3)" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 600 }}>{b.productLabel}{b.billing === "hourly" && b.hours ? (" · " + b.hours + "h") : ""}</div>
                      <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 3 }}>{fmtDate(b)}</div>
                    </div>
                    <div style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 24, color: "var(--blanc)", flexShrink: 0 }}>{b.total}€</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--rouge3)", border: "1px solid rgba(139,30,30,0.4)", padding: "4px 10px", borderRadius: 100, whiteSpace: "nowrap", flexShrink: 0 }}>{b.status || "Confirmé"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {onglet === "mix" && <MixProjectsTab setPage={setPage} />}

        {onglet === "téléchargements" && <DownloadsTab setPage={setPage} />}

        {onglet === "forfait" && (
          <div>
            {forfaitCredit === 0 ? (
              <div style={Object.assign({}, card, { padding: "48px 24px", textAlign: "center", position: "relative", overflow: "hidden" })}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 50% 80% at 50% 0%, rgba(139,30,30,0.12), transparent 70%)", pointerEvents: "none" }} />
                <div style={{ position: "relative" }}>
                  <h2 style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 30, marginBottom: 10 }}>AUCUN FORFAIT ACTIF</h2>
                  <p style={{ fontSize: 13.5, color: "var(--dim)", marginBottom: 24, lineHeight: 1.6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>Prends un forfait d'heures prépayées et suis ta consommation ici, session après session. Jusqu'à 17% d'économie.</p>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    {[["forfait-10h", "10H", "270€"], ["forfait-20h", "20H", "510€"], ["forfait-50h", "50H", "1250€"]].map(([pid, h, p]) => (
                      <button key={pid} onClick={() => setPage("booking", pid)} style={{ padding: "14px 22px", borderRadius: 14, background: "var(--noir)", border: "1px solid var(--br2)", color: "var(--blanc)", cursor: "pointer", textAlign: "left", transition: "border-color 0.2s" }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--rouge)"}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--br2)"}>
                        <div style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{h}</div>
                        <div style={{ fontSize: 12, color: "var(--rouge3)", fontWeight: 600, marginTop: 4 }}>{p}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
                {/* Tracker */}
                <div style={Object.assign({}, card, { padding: 28, position: "relative", overflow: "hidden" })}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 80% at 80% 0%, rgba(139,30,30,0.10), transparent 70%)", pointerEvents: "none" }} />
                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 24 }}>
                    {/* Donut */}
                    <div style={{ position: "relative", width: 132, height: 132, flexShrink: 0 }}>
                      <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="66" cy="66" r="56" fill="none" stroke="var(--s3)" strokeWidth="12" />
                        <circle cx="66" cy="66" r="56" fill="none" stroke="var(--rouge)" strokeWidth="12" strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 56}
                          strokeDashoffset={2 * Math.PI * 56 * (1 - forfaitPct / 100)}
                          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
                      </svg>
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 38, color: "var(--blanc)", lineHeight: 0.9 }}>{forfaitLeft}<span style={{ fontSize: 18, color: "var(--dim)" }}>h</span></div>
                        <div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 2 }}>restantes</div>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: "var(--rouge3)", textTransform: "uppercase", marginBottom: 8 }}>Mon forfait</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {[["Crédit total", forfaitCredit + "h"], ["Heures effectuées", forfaitUsed + "h"], ["Restantes", forfaitLeft + "h"]].map(([l, v], i) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span style={{ fontSize: 12.5, color: "var(--dim)" }}>{l}</span>
                            <span style={{ fontFamily: "Barlow Condensed", fontWeight: 700, fontSize: 20, color: i === 2 ? "var(--rouge3)" : "var(--blanc)" }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {forfaitLeft === 0 && (
                    <div style={{ position: "relative", marginTop: 20, padding: "12px 14px", borderRadius: 12, background: "rgba(139,30,30,0.1)", border: "1px solid rgba(139,30,30,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ fontSize: 12.5, color: "var(--blanc)" }}>Forfait épuisé.</span>
                      <button onClick={() => setPage("booking", "forfait-20h")} style={{ padding: "8px 16px", borderRadius: 100, background: "var(--rouge)", color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Recharger →</button>
                    </div>
                  )}
                </div>

                {/* Décompte géré par le studio (source unique) */}
                <div style={Object.assign({}, card, { padding: 28 })}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Décompte des heures</div>
                  <p style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.6, marginBottom: 16 }}>Tes heures sont décomptées par le studio à chaque passage en cabine — tu n'as rien à saisir. Le solde et l'historique se mettent à jour automatiquement.</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 15px", borderRadius: 12, background: "rgba(241,236,231,0.03)", border: "1px solid var(--br)" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" stroke="var(--rouge3)" strokeWidth="1.6"/><path d="M12 7.5V12l3 2" stroke="var(--rouge3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.5 }}>Une question sur ton solde ? Contacte le studio, on ajuste avec toi.</span>
                  </div>
                </div>

                {/* Historique */}
                <div style={Object.assign({}, card, { padding: 28, gridColumn: "1 / -1" })}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Historique des heures</div>
                    <span style={{ fontSize: 12, color: "var(--dim)" }}>{forfaitLog.length} session{forfaitLog.length > 1 ? "s" : ""} · {forfaitUsed}h</span>
                  </div>
                  {forfaitLog.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--dim)", textAlign: "center", padding: "20px 0", lineHeight: 1.6 }}>Aucune session pointée pour l'instant.<br />Utilise le formulaire ci-dessus après chaque passage.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {forfaitLog.map((x, i) => (
                        <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderTop: i === 0 ? "none" : "1px solid var(--br)" }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(139,30,30,0.14)", border: "1px solid rgba(139,30,30,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontFamily: "Barlow Condensed", fontWeight: 800, fontSize: 15, color: "var(--rouge3)" }}>{x.hours}h</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, textTransform: "capitalize" }}>{fmtLogDate(x)}</div>
                            {x.note && <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.note}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {onglet === "profil" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={Object.assign({}, card, { padding: 24 })}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 18 }}>Mon profil</div>
              {[["Nom", user.name], ["Email", user.email], ["Statut", user.plan], ["Membre depuis", new Date(user.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--br)" }}>
                  <span style={{ fontSize: 12.5, color: "var(--dim)" }}>{l}</span>
                  <span style={{ fontSize: 13.5, color: "var(--blanc)", fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <button onClick={() => auth.logout()} style={{ marginTop: 20, padding: "11px 20px", borderRadius: 100, background: "none", border: "1px solid var(--br2)", color: "var(--dim)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Se déconnecter</button>
            </div>
            <div style={Object.assign({}, card, { padding: 24 })}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Newsletter & mailing</div>
              <p style={{ fontSize: 12.5, color: "var(--dim)", lineHeight: 1.6, marginBottom: 16 }}>{user.newsletter ? "Tu es inscrit à la newsletter Urbe." : "Inscris-toi pour recevoir offres et dates."}</p>
              {user.newsletter ? (
                <button onClick={() => auth.update({ newsletter: false })} style={{ padding: "11px 20px", borderRadius: 100, background: "none", border: "1px solid var(--br2)", color: "var(--dim)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Se désinscrire</button>
              ) : (
                <button onClick={() => auth.update({ newsletter: true })} style={{ padding: "11px 22px", borderRadius: 100, background: "var(--rouge)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>M’inscrire à la newsletter</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── TWEAKS ─────────────────────────────────────────────────── */
function Tweaks() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const fn = (e) => {
      if (e.data?.type === '__activate_edit_mode') setVisible(true);
      if (e.data?.type === '__deactivate_edit_mode') setVisible(false);
    };
    window.addEventListener('message', fn);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', fn);
  }, []);
  if (!visible) return null;
  const themes = [
  { nom: 'Rouge Bordeaux (défaut)', r: '#8B1E1E', r2: '#a82424', r3: '#c12c2c' },
  { nom: 'Bordeaux Profond', r: '#6b1515', r2: '#8b1c1c', r3: '#a82424' },
  { nom: 'Cramoisi Vif', r: '#a01a1a', r2: '#c02020', r3: '#d93030' },
  { nom: 'Or / Ambre', r: '#8B6914', r2: '#a07820', r3: '#c09030' }];

  return (
    <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 9999, background: 'rgba(14,14,14,0.97)', border: '1px solid rgba(241,236,231,0.1)', borderRadius: 16, padding: 22, width: 268, backdropFilter: 'blur(16px)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#f1ece7' }}>Tweaks</span>
        <button onClick={() => {setVisible(false);window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');}} style={{ background: 'none', border: 'none', color: 'rgba(241,236,231,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(241,236,231,0.35)', textTransform: 'uppercase', marginBottom: 12 }}>Thème accent</div>
      {themes.map((t) =>
      <button key={t.nom} onClick={() => {
        document.documentElement.style.setProperty('--rouge', t.r);
        document.documentElement.style.setProperty('--rouge2', t.r2);
        document.documentElement.style.setProperty('--rouge3', t.r3);
        window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { theme: t.nom } }, '*');
      }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, background: 'none', border: '1px solid rgba(241,236,231,0.08)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = t.r}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(241,236,231,0.08)'}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: t.r3, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 500, color: '#f1ece7' }}>{t.nom}</span>
        </button>
      )}
    </div>);

}

/* ─── APP ────────────────────────────────────────────────────── */
function StripeMockOverlay() {
  const [data, setData] = useState(null);
  useEffect(() => {
    window.__urbeShowStripeMock = (d) => setData(d);
    return () => { delete window.__urbeShowStripeMock; };
  }, []);
  if (!data) return null;
  return (
    <div onClick={() => setData(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, overflow: 'hidden', fontFamily: 'Plus Jakarta Sans', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ background: '#635BFF', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <svg width="50" height="21" viewBox="0 0 60 25" fill="#fff"><path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-8.08-2.75h4.34c0-1.84-1.07-2.6-2.13-2.6-1.09 0-2.21.76-2.21 2.6zM44.05 5.47c-1.4 0-2.31.66-2.82 1.12l-.19-.89h-3.7v18.96l4.21-.89.01-4.6c.6.43 1.5 1.04 2.97 1.04 3.01 0 5.76-2.42 5.76-7.77-.01-4.9-2.79-7.97-6.25-6.97zM44 17.84c-.99 0-1.57-.35-1.97-.79l-.03-6.24c.43-.48 1.02-.82 2-.82 1.53 0 2.59 1.72 2.59 3.91 0 2.25-1.04 3.94-2.59 3.94zM36.16 4.47l-4.23.9v3.43l4.23-.9zM31.93 9.6h4.23v11.32h-4.23zM27.4 10.85l-.27-1.25h-3.64v11.32h4.21v-7.67c.99-1.3 2.67-1.06 3.19-.87V9.6c-.54-.2-2.5-.57-3.49 1.25zM18.97 6.78l-4.11.88-.02 13.5c0 2.5 1.87 4.33 4.36 4.33 1.38 0 2.39-.25 2.95-.55v-3.42c-.54.22-3.2 1-3.2-1.5v-4.59h3.2V9.6h-3.2zM9.39 9.6H5.16v11.32h4.23zM9.39 4.47l-4.23.9v3.43l4.23-.9zM4.96 13.04c0-.66.54-.92 1.44-.92 1.29 0 2.92.39 4.21 1.09V9.27a11.2 11.2 0 0 0-4.21-.77c-3.44 0-5.73 1.8-5.73 4.8 0 4.68 6.44 3.94 6.44 5.96 0 .78-.68 1.03-1.63 1.03-1.41 0-3.2-.58-4.62-1.36v4.01a11.73 11.73 0 0 0 4.62.96c3.53 0 5.96-1.75 5.96-4.79-.01-5.05-6.48-4.16-6.48-6.07z"/></svg>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', background: 'rgba(255,255,255,0.18)', padding: '3px 8px', borderRadius: 5 }}>MODE TEST</span>
        </div>
        <div style={{ padding: '28px 24px' }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Urbe Studio</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#1a1a1a', marginBottom: 18 }}>{data.summary?.total ?? '—'},00 €</div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 20, lineHeight: 1.5 }}>{data.summary?.productLabel}{data.summary?.date ? ` · ${data.summary.date} ${data.summary.time}` : ''}</div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: '#9ca3af' }}>4242 4242 4242 4242 · 12/34 · 123</div>
          <button onClick={() => { setData(null); }} style={{ width: '100%', padding: 13, borderRadius: 8, background: '#635BFF', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans' }}>Payer {data.summary?.total}€</button>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 14, lineHeight: 1.5, textAlign: 'center' }}>Aperçu de démonstration. Connectez vos liens Stripe réels dans <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>URBE_CONFIG.stripe</code> et passez <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>paymentMode: 'live'</code>.</p>
        </div>
      </div>
    </div>
  );
}

/* ─── TOAST HOST (notifications email simulées) ────────────────── */
/* ─── CONFIRM DIALOG (actions destructrices) ─────────────────── */
const urbeConfirm = (opts) => (typeof window !== 'undefined' && window.__urbeConfirm) ? window.__urbeConfirm(opts || {}) : Promise.resolve(window.confirm((opts && opts.message) || 'Confirmer ?'));
function ConfirmHost() {
  const [data, setData] = useState(null);
  useEffect(() => {
    window.__urbeConfirm = (opts) => new Promise((resolve) => setData(Object.assign({}, opts, { resolve })));
    return () => { delete window.__urbeConfirm; };
  }, []);
  if (!data) return null;
  const close = (val) => { try { data.resolve(val); } catch (e) {} setData(null); };
  return (
    <div onClick={() => close(false)} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 404, background: 'var(--noir)', border: '1px solid var(--br2)', borderRadius: 18, padding: 28, boxShadow: '0 30px 80px rgba(0,0,0,0.65)' }}>
        <h3 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 25, letterSpacing: '0.01em', lineHeight: 1.05, marginBottom: 10 }}>{data.title || 'Confirmer ?'}</h3>
        <p style={{ fontSize: 13.5, color: 'var(--dim)', lineHeight: 1.6, marginBottom: 24 }}>{data.message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => close(false)} style={{ padding: '11px 20px', borderRadius: 100, background: 'none', border: '1px solid var(--br2)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{data.cancelLabel || 'Annuler'}</button>
          <button onClick={() => close(true)} autoFocus style={{ padding: '11px 22px', borderRadius: 100, background: 'var(--rouge)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{data.confirmLabel || 'Confirmer'}</button>
        </div>
      </div>
    </div>
  );
}

function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    window.__urbeToast = (msg, kind) => {
      const id = 't_' + Date.now() + Math.random().toString(36).slice(2, 5);
      setToasts(t => [...t, { id, msg, kind }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
    };
    return () => { delete window.__urbeToast; };
  }, []);
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 4000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '13px 15px', borderRadius: 13, background: 'rgba(20,20,20,0.97)', border: '1px solid ' + (t.kind === 'email' ? 'rgba(193,44,44,0.4)' : 'var(--br2)'), boxShadow: '0 16px 44px rgba(0,0,0,0.6)', animation: 'toastIn 0.32s cubic-bezier(0.2,0.8,0.3,1)', backdropFilter: 'blur(10px)' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: t.kind === 'email' ? 'rgba(193,44,44,0.16)' : 'rgba(241,236,231,0.06)', border: '1px solid ' + (t.kind === 'email' ? 'rgba(193,44,44,0.34)' : 'var(--br2)'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {t.kind === 'email'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="var(--rouge3)" strokeWidth="1.6"/><path d="M4 7l8 6 8-6" stroke="var(--rouge3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#3ad17a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--blanc)', lineHeight: 1.5, paddingTop: 1 }}>{t.msg}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── CONSENTEMENT COOKIES / FACADE TIERS (CONF-02) ──────────── */
function urbeSetConsent(v) {
  try { localStorage.setItem('urbe_cookie_consent', v); } catch (e) {}
  window.dispatchEvent(new Event('urbe-consent'));
}
function useConsent() {
  const read = () => { try { return localStorage.getItem('urbe_cookie_consent') === 'all'; } catch (e) { return false; } };
  const [ok, setOk] = useState(read);
  useEffect(() => {
    const h = () => setOk(read());
    window.addEventListener('urbe-consent', h);
    return () => window.removeEventListener('urbe-consent', h);
  }, []);
  return ok;
}
function ThirdPartyEmbed({ label, height = 200, setPage, children }) {
  const ok = useConsent();
  if (ok) return children;
  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: '24px', background: 'var(--s2)', border: '1px dashed var(--br2)', borderRadius: 12 }}>
      <div style={{ fontFamily: 'Space Mono', fontSize: 11, letterSpacing: '0.12em', color: 'var(--dim)', textTransform: 'uppercase' }}>Contenu {label} bloqué</div>
      <div style={{ fontSize: 13, color: 'var(--dim)', fontWeight: 300, maxWidth: 320, lineHeight: 1.6 }}>Ce lecteur dépose des cookies tiers. Activez-les pour l'afficher.</div>
      <button className="urbe-tap" onClick={() => urbeSetConsent('all')} style={{ background: 'var(--rouge)', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Activer &amp; charger {label}</button>
    </div>);
}
function CookieBanner({ setPage }) {
  const [decided, setDecided] = useState(() => { try { return !!localStorage.getItem('urbe_cookie_consent'); } catch (e) { return true; } });
  if (decided) return null;
  const choose = (v) => { urbeSetConsent(v); setDecided(true); };
  return (
    <div role="dialog" aria-label="Consentement aux cookies" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 9998, maxWidth: 720, margin: '0 auto', background: 'rgba(14,14,14,0.97)', backdropFilter: 'blur(16px) saturate(1.2)', border: '1px solid var(--br2)', borderRadius: 16, padding: '20px 22px', boxShadow: '0 24px 70px rgba(0,0,0,0.6)', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 280px', minWidth: 240 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--blanc)', marginBottom: 6 }}>Cookies &amp; contenus tiers</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', fontWeight: 300, lineHeight: 1.6 }}>Nous utilisons des cookies pour les lecteurs Spotify, YouTube et l'agenda. Vous pouvez accepter ou refuser ces traceurs tiers. <span onClick={() => { choose('essential'); setPage && setPage('confidentialite'); }} style={{ color: 'var(--rouge3)', cursor: 'pointer', textDecoration: 'underline' }}>En savoir plus</span></div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button className="urbe-tap" onClick={() => choose('essential')} style={{ background: 'none', color: 'var(--blanc)', border: '1px solid var(--br2)', padding: '11px 20px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Refuser</button>
        <button className="urbe-tap" onClick={() => choose('all')} style={{ background: 'var(--rouge)', color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 100, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(139,30,30,0.4)' }}>Tout accepter</button>
      </div>
    </div>);
}

/* ─── PAGES LÉGALES (CONF-01) ────────────────────────────────── */
function LegalPage({ section = 'mentions', setPage }) {
  const tabs = [
    { id: 'mentions', label: 'Mentions légales' },
    { id: 'confidentialite', label: 'Confidentialité' },
    { id: 'cgv', label: 'CGV' },
  ];
  const [active, setActive] = useState(section);
  useEffect(() => { setActive(section); }, [section]);

  const H = ({ children }) => <h2 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 24, textTransform: 'uppercase', letterSpacing: '0.02em', margin: '34px 0 12px', color: 'var(--blanc)' }}>{children}</h2>;
  const P = ({ children }) => <p style={{ fontSize: 14.5, color: 'var(--dim)', lineHeight: 1.8, fontWeight: 300, marginBottom: 12 }}>{children}</p>;
  const TODO = ({ children }) => <span style={{ fontFamily: 'Space Mono', fontSize: 12.5, color: 'var(--ambre, #e0a33a)', background: 'rgba(224,163,58,0.1)', padding: '1px 6px', borderRadius: 4 }}>{children}</span>;

  const content = {
    mentions: (
      <div>
        <H>Mentions légales</H>
        <P>Le présent site est édité par <b style={{ color: 'var(--blanc)', fontWeight: 600 }}>URBE NOCTEM</b> (exploitant la marque « Urbe Studio »), studio d'enregistrement situé au 37 rue d'Hauteville, 75010 Paris, France.</P>
        <P>Forme juridique : Société par actions simplifiée à associé unique (SASU) — Capital social : 50 € — RCS Paris 999 111 743 — Identifiant européen (EUID) : FR7501.999111743 — TVA intracommunautaire : FR30 999 111 743.</P>
        <P>Directeur de la publication : le représentant légal de la société URBE NOCTEM. Contact : contact@urbestudio.fr.</P>
        <H>Hébergement</H>
        <P>Le site est hébergé par Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis — netlify.com.</P>
        <H>Propriété intellectuelle</H>
        <P>L'ensemble des contenus présents sur ce site (textes, visuels, logos, enregistrements, vidéos) est la propriété d'Urbe Studio ou de ses partenaires et est protégé par le droit d'auteur. Toute reproduction sans autorisation est interdite.</P>
      </div>
    ),
    confidentialite: (
      <div>
        <H>Politique de confidentialité</H>
        <P>Urbe Studio collecte des données personnelles (nom, email, informations de réservation) uniquement dans le cadre de la gestion des demandes, réservations et paiements. Ces données ne sont jamais revendues à des tiers.</P>
        <H>Données collectées</H>
        <P>Lors d'une prise de contact ou d'une réservation : nom, adresse email, détails de la session souhaitée. Lors d'un paiement : les informations bancaires sont traitées directement par notre prestataire <b style={{ color: 'var(--blanc)', fontWeight: 600 }}>Stripe</b> et ne transitent jamais par nos serveurs.</P>
        <H>Cookies & services tiers</H>
        <P>Le site intègre des contenus tiers (Spotify, YouTube, Google Agenda) qui peuvent déposer des cookies. Ces contenus ne sont chargés qu'après votre consentement explicite via le bandeau dédié.</P>
        <H>Vos droits (RGPD)</H>
        <P>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. Pour l'exercer, écrivez à contact@urbestudio.fr. Responsable du traitement : URBE NOCTEM — contact@urbestudio.fr.</P>
      </div>
    ),
    cgv: (
      <div>
        <H>Conditions Générales de Vente</H>
        <P>Les présentes CGV régissent les prestations de studio (enregistrement, mixage, mastering, production, forfaits) proposées par Urbe Studio.</P>
        <H>Réservation & paiement</H>
        <P>Toute réservation est confirmée après acceptation de la demande par le studio. Les prestations de mixage requièrent un acompte de 50 % à la commande. Les paiements sont sécurisés via Stripe.</P>
        <H>Annulation & report</H>
        <P>Toute annulation doit intervenir au moins 48h avant la session réservée. Passé ce délai, l'acompte versé reste acquis au studio. Un report est possible sous réserve de disponibilité.</P>
        <H>Livraison</H>
        <P>Les délais de livraison (mix standard 7 jours, urgent 48h) courent à compter de la réception complète des fichiers sources. Le nombre de révisions incluses est précisé pour chaque prestation.</P>
        <H>Litiges</H>
        <P>Les présentes CGV sont soumises au droit français. En cas de litige, une solution amiable sera recherchée avant toute action judiciaire ; à défaut, les tribunaux de Paris seront seuls compétents. Conformément à l'article L.612-1 du Code de la consommation, le client peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d'un éventuel litige.</P>
      </div>
    ),
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: 60 }}>
      <div style={{ padding: '64px 28px 96px', maxWidth: 820, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', color: 'var(--rouge3)', textTransform: 'uppercase', marginBottom: 12 }}>Informations légales</div>
        <h1 style={{ fontFamily: 'Barlow Condensed', fontWeight: 800, fontSize: 'clamp(40px,5vw,64px)', letterSpacing: '0.02em', marginBottom: 28, lineHeight: 0.95 }}>CADRE LÉGAL<br />& CONFIANCE.</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, borderBottom: '1px solid var(--br)', paddingBottom: 16 }}>
          {tabs.map((t) =>
          <button key={t.id} className="urbe-tap" onClick={() => setActive(t.id)} style={{
            padding: '8px 18px', borderRadius: 100, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: 'Plus Jakarta Sans',
            background: active === t.id ? 'var(--rouge)' : 'var(--s1)',
            color: active === t.id ? '#fff' : 'var(--dim)',
            border: `1px solid ${active === t.id ? 'var(--rouge)' : 'var(--br2)'}`, transition: 'all 0.2s'
          }}>{t.label}</button>
          )}
        </div>
        {content[active]}
        <button onClick={() => setPage && setPage('home')} className="urbe-tap" style={{ marginTop: 28, background: 'none', border: '1px solid var(--br2)', color: 'var(--blanc)', padding: '11px 24px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>← Retour à l'accueil</button>
      </div>
    </div>);
}

/* ─── AGENT CHAT (widget conversationnel → n8n → conversion réservation) ─── */
function ChatAgent() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: 'bot', text: "Salut 👋 Studio, tarifs, mix… dis-moi ce que tu cherches, je t'aide à réserver." }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const sidRef = useRef(null);
  const scrollRef = useRef(null);
  const url = (typeof window !== 'undefined' && window.URBE_CONFIG && window.URBE_CONFIG.chatWebhook) || '';
  if (!sidRef.current) {
    let s = null;
    try { s = localStorage.getItem('urbe_chat_sid'); } catch (e) {}
    if (!s) { s = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); try { localStorage.setItem('urbe_chat_sid', s); } catch (e) {} }
    sidRef.current = s;
  }
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy, open]);
  if (!url) return null;
  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Urbe-Key': URBE_WEBHOOK_KEY }, body: JSON.stringify({ message: text, sessionId: sidRef.current }) }).
    then((r) => r.json()).then((d) => { setMsgs((m) => [...m, { role: 'bot', text: (d && d.reply) || "Petite coupure… réessaie, ou écris-nous à contact@urbestudio.fr." }]); }).
    catch(() => { setMsgs((m) => [...m, { role: 'bot', text: "Connexion impossible. Tu peux réserver directement ou nous écrire à contact@urbestudio.fr." }]); }).
    then(() => setBusy(false));
  };
  const goBooking = () => { setOpen(false); if (window.__urbeNav) window.__urbeNav('booking'); };
  return (
    <React.Fragment>
      {open &&
      <div style={{ position: 'fixed', bottom: 92, right: 24, width: 360, maxWidth: 'calc(100vw - 32px)', height: 520, maxHeight: 'calc(100vh - 130px)', background: 'rgba(14,14,14,0.98)', border: '1px solid var(--br2)', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)', zIndex: 9000, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: '1px solid var(--br)', background: 'var(--s1)' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--rouge)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Barlow Condensed', fontWeight: 800, color: '#fff', fontSize: 16, flexShrink: 0 }}>U</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--blanc)' }}>Assistant Urbe</div>
              <div style={{ fontSize: 10.5, color: '#3ad17a', display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ad17a', boxShadow: '0 0 6px #3ad17a' }} />en ligne</div>
            </div>
            <button onClick={goBooking} style={{ background: 'var(--rouge)', color: '#fff', border: 'none', padding: '7px 13px', borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Réserver →</button>
            <button onClick={() => setOpen(false)} aria-label="Fermer le chat" style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '0 2px' }}>×</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.map((m, i) =>
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '84%', background: m.role === 'user' ? 'var(--rouge)' : 'var(--s2)', color: m.role === 'user' ? '#fff' : 'var(--blanc)', border: m.role === 'user' ? 'none' : '1px solid var(--br)', borderRadius: 14, padding: '9px 13px', fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.text}</div>
            )}
            {busy && <div style={{ alignSelf: 'flex-start', color: 'var(--dim)', fontSize: 13, padding: '4px 8px' }}>L'assistant écrit…</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--br)' }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Écris ton message…" style={{ flex: 1, minWidth: 0, background: 'var(--s1)', border: '1px solid var(--br)', color: 'var(--blanc)', borderRadius: 100, padding: '10px 16px', fontSize: 13.5, outline: 'none' }} />
            <button onClick={send} disabled={busy || !input.trim()} aria-label="Envoyer" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', background: 'var(--rouge)', border: 'none', color: '#fff', cursor: busy || !input.trim() ? 'default' : 'pointer', opacity: busy || !input.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12l16-8-6 16-3-7-7-1z" fill="currentColor" /></svg>
            </button>
          </div>
        </div>
      }
      <button onClick={() => setOpen((o) => !o)} aria-label="Ouvrir le chat" style={{ position: 'fixed', bottom: 24, right: 24, width: 58, height: 58, borderRadius: '50%', background: 'var(--rouge)', border: 'none', cursor: 'pointer', boxShadow: '0 12px 32px rgba(139,30,30,0.5)', zIndex: 9001, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.06)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
        {open ?
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg> :
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" /></svg>}
      </button>
    </React.Fragment>);

}

/* ─── ANALYTICS (Google Analytics 4, conditionnel au consentement) ─── */
function Analytics() {
  useEffect(() => {
    const cfg = (window.URBE_CONFIG && window.URBE_CONFIG.analytics) || {};
    const gtmId = cfg.gtmId || '';
    const ga4Id = cfg.ga4Id || '';
    if (!gtmId && !ga4Id) return; // désactivé tant qu'aucun identifiant n'est fourni
    let loaded = false;
    const consentGranted = () => { try { return localStorage.getItem('urbe_cookie_consent') === 'all'; } catch (e) { return false; } };
    const load = () => {
      if (loaded || !consentGranted()) return; // chargé seulement après consentement (RGPD)
      loaded = true;
      window.dataLayer = window.dataLayer || [];
      if (gtmId) {
        // Google Tag Manager (la balise GA4 se configure dans l'interface GTM)
        window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
        const s = document.createElement('script');
        s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=' + gtmId;
        document.head.appendChild(s);
      } else {
        // GA4 direct (gtag.js)
        const s = document.createElement('script');
        s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ga4Id;
        document.head.appendChild(s);
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', ga4Id, { anonymize_ip: true });
      }
    };
    load();
    window.addEventListener('urbe-consent', load);
    return () => window.removeEventListener('urbe-consent', load);
  }, []);
  return null;
}

function App() {
  const [page, setPage] = useState('home');
  const [bookingProduct, setBookingProduct] = useState(null);
  useEffect(() => {window.scrollTo({ top: 0, behavior: 'smooth' });if (window.closeMixBookingModal) window.closeMixBookingModal();if (window.dataLayer) window.dataLayer.push({ event: 'page_view', page_title: page, page_path: '/' + (page === 'home' ? '' : page) });if (window.gtag) window.gtag('event', 'page_view', { page_title: page });}, [page]);
  const goTo = (p, productId = null) => { if (productId) setBookingProduct(productId); setPage(p); };
  useEffect(() => { window.__urbeNav = goTo; return () => { delete window.__urbeNav; }; }, []);
  // Deep-links par hash (depuis le blog : index.html#reserver → tunnel de réservation)
  useEffect(() => {
    const HASH_MAP = { reserver: 'booking', booking: 'booking', contact: 'contact', studio: 'studio', credits: 'credits', school: 'school' };
    const applyHash = () => { const h = (window.location.hash || '').replace('#', '').toLowerCase(); if (HASH_MAP[h]) setPage(HASH_MAP[h]); };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);
  return (
    <div>
      <a href="#contenu" style={{ position: 'absolute', left: -9999, top: 8, zIndex: 999, background: 'var(--rouge)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }} onFocus={(e) => { e.target.style.left = '12px'; }} onBlur={(e) => { e.target.style.left = '-9999px'; }}>Aller au contenu</a>
      <Nav page={page} setPage={setPage} />
      <main id="contenu">
        {page === 'home' && <HomePage setPage={goTo} />}
        {page === 'credits' && <CreditsPage setPage={goTo} />}
        {page === 'studio' && <StudioPage setPage={goTo} />}
        {page === 'booking' && <BookingPage initialProductId={bookingProduct} />}
        {page === 'school' && <SchoolPage setPage={goTo} />}
        {page === 'contact' && <ContactPage />}
        {/* Espace abonné masqué pour le v1 (en attente d'une vraie auth serveur). */}
        {(page === 'mentions' || page === 'confidentialite' || page === 'cgv') && <LegalPage section={page} setPage={goTo} />}
      </main>
      {page !== 'dashboard' && <SiteFooter setPage={goTo} />}
      <StripeMockOverlay />
      <ConfirmHost />
      <ToastHost />
      <CookieBanner setPage={goTo} />
      <Analytics />
      <ChatAgent />
      <Tweaks />
    </div>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);


