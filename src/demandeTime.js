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
    case 'expired': return { label: 'Expirée (36 h sans réponse)', at: d.expiredAt || (d.createdAt + 36 * 3600 * 1000), final: true };
    case 'declined': return { label: 'Annulée par le gérant', at: d.acceptedAt, final: true };
    case 'unavailable': return { label: 'Indisponible', at: d.acceptedAt, final: true };
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

// Classement des gérants proposés au client (choix de la demande, onglet Gérants) :
//  1. cabines officielles (les mieux étoilées d'abord)
//  2. le gérant de la DERNIÈRE demande du client
//  3. gérants certifiés, les mieux étoilés d'abord
//  4. les autres, les mieux étoilés d'abord
// À égalité : ceux que le client a déjà sollicités (plus récent d'abord), puis l'ordre d'origine.
export function rankGerants(gerants, demandes) {
  const last = {};
  (demandes || []).forEach((d) => { if (d.gerantUserId) last[d.gerantUserId] = Math.max(last[d.gerantUserId] || 0, d.createdAt || 0); });
  let lastId = null, lastAt = 0;
  Object.keys(last).forEach((id) => { if (last[id] > lastAt) { lastAt = last[id]; lastId = id; } });
  const tier = (g) => (g.official ? 0 : g.userId && g.userId === lastId ? 1 : g.certified ? 2 : 3);
  return (gerants || []).map((g, i) => ({ g, i })).sort((a, b) =>
    (tier(a.g) - tier(b.g)) || ((b.g.stars || 0) - (a.g.stars || 0)) || ((last[b.g.userId] || 0) - (last[a.g.userId] || 0)) || (a.i - b.i),
  ).map((x) => ({ ...x.g, isLast: !!(x.g.userId && x.g.userId === lastId) }));
}

// « Récents » : demandes des 7 derniers jours, purement par date (plus récent en haut).
export const RECENT_MS = 7 * 86400000;
export const isRecent = (d, now = Date.now()) => (now - lastActivity(d)) <= RECENT_MS;
export const sortByRecent = (list) => [...(list || [])].sort((a, b) => lastActivity(b) - lastActivity(a));

// ---- Relance « J'attends toujours » (client → gérant) ----
// Tant que le gérant n'a PAS accusé réception (ni accepté, ni demandé le
// paiement, ni confirmé/contesté l'argent…), le client peut le relancer :
// à 1 min, puis 3 min, puis 5 min après le lancement (3 relances maximum).
export const NUDGE_SLOTS_MS = [60000, 180000, 300000];
export function awaitingAck(d) {
  if (!d) return false;
  if (d.status === 'pending') return true;
  return d.status === 'paid' && !d.acceptedAt && !d.moneyReceived && !d.notReceivedAt && !d.paymentRequestedAt;
}
// Phase 2 : le client a PAYÉ, le gérant a accusé réception de la demande
// (ou de l'argent) mais le client n'a toujours pas été servi. Il doit pouvoir
// relancer : « J'ai payé, j'attends toujours ». Les cas qui ont déjà leur propre
// dialogue (montant non reçu / incomplet / contesté) sont exclus.
export function awaitingService(d) {
  if (!d || d.status !== 'paid' || awaitingAck(d)) return false;
  return !d.notReceivedAt && !d.partialAt && !d.clientDisputedAt;
}
// { can, count, nextAt, exhausted, phase: 'ack' | 'service' | null }
export function nudgeState(d, now = Date.now()) {
  const phase = awaitingAck(d) ? 'ack' : awaitingService(d) ? 'service' : null;
  if (!phase) return { can: false, count: 0, nextAt: 0, exhausted: false, phase };
  const count = (phase === 'ack' ? d.nudgeCount : d.paidNudgeCount) || 0;
  if (count >= NUDGE_SLOTS_MS.length) return { can: false, count, nextAt: 0, exhausted: true, phase };
  const base = phase === 'ack' ? (d.createdAt || 0) : (d.paidAt || d.createdAt || 0);
  const nextAt = base + NUDGE_SLOTS_MS[count];
  return { can: now >= nextAt, count, nextAt, exhausted: false, phase };
}
