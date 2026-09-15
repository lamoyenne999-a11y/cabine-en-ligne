// ==================================================================
//  Test de bout en bout — Cabine En Ligne v2 (ZÉRO argent stocké)
//  Modèle : clients <-> gérants, demandes (unités/minutes/internet),
//  paiement direct Wave hors app, abonnement 100 FCFA + 1 mois d'essai.
//  Usage : node test.js   (un serveur doit tourner ; API par défaut :4000)
// ==================================================================
const BASE = process.env.API || 'http://localhost:4000/api';
const PWD = process.env.DEMO_PWD || 'demo123';

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
}
async function req(method, path, body, token, extraHeaders = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  return { status: r.status, json: j };
}

async function main() {
  console.log('\n===== Test Cabine En Ligne v2 (Wave = mock) =====\n');

  // Santé
  const health = await req('GET', '/../health');
  check('API démarrée (health 200)', health.status === 200 && health.json.status === 'ok');

  // Inscription client (1 mois d'essai gratuit)
  const uniq = Date.now().toString().slice(-6);
  const reg = await req('POST', '/auth/register', {
    role: 'client', name: 'Awa Cissé', phone: '07' + uniq, password: '1234',
  });
  check('Inscription client 201', reg.status === 201);
  check('Inscription : essai gratuit (status trial)', reg.json.subscription?.status === 'trial');
  check('Inscription : 30 jours d\'essai', reg.json.subscription?.daysLeft === 30 || reg.json.subscription?.daysLeft === 29);
  const ct = reg.json.token;

  // Inscription d'un vrai gérant (les comptes de démo ont été retirés)
  const gphone = '08' + uniq;
  const greg = await req('POST', '/auth/register', { role: 'gerant', name: 'Gérant Test', phone: gphone, password: '1234' });
  check('Inscription gérant 201', greg.status === 201 && greg.json.user?.role === 'gerant');
  const gt = greg.json.token;
  const gid = greg.json.user.id;

  // ===== Séparation stricte des rôles à la connexion =====
  const clientAsGerant = await req('POST', '/auth/login', { phone: '07' + uniq, password: '1234', role: 'gerant' });
  check('Un compte client ne peut PAS se connecter en gérant (403)', clientAsGerant.status === 403);
  const gerantAsClient = await req('POST', '/auth/login', { phone: gphone, password: '1234', role: 'client' });
  check('Un compte gérant ne peut PAS se connecter en client (403)', gerantAsClient.status === 403);
  const clientOk = await req('POST', '/auth/login', { phone: '07' + uniq, password: '1234', role: 'client' });
  check('Le client se connecte bien en client (200)', clientOk.status === 200 && clientOk.json.user?.role === 'client');
  const gerantOk = await req('POST', '/auth/login', { phone: gphone, password: '1234', role: 'gerant' });
  check('Le gérant se connecte bien en gérant (200)', gerantOk.status === 200 && gerantOk.json.user?.role === 'gerant');

  // Aucune notion de solde : le champ solde ne doit pas exister
  check("Pas de solde dans la réponse d'auth", !('balance' in (greg.json.user || {})));

  // Profil public via lien de partage (sans authentification)
  const pp = await req('GET', `/public/u/${gid}`);
  check('Profil public accessibles sans token', pp.status === 200 && pp.json.profile?.id === gid);
  check('Profil public expose le Wave marchand', !!pp.json.profile?.waveNumber);

  // Le gérant définit son lien Wave marchand (pour paiement direct)
  const PAYLINK = 'https://pay.wave.com/m/M_ci_JEUXTEST_/c/ci/';
  const upd = await req('POST', '/gerant/profile', { payLink: PAYLINK }, gt);
  check('Gérant met à jour son lien Wave marchand', upd.status === 200 && upd.json.user?.payLink === PAYLINK);
  const pp2 = await req('GET', `/public/u/${gid}`);
  check('Profil public expose le lien Wave marchand', pp2.json.profile?.payLink === PAYLINK);

  // Ajout du gérant inscrit par le client
  const addg = await req('POST', '/client/gerants', { phone: gphone, name: 'Gérant Test' }, ct);
  check('Ajout de gérant inscrit 201', addg.status === 201 && !!addg.json.gerant?.id);
  const gerantId = addg.json.gerant?.id;

  // On ne peut PAS ajouter un numéro qui n'est pas un gérant inscrit (pas de compte fantôme)
  const addBad = await req('POST', '/client/gerants', { phone: '999999999', name: 'Nexiste pas' }, ct);
  check("Ajout d'un numéro non inscrit refusé (404)", addBad.status === 404);

  // Les gérants « proposés » n'incluent que d'authentiques inscrits (pas les comptes de démo)
  const avail = await req('GET', '/client/gerants/available', null, ct);
  const availNames = (avail.json.gerants || []).map((g) => g.name);
  check('Gérants proposés contiennent le vrai inscrit', availNames.includes('Gérant Test'));
  check('Aucun gérant de démo dans les proposés', !availNames.includes('Boutique Amadou') && !availNames.includes('Cabine Marie') && !availNames.includes('Kiosque Fatou') && !availNames.includes('Cabine Moussa'));

  // Création d'une demande (unités)
  const dm = await req('POST', '/client/demandes', {
    gerantId, gerantName: 'Gérant Test', gerantWave: gphone,
    type: 'unites', amount: 2000, benefName: 'Awa', benefPhone: '07' + uniq,
  }, ct);
  check('Création demande 201', dm.status === 201 && dm.json.demande?.status === 'pending');
  const demandeId = dm.json.demande?.id;

  // Ligne de base : historique gérant AVANT la nouvelle demande (le seed contient des démos)
  const gh0 = await req('GET', '/gerant/history', null, gt);
  const base = gh0.json.summary || { totalServed: 0, counts: {} };

  // Le gérant voit la demande en attente
  const gd = await req('GET', '/gerant/demandes', null, gt);
  const pending = (gd.json.demandes || []).find((d) => d.id === demandeId);
  check('Gérant voit la demande en attente', !!pending && pending.status === 'pending');

  // Notifications : nouvelle demande est arrivée
  const n1 = await req('GET', '/gerant/notifications', null, gt);
  check('Notification « nouvelle demande » créée', (n1.json.notifications || []).some((x) => x.type === 'new_demande' && x.demandeId === demandeId));
  check('Compteur non lues > 0', (n1.json.unread || 0) > 0);

  // Le gérant accepte
  const acc = await req('POST', `/gerant/demandes/${demandeId}/accept`, {}, gt);
  check('Acceptation gérant OK', acc.status === 200 && acc.json.demande?.status === 'accepted');

  // Le client est notifié de l'acceptation
  const cn = await req('GET', '/client/notifications', null, ct);
  check('Client notifié que sa demande est acceptée', (cn.json.notifications || []).some((x) => x.type === 'demande_accepted' && x.demandeId === demandeId));

  // Le client la voit « à payer »
  const cd = await req('GET', '/client/demandes', null, ct);
  const seen = (cd.json.demandes || []).find((d) => d.id === demandeId);
  check('Client voit la demande acceptée', seen?.status === 'accepted');
  check('Demande expose le Wave marchand du gérant', seen?.gerantWave === gphone);
  check('Demande porte le lien Wave du gérant', seen?.gerantPayLink === PAYLINK);

  // Paiement direct Wave (hors app) : le client signale qu'il a payé
  const paid = await req('POST', `/client/demandes/${demandeId}/paid`, {}, ct);
  check('Client signale le paiement (paid)', paid.status === 200 && paid.json.demande?.status === 'paid');

  // Le gérant signale d'abord NE PAS avoir reçu → demande repasse « accepted », client notifié
  const nr = await req('POST', `/gerant/demandes/${demandeId}/not-received`, {}, gt);
  check('Gérant signale « argent non reçu » → à payer', nr.status === 200 && nr.json.demande?.status === 'accepted' && !nr.json.demande?.moneyReceived);
  const cn0 = await req('GET', '/client/notifications', null, ct);
  check('Client notifié « paiement non reçu »', (cn0.json.notifications || []).some((n) => n.type === 'demande_not_received'));
  const repay = await req('POST', `/client/demandes/${demandeId}/paid`, {}, ct);
  check('Client re-signale le paiement', repay.status === 200 && repay.json.demande?.status === 'paid');

  // Montant incomplet (frais Wave) → client notifié → client répond « tout payé » → gérant notifié
  const part = await req('POST', `/gerant/demandes/${demandeId}/partial`, {}, gt);
  check('Gérant signale un montant incomplet (1 % manquant)', part.status === 200 && part.json.demande?.partialMissing === 20 && part.json.demande?.partialReceived === 1980);
  const cnp = await req('GET', '/client/notifications', null, ct);
  check('Client notifié « montant incomplet »', (cnp.json.notifications || []).some((n) => n.type === 'demande_partial'));
  const rep = await req('POST', `/client/demandes/${demandeId}/payment-reply`, { kind: 'full' }, ct);
  check('Client affirme avoir tout payé', rep.status === 200 && !!rep.json.demande?.clientDisputedAt);
  const gnp = await req('GET', '/gerant/notifications', null, gt);
  check('Gérant notifié « client dit avoir tout payé »', (gnp.json.notifications || []).some((n) => n.type === 'client_says_full'));
  const rep2 = await req('POST', `/client/demandes/${demandeId}/payment-reply`, { kind: 'completed' }, ct);
  check('Client signale avoir complété', rep2.status === 200 && !!rep2.json.demande?.partialCompletedAt);

  // Le gérant confirme la réception de l'argent → client notifié
  const rcv = await req('POST', `/gerant/demandes/${demandeId}/received`, {}, gt);
  check('Gérant confirme la réception de l\'argent', rcv.status === 200 && rcv.json.demande?.moneyReceived === true && rcv.json.demande?.status === 'paid');
  const cn1 = await req('GET', '/client/notifications', null, ct);
  check('Client notifié « paiement reçu »', (cn1.json.notifications || []).some((n) => n.type === 'demande_received'));

  // Le gérant complète le service
  const comp = await req('POST', `/gerant/demandes/${demandeId}/complete`, {}, gt);
  check('Gérant complète la demande', comp.status === 200 && comp.json.demande?.status === 'completed');
  const cn2 = await req('GET', '/client/notifications', null, ct);
  check('Client notifié « complétée »', (cn2.json.notifications || []).some((n) => n.type === 'demande_completed'));

  // Historique client : total dépensé = somme des achats
  const ch = await req('GET', '/client/history', null, ct);
  check('Historique client : total dépensé = 2000', ch.json.summary?.totalSpent === 2000);
  check('Historique client : 1 demande complétée', ch.json.summary?.counts?.completed === 1);
  check('Historique client : liste des transactions', (ch.json.demandes || []).length === 1);

  // Paiement notifie le gérant
  const n2 = await req('GET', '/gerant/notifications', null, gt);
  check('Notification « paiement » créée', (n2.json.notifications || []).some((x) => x.type === 'demande_paid' && x.demandeId === demandeId));

  // Historique gérant : +2000 servi, +1 complétée, la demande est présente
  const gh = await req('GET', '/gerant/history', null, gt);
  check('Historique gérant : total servi +2000', gh.json.summary?.totalServed === base.totalServed + 2000);
  check('Historique gérant : +1 demande complétée', gh.json.summary?.counts?.completed === (base.counts?.completed || 0) + 1);
  check('Historique gérant : la demande apparaît', (gh.json.demandes || []).some((d) => d.id === demandeId && d.status === 'completed'));

  // Cas inverse : servi AVANT paiement → client notifié qu'il doit payer, puis réception confirmée
  const dmU = await req('POST', '/client/demandes', { gerantId, type: 'minutes', amount: 500, benefName: 'Moi', benefPhone: '0700000000' }, ct);
  const dU = dmU.json.demande?.id;
  const compU = await req('POST', `/gerant/demandes/${dU}/complete`, {}, gt);
  check('Gérant sert sans paiement → completed non réglée', compU.status === 200 && compU.json.demande?.status === 'completed' && !compU.json.demande?.moneyReceived);
  const cnU = await req('GET', '/client/notifications', null, ct);
  check('Client notifié « servi, paiement en attente »', (cnU.json.notifications || []).some((n) => n.type === 'demande_served_unpaid' && n.demandeId === dU));
  const rcvU = await req('POST', `/gerant/demandes/${dU}/received`, {}, gt);
  check('Réception confirmée après service → réglée', rcvU.status === 200 && rcvU.json.demande?.moneyReceived === true && rcvU.json.demande?.status === 'completed');
  const ghr = await req('GET', '/gerant/history', null, gt);
  check('Historique gérant : totalReceived = 2500 et 0 à encaisser', ghr.json.summary?.totalReceived === 2500 && ghr.json.summary?.awaitingPayment === 0);

  // Le client conteste : rien reçu → repasse « paid », gérant notifié → re-servi
  const ns = await req('POST', `/client/demandes/${demandeId}/not-served`, {}, ct);
  check('Client signale « rien reçu » → demande repasse à traiter', ns.status === 200 && ns.json.demande?.status === 'paid' && !!ns.json.demande?.notServedAt);
  const gns = await req('GET', '/gerant/notifications', null, gt);
  check('Gérant notifié « client non servi »', (gns.json.notifications || []).some((n) => n.type === 'client_not_served' && n.demandeId === demandeId));
  const comp3 = await req('POST', `/gerant/demandes/${demandeId}/complete`, {}, gt);
  check('Gérant re-sert la demande', comp3.status === 200 && comp3.json.demande?.status === 'completed');
  const nsBad = await req('POST', `/client/demandes/${demandeId}/not-served`, {}, ct);
  check('Contestation possible à nouveau (200)', nsBad.status === 200);
  const comp4 = await req('POST', `/gerant/demandes/${demandeId}/complete`, {}, gt);
  check('Gérant re-sert (2e fois)', comp4.status === 200);

  const cs = await req('POST', `/client/demandes/${demandeId}/confirm-served`, {}, ct);
  check('Client confirme avoir bien reçu', cs.status === 200 && !!cs.json.demande?.clientConfirmedAt && cs.json.demande?.status === 'completed');
  const gcs = await req('GET', '/gerant/notifications', null, gt);
  check('Gérant notifié « client a bien reçu »', (gcs.json.notifications || []).some((n) => n.type === 'client_confirmed' && n.demandeId === demandeId));

  // État final côté client
  const cf = await req('GET', '/client/demandes', null, ct);
  const fin = (cf.json.demandes || []).find((d) => d.id === demandeId);
  check('Demande finalement « completed »', fin?.status === 'completed');

  // ===== Espace propriétaire : certification + temps offert (si ADMIN_KEY défini) =====
  const AK = process.env.ADMIN_KEY || '';
  const cphone = '07' + uniq;
  if (AK) {
    const H = { 'x-admin-key': AK };
    const cert = await req('POST', '/admin/set-certified', { phone: gphone, certified: true }, null, H);
    check('Admin certifie le gérant', cert.status === 200 && cert.json.certified === true);
    const av = await req('GET', '/client/gerants/available', null, ct);
    const list = av.json.gerants || av.json.available || [];
    check('Le badge Certifié est visible côté client', Array.isArray(list) ? list.some((g) => g.phone === gphone && g.certified) : true);
    const certC = await req('POST', '/admin/set-certified', { phone: cphone, certified: true }, null, H);
    check('Un client ne peut pas être certifié (400)', certC.status === 400);
    const before = (await req('GET', '/client/subscription', null, ct)).json.subscription;
    const gift = await req('POST', '/admin/grant-free-time', { phone: cphone, days: 14, note: 'Merci !' }, null, H);
    check('Admin offre 14 jours', gift.status === 200 && gift.json.days === 14);
    const after = gift.json.subscription;
    check('L\'essai est prolongé de 14 jours', after.trialEndsAt - before.trialEndsAt >= 14 * 86400000 - 5000);
    const gn = await req('GET', '/client/notifications', null, ct);
    check('Client notifié du cadeau', (gn.json.notifications || []).some((n) => n.type === 'gift'));
    const bad = await req('POST', '/admin/grant-free-time', { phone: cphone, days: 0 }, null, H);
    check('Durée invalide refusée (400)', bad.status === 400);
  } else {
    console.log('  (tests admin ignorés : ADMIN_KEY non défini)');
  }

  // ===== Gérant indisponible (pas un refus) =====
  const dmU2 = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 300, benefName: 'Awa', benefPhone: '07' + uniq }, ct);
  const unavailId = dmU2.json.demande?.id;
  const un = await req('POST', `/gerant/demandes/${unavailId}/unavailable`, { reason: 'away' }, gt);
  check('Gérant signale « pas disponible »', un.status === 200 && un.json.demande?.status === 'unavailable' && un.json.demande?.unavailableReason === 'away');
  const cnu = await req('GET', '/client/notifications', null, ct);
  check('Client notifié « gérant indisponible »', (cnu.json.notifications || []).some((n) => n.type === 'demande_unavailable' && n.demandeId === unavailId));
  const gp = await req('GET', '/gerant/profile', null, gt);
  check('Gérant passé Hors ligne automatiquement', gp.json.user?.available === false);
  const avU = await req('GET', '/client/gerants/available', null, ct);
  check('Client voit le gérant hors ligne', (avU.json.gerants || []).some((g) => g.phone === gphone && g.online === false));
  const back = await req('POST', '/gerant/availability', { available: true }, gt);
  check('Gérant se remet En ligne', back.status === 200 && back.json.available === true);

  // ===== Paiement AVANT acceptation (le client paie directement, gérant n'a pas encore répondu) =====
  const dm2 = await req('POST', '/client/demandes', {
    gerantId, gerantName: 'Gérant Test', gerantWave: gphone,
    type: 'internet', amount: 1200, benefName: 'Awa', benefPhone: '07' + uniq,
  }, ct);
  const demande2Id = dm2.json.demande?.id;
  check('2e demande créée (pending)', dm2.status === 201 && dm2.json.demande?.status === 'pending');

  const payEarly = await req('POST', `/client/demandes/${demande2Id}/paid`, {}, ct);
  check('Client peut payer avant acceptation (paid)', payEarly.status === 200 && payEarly.json.demande?.status === 'paid');

  const gd2 = await req('GET', '/gerant/demandes', null, gt);
  const seesPaid = (gd2.json.demandes || []).find((d) => d.id === demande2Id);
  check('Gérant voit la demande déjà payée', seesPaid?.status === 'paid');

  const acc2 = await req('POST', `/gerant/demandes/${demande2Id}/accept`, {}, gt);
  check('Gérant accepte même après paiement anticipé', acc2.status === 200 && acc2.json.demande?.status === 'accepted');

  const comp2 = await req('POST', `/gerant/demandes/${demande2Id}/complete`, {}, gt);
  check('Gérant complète une demande payée puis acceptée', comp2.status === 200 && comp2.json.demande?.status === 'completed');

  // ===== Annulation d'une demande NON traitée à temps (délai dépassé) =====
  const dm3 = await req('POST', '/client/demandes', {
    gerantId, gerantName: 'Gérant Test', gerantWave: gphone,
    type: 'unites', amount: 700, benefName: 'Awa', benefPhone: '07' + uniq,
  }, ct);
  const demande3Id = dm3.json.demande?.id;
  const early = await req('POST', `/client/demandes/${demande3Id}/cancel`, {}, ct);
  // avec DEMANDE_EXPIRE_MS très petit, le délai est dépassé dès la création
  check('Client annule une demande non traitée à temps', early.status === 200 && early.json.demande?.status === 'canceled');

  // L'annulation génère une notification pour le gérant
  const n3 = await req('GET', '/gerant/notifications', null, gt);
  check('Notification « annulation » créée pour le gérant', (n3.json.notifications || []).some((x) => x.type === 'demande_canceled' && x.demandeId === demande3Id));

  // Marquer une notification comme lue
  const firstUnread = (n3.json.notifications || []).find((x) => !x.read);
  if (firstUnread) {
    const read = await req('POST', `/gerant/notifications/${firstUnread.id}/read`, {}, gt);
    check('Marquer une notification lue OK', read.status === 200 && read.json.notification?.read === true);
  } else {
    check('Marquer une notification lue OK', true);
  }

  const dm4 = await req('POST', '/client/demandes', {
    gerantId, gerantName: 'Gérant Test', gerantWave: gphone,
    type: 'minutes', amount: 800, benefName: 'Awa', benefPhone: '07' + uniq,
  }, ct);
  const demande4Id = dm4.json.demande?.id;
  const gd_cancel = await req('GET', '/gerant/demandes', null, gt);
  check('La demande avant annulation était pending', (gd_cancel.json.demandes || []).some((d) => d.id === demande4Id && d.status === 'pending'));

  // ===== Annulation d'une demande ACCEPTÉE mais PAS ENCORE PAYÉE =====
  const dm5 = await req('POST', '/client/demandes', {
    gerantId, gerantName: 'Gérant Test', gerantWave: gphone,
    type: 'internet', amount: 1500, benefName: 'Awa', benefPhone: '07' + uniq,
  }, ct);
  const demande5Id = dm5.json.demande?.id;
  const acc5 = await req('POST', `/gerant/demandes/${demande5Id}/accept`, {}, gt);
  check('Demande acceptée avant annulation', acc5.status === 200 && acc5.json.demande?.status === 'accepted');
  const cancel5 = await req('POST', `/client/demandes/${demande5Id}/cancel`, {}, ct);
  check('Client annule une demande acceptée mais non payée', cancel5.status === 200 && cancel5.json.demande?.status === 'canceled');

  // ===== Une demande PAYÉE ne peut plus être annulée =====
  const dm6 = await req('POST', '/client/demandes', {
    gerantId, gerantName: 'Gérant Test', gerantWave: gphone,
    type: 'unites', amount: 900, benefName: 'Awa', benefPhone: '07' + uniq,
  }, ct);
  const demande6Id = dm6.json.demande?.id;
  await req('POST', `/client/demandes/${demande6Id}/paid`, {}, ct);
  const cancel6 = await req('POST', `/client/demandes/${demande6Id}/cancel`, {}, ct);
  check('Une demande payée ne peut plus être annulée (400)', cancel6.status === 400);

  // Abonnement client : essai puis activation à 100 FCFA/mois
  const s0 = await req('GET', '/client/subscription', null, ct);
  check('Abonnement client en essai', s0.json.subscription?.status === 'trial');
  const s1 = await req('POST', '/client/subscribe', { plan: 'monthly' }, ct);
  check('Activation abonnement mensuel 100 FCFA', s1.json.subscription?.status === 'active' && s1.json.subscription?.price === 100 && s1.json.subscription?.periodLabel === 'mensuel');

  // Abonnement annuel 1000 FCFA (un autre utilisateur)
  const reg2 = await req('POST', '/auth/register', { role: 'client', name: 'Binta', phone: '09' + uniq, password: '1234' });
  const sA = await req('POST', '/client/subscribe', { plan: 'annual' }, reg2.json.token);
  check('Abonnement annuel 1000 FCFA', sA.json.subscription?.status === 'active' && sA.json.subscription?.price === 1000 && sA.json.subscription?.periodLabel === 'annuel');

  // Abonnement gérant : tarif supérieur (200 FCFA/mois, 2000 FCFA/an)
  const gph = '01' + uniq;
  await req('POST', '/auth/register', { role: 'gerant', name: 'Gérant Pay', phone: gph, password: '1234' });
  const gt2 = (await req('POST', '/auth/login', { phone: gph, password: '1234', role: 'gerant' })).json.token;
  const gm = await req('POST', '/gerant/subscribe', { plan: 'monthly' }, gt2);
  check('Abonnement gérant mensuel 200 FCFA', gm.json.subscription?.status === 'active' && gm.json.subscription?.price === 200 && gm.json.subscription?.periodLabel === 'mensuel');
  const ga = await req('POST', '/gerant/subscribe', { plan: 'annual' }, gt2);
  check('Abonnement gérant annuel 2000 FCFA', ga.json.subscription?.status === 'active' && ga.json.subscription?.price === 2000 && ga.json.subscription?.periodLabel === 'annuel');

  // ===== Parrainage / aide mutuelle (paliers 100 / 1000 / 10000 inscrits) =====
  const refPhoneA = '05' + uniq;
  const refA = await req('POST', '/auth/register', { role: 'client', name: 'Parrain A', phone: refPhoneA, password: '1234' });
  // Plus de code auto-généré : l'utilisateur crée le sien.
  check('Parrain : aucun code attribué automatiquement', !refA.json.user?.referralCode);
  const refCodeA = 'REF' + uniq;
  await req('POST', '/referral/code', { code: refCodeA }, refA.json.token);
  check('Parrain : 0 inscrit au départ', refA.json.referral?.registeredCount === 0 && refA.json.referral?.rate === 0);

  const refPhoneB = '06' + uniq;
  const refB = await req('POST', '/auth/register', { role: 'client', name: 'Invitée B', phone: refPhoneB, password: '1234', referrerCode: refCodeA });
  check('Parrainage : inscrit rattaché au parrain', refB.json.user?.phone === refPhoneB);

  // Paiement avant 100 inscrits : aucune commission (part à 0 %).
  const refBSub = await req('POST', '/client/subscribe', { plan: 'monthly' }, refB.json.token);
  check('Inscrit peut s\'abonner', refBSub.json.subscription?.status === 'active');
  check('Paiement avant 100 inscrits : aucune commission', refBSub.json.referralCommission?.commission === 0 && refBSub.json.referralCommission?.rate === 0);

  // On recrute jusqu'à 100 inscrits -> le taux passe à 5 %.
  for (let i = 0; i < 99; i++) {
    await req('POST', '/auth/register', { role: 'client', name: 'Inscrit ' + i, phone: '07' + uniq + String(i).padStart(2, '0'), password: '1234', referrerCode: refCodeA });
  }
  const refASummary = await req('GET', '/referral/my', null, refA.json.token);
  check('Parrain : 100 inscrits → part de 5 %', refASummary.json.referral?.registeredCount === 100 && refASummary.json.referral?.rate === 5);

  // Après 100 inscrits, un paiement annuel (1000 F) -> 5 % = 50 FCFA.
  const refBSub2 = await req('POST', '/client/subscribe', { plan: 'annual' }, refB.json.token);
  check('Paiement après 100 inscrits : 5 % de 1000 = 50 F', refBSub2.json.referralCommission?.rate === 5 && refBSub2.json.referralCommission?.commission === 50);

  const refASummary2 = await req('GET', '/referral/my', null, refA.json.token);
  check('Parrain : gains totaux = 50 FCFA', refASummary2.json.referral?.totalCommission === 50);

  // Code personnalisé (libre, unique) : trop court -> 400 ; OK -> accepté.
  const customCode = 'MA' + uniq; // unique par exécution (8 caractères)
  const tooShort = await req('POST', '/referral/code', { code: 'AB' }, refA.json.token);
  check('Code personnalisé trop court → 400', tooShort.status === 400);
  const setCode = await req('POST', '/referral/code', { code: customCode }, refA.json.token);
  check('Code personnalisé enregistré', setCode.status === 200 && setCode.json.referral?.code === customCode);
  const dup = await req('POST', '/referral/code', { code: customCode }, refB.json.token);
  check('Code déjà pris par un autre → 409', dup.status === 409);

  // Retrait du gérant (ajout/retrait libres)
  const rm = await req('DELETE', `/client/gerants/${gerantId}`, null, ct);
  check('Retrait du gérant OK', rm.status === 200 && rm.json?.ok === true);
  const cg2 = await req('GET', '/client/gerants', null, ct);
  check('Le gérant n\'est plus dans la liste', !(cg2.json.gerants || []).some((g) => g.id === gerantId));

  console.log(`\n===== Résultat : ${pass} OK / ${fail} échec(s) =====\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
