/* ─── SEO par page — source unique (runtime app + génération statique au build) ───
   Utilisé par :
   - src/main.jsx  (applyRuntimeHead) pour mettre à jour le <head> lors de la nav client.
   - scripts/gen-pages.mjs pour écrire un HTML statique par route (title/description/
     canonical/OG/JSON-LD corrects dès le HTML brut, pour Google et les robots sociaux).
   MODIF SEO d'une page = ici, un seul endroit. */

export const SITE = 'https://www.urbestudio.fr';
export const OG_IMAGE = SITE + '/studio/cabine.jpg'; // [À REMPLIR] idéalement une image OG dédiée 1200×630
const PHONE = '+33667126235'; // 06 67 12 62 35 — appel / SMS / WhatsApp

/* Coordonnées réelles — source unique (JSON-LD + footer + page contact). */
export const CONTACT = {
  phoneDisplay: '06 67 12 62 35',
  tel: '+33667126235',
  sms: 'sms:+33667126235',
  whatsapp: 'https://wa.me/33667126235',
  email: 'contact@urbestudio.fr',
  instagram: 'https://www.instagram.com/urbestudioparis/',
  tiktok: 'https://www.tiktok.com/@urbe.studio.paris',
  youtube: 'https://www.youtube.com/@urbestudio',
};

/* Bloc LocalBusiness partagé (présent sur toutes les pages) */
const localBusiness = {
  '@context': 'https://schema.org',
  '@type': 'MusicVenue',
  '@id': SITE + '/#studio',
  name: 'URBE STUDIO',
  description: "Studio d'enregistrement professionnel à Paris 10, ouvert 24h/24 et 7j/7. Enregistrement, mixage et mastering pour rap, hip-hop, pop et électro.",
  url: SITE + '/',
  image: SITE + '/studio/cabine.jpg',
  logo: SITE + '/studio/urbe-logo.png',
  email: 'contact@urbestudio.fr',
  priceRange: '€€',
  currenciesAccepted: 'EUR',
  address: { '@type': 'PostalAddress', streetAddress: "37 rue d'Hauteville", addressLocality: 'Paris', postalCode: '75010', addressCountry: 'FR' },
  geo: { '@type': 'GeoCoordinates', latitude: 48.8696, longitude: 2.349 }, // [À VÉRIFIER] coordonnées GPS
  areaServed: { '@type': 'City', name: 'Paris' },
  openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' }],
  hasOfferCatalog: {
    '@type': 'OfferCatalog', name: 'Services studio',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Enregistrement studio' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Mixage' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Mastering' } },
    ],
  },
  sameAs: ['https://www.instagram.com/urbestudioparis/', 'https://www.tiktok.com/@urbe.studio.paris', 'https://www.youtube.com/@urbestudio'],
};
if (PHONE) localBusiness.telephone = PHONE;

const breadcrumb = (name, path) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
    { '@type': 'ListItem', position: 2, name, item: SITE + path },
  ],
});

const mixService = {
  '@context': 'https://schema.org', '@type': 'Service',
  serviceType: 'Mixage et mastering audio', name: 'Mixage & Mastering — Paris 10',
  provider: { '@id': SITE + '/#studio' }, areaServed: { '@type': 'City', name: 'Paris' },
  url: SITE + '/mixage-mastering',
};

const contactFaq = {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'Le studio est-il ouvert la nuit ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui, ouvert 24h/24, 7j/7.' } },
    { '@type': 'Question', name: 'Puis-je venir avec mon propre beat ?', acceptedAnswer: { '@type': 'Answer', text: "Oui, tu viens avec ton son, on s'occupe du reste." } },
    { '@type': 'Question', name: 'Proposez-vous le mixage à distance ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui, mixage et mastering en ligne.' } },
  ],
};

const actusBlog = { '@context': 'https://schema.org', '@type': 'Blog', name: 'Journal URBE STUDIO', url: SITE + '/actualites', publisher: { '@id': SITE + '/#studio' } };

/* Page d'accueil (servie par index.html directement) */
export const HOME = {
  path: '/',
  title: "Studio d'Enregistrement Paris 10 | URBE STUDIO — Mix & Mastering 24h/24",
  description: "Studio pro Paris 10ème ouvert 24h/24. Enregistrement, mixage et mastering pour rap, pop, électro. 200+ artistes. Réserve au 37 rue d'Hauteville.",
  jsonLd: [localBusiness],
};

/* Toutes les sous-routes (clé = clé interne de page côté app) */
export const ROUTES = {
  studio: {
    path: '/studio',
    title: "Studio d'Enregistrement Paris 10 | Équipement & Cabine | URBE",
    description: 'Cabine acoustiquement traitée de 30m² au cœur de Paris 10. Matériel pro, monitoring haut de gamme. Réserve ta session d’enregistrement.',
    jsonLd: [localBusiness, breadcrumb('Studio', '/studio')],
  },
  'mixage-mastering': {
    path: '/mixage-mastering',
    title: 'Mixage & Mastering au Studio — Paris 10 | URBE STUDIO',
    description: "Mixage et mastering avec nos ingénieurs du son au studio, 37 rue d'Hauteville (Paris 10). Tous styles, écoute sur monitoring pro. Devis gratuit.",
    jsonLd: [localBusiness, mixService, breadcrumb('Mixage & Mastering', '/mixage-mastering')],
  },
  tarifs: {
    path: '/tarifs',
    title: "Tarifs Studio d'Enregistrement Paris 10 | URBE STUDIO",
    description: "Tarifs transparents pour l'enregistrement, le mixage et le mastering à Paris 10. Sessions dès 20€/h, mix 120€, mastering 50€. Devis personnalisé.",
    jsonLd: [localBusiness, breadcrumb('Tarifs', '/tarifs')],
  },
  credits: {
    path: '/artistes',
    title: 'Artistes & Crédits | URBE STUDIO Paris 10 — 200+ Talents',
    description: 'Découvre les artistes enregistrés au studio URBE à Paris 10. Plus de 200 talents : rap, hip-hop, pop, électro.',
    jsonLd: [localBusiness, breadcrumb('Artistes', '/artistes')],
  },
  contact: {
    path: '/contact',
    title: "Contact & Accès | URBE STUDIO — 37 rue d'Hauteville, Paris 10",
    description: "URBE STUDIO, 37 rue d'Hauteville, 75010 Paris. Métro Bonne Nouvelle. Studio ouvert 24h/24, 7j/7. Réserve ta session maintenant.",
    jsonLd: [localBusiness, contactFaq, breadcrumb('Contact', '/contact')],
  },
  actualites: {
    path: '/actualites',
    title: 'Actualités & Journal | URBE STUDIO — Studio Paris 10',
    description: "Actualités du studio URBE à Paris 10. Sessions, sorties d'artistes, événements. Studio d'enregistrement 24h/24.",
    jsonLd: [localBusiness, actusBlog, breadcrumb('Actualités', '/actualites')],
  },
  booking: {
    path: '/reservation',
    title: 'Réserver une session | URBE STUDIO Paris 10',
    description: "Réserve ta session d'enregistrement, ton mix ou ton mastering au studio URBE, Paris 10. Paiement en ligne sécurisé.",
    noindex: true, jsonLd: [localBusiness],
  },
  school: {
    path: '/ecole',
    title: "L'École | URBE STUDIO Paris 10",
    description: 'Formations et ateliers au studio URBE à Paris 10.',
    jsonLd: [localBusiness, breadcrumb('École', '/ecole')],
  },
  mentions: { path: '/mentions-legales', title: 'Mentions légales | URBE STUDIO', description: 'Mentions légales du site URBE STUDIO.', noindex: true, jsonLd: [] },
  confidentialite: { path: '/confidentialite', title: 'Politique de confidentialité | URBE STUDIO', description: 'Politique de confidentialité du site URBE STUDIO.', noindex: true, jsonLd: [] },
  cgv: { path: '/cgv', title: 'CGV | URBE STUDIO', description: 'Conditions générales de vente URBE STUDIO.', noindex: true, jsonLd: [] },
};

/* Retourne les données SEO pour une clé de page (défaut = accueil). */
export function seoFor(pageKey) {
  if (!pageKey || pageKey === 'home') return HOME;
  return ROUTES[pageKey] || HOME;
}
