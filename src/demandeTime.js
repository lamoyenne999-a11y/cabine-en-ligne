// Repères de temps et ordre d'affichage des demandes (client et gérant).
const DATE_OPT = { day: '2-digit', month: 'short', year: 'numeric' };
const TIME_OPT = { hour: '2-digit', minute: '2-digit' };
export const fmtDateTime = (t) => (t ? `${new Date(t).toLocaleDateString('fr-FR', DATE_OPT)} à ${new Date(t).toLocaleTimeString('fr-FR', TIME_OPT)}` : '');
export const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString('fr-FR', TIME_OPT) : '');

// Une demande est « réglée » quand plus rien n'est attendu de personne.
export function isSettled(d) {
  if (!d) return true;
  if (['canceled', 'declined', 'unavailable'].includes(d.status)) return true;
  if (d.status === 'completed') return !!d.moneyReceived && !(d.partialAt && !d.moneyReceived);
  return false; // pending, accepted, paid
}

// Dernier mouvement sur la demande (pour trier les demandes réglées).
export function lastActivity(d) {
  return Math.max(d.createdAt || 0, d.acceptedAt || 0, d.paidAt || 0, d.completedAt || 0, d.canceledAt || 0,
    d.receivedAt || 0, d.clientConfirmedAt || 0, d.partialAt || 0, d.notServedAt || 0, d.notReceivedAt || 0);
}

// Étape finale (ou dernière étape en cours) : { label, at, final }.
export function finalStep(d) {
  switch (d.status) {
    case 'completed': return { label: 'Terminée', at: d.clientConfirmedAt || d.completedAt || d.receivedAt, final: true };
    case 'canceled': return { label: 'Annulée', at: d.canceledAt, final: true };
    case 'declined': return { label: 'Refusée', at: d.acceptedAt, final: true };
    case 'unavailable': return { label: 'Gérant indisponible', at: d.acceptedAt, final: true };
    case 'paid': return { label: 'Payée', at: d.paidAt, final: false };
    case 'accepted': return { label: d.paymentRequestedAt ? 'Paiement demandé' : 'Acceptée', at: d.paymentRequestedAt || d.acceptedAt, final: false };
    default: return { label: 'En attente', at: 0, final: false };
  }
}

// Ordre : d'abord les demandes EN COURS (plus récentes en haut), puis les
// autres par dernier mouvement décroissant.
// `isOpen` permet de définir ce qui est « en cours » selon l'écran :
//  - client : En attente / À payer (= compteur « En cours ») ;
//  - gérant : tout ce qui attend encore une action de sa part (défaut).
export function sortDemandes(list, isOpen = (d) => !isSettled(d)) {
  return [...(list || [])].sort((a, b) => {
    const sa = isOpen(a) ? 0 : 1, sb = isOpen(b) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return sa === 0 ? (b.createdAt || 0) - (a.createdAt || 0) : lastActivity(b) - lastActivity(a);
  });
}

// Gérants classés selon la dernière demande que le client leur a faite
// (le plus récent en premier) ; ceux jamais sollicités gardent leur ordre.
export function sortGerantsByRecentUse(gerants, demandes) {
  const last = {};
  (demandes || []).forEach((d) => { if (d.gerantUserId) last[d.gerantUserId] = Math.max(last[d.gerantUserId] || 0, d.createdAt || 0); });
  return (gerants || []).map((g, i) => ({ g, i })).sort((a, b) => ((last[b.g.userId] || 0) - (last[a.g.userId] || 0)) || (a.i - b.i)).map((x) => x.g);
}

// « Récents » : demandes des 7 derniers jours, purement par date (plus récent en haut).
export const RECENT_MS = 7 * 86400000;
export const isRecent = (d, now = Date.now()) => (now - lastActivity(d)) <= RECENT_MS;
export const sortByRecent = (list) => [...(list || [])].sort((a, b) => lastActivity(b) - lastActivity(a));
