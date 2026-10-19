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
  const uniq = Date.now().toString().slice(-8); // 2 + 8 = 10 chiffres
  const reg = await req('POST', '/auth/register', {
    role: 'client', name: 'Awa Cissé', phone: '07' + uniq, password: '123456',
  });
  check('Inscription client 201', reg.status === 201);
  check('Inscription : essai gratuit (status trial)', reg.json.subscription?.status === 'trial');
  check('Inscription : 30 jours d\'essai', reg.json.subscription?.daysLeft === 30 || reg.json.subscription?.daysLeft === 29);
  let ct = reg.json.token;

  // Inscription d'un vrai gérant (les comptes de démo ont été retirés)
  const phTooLong = await req('POST', '/auth/register', { role: 'client', name: 'Trop long', phone: '07' + uniq + '1', password: '123456' });
  check('Inscription refusée si numéro > 10 chiffres', phTooLong.status === 400);
  const phTooShort = await req('POST', '/auth/register', { role: 'client', name: 'Trop court', phone: '7' + uniq, password: '123456' });
  check('Inscription refusée si numéro < 10 chiffres', phTooShort.status === 400);
  const gphone = '08' + uniq;
  const greg = await req('POST', '/auth/register', { role: 'gerant', name: 'Gérant Test', phone: gphone, password: '123456' });
  check('Inscription gérant 201', greg.status === 201 && greg.json.user?.role === 'gerant');
  const gt = greg.json.token;
  const gid = greg.json.user.id;

  // ===== Séparation stricte des rôles à la connexion =====
  const clientAsGerant = await req('POST', '/auth/login', { phone: '07' + uniq, password: '123456', role: 'gerant' });
  check('Un compte client ne peut PAS se connecter en gérant (403)', clientAsGerant.status === 403);
  const gerantAsClient = await req('POST', '/auth/login', { phone: gphone, password: '123456', role: 'client' });
  check('Un compte gérant ne peut PAS se connecter en client (403)', gerantAsClient.status === 403);
  const clientOk = await req('POST', '/auth/login', { phone: '07' + uniq, password: '123456', role: 'client' });
  check('Le client se connecte bien en client (200)', clientOk.status === 200 && clientOk.json.user?.role === 'client');
  const gerantOk = await req('POST', '/auth/login', { phone: gphone, password: '123456', role: 'gerant' });
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
    const txA = await req('GET', '/admin/demandes', null, null, H);
    check('Admin : liste des transactions + activité', txA.status === 200 && Array.isArray(txA.json.demandes) && txA.json.demandes.length > 0 && Array.isArray(txA.json.activity) && txA.json.activity[0].total > 0);
    check('Admin : transaction avec client, gérant, montant et horodatage', txA.json.demandes.every((d) => d.clientPhone && d.gerantName && d.amount > 0 && d.createdAt > 0));
    const txNo = await req('GET', '/admin/demandes', null, null, {});
    check('Admin : transactions protégées (403)', txNo.status === 403);
    // Cadeau groupé : client + gérant + numéro inconnu.
    const b0 = (await req('GET', '/client/subscription', null, ct)).json.subscription;
    const bulk = await req('POST', '/admin/grant-free-time-bulk', { phones: [cphone, gphone, '0100000000'], days: 7, note: 'Bonus' }, null, H);
    check('Cadeau groupé : 2 comptes servis, 1 ignoré', bulk.status === 200 && bulk.json.count === 2 && bulk.json.skipped === 1);
    const b1 = (await req('GET', '/client/subscription', null, ct)).json.subscription;
    check('Cadeau groupé : essai du client prolongé de 7 jours', b1.trialEndsAt - b0.trialEndsAt >= 7 * 86400000 - 5000);
    const bulkEmpty = await req('POST', '/admin/grant-free-time-bulk', { phones: [], days: 7 }, null, H);
    check('Cadeau groupé sans destinataire refusé (400)', bulkEmpty.status === 400);
    const gifts = await req('GET', '/admin/gifts', null, null, H);
    check('Historique des cadeaux contient le lot', (gifts.json.gifts || []).filter((g) => g.batchId === bulk.json.batchId).length === 2);
  } else {
    console.log('  (tests admin ignorés : ADMIN_KEY non défini)');
  }

  // ===== Relance « J'attends toujours » (NUDGE_SLOTS_MS=1000,2000,3000 en test) =====
  const dmN = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'internet', amount: 300, benefName: 'Awa', benefPhone: '07' + uniq }, ct);
  const nId = dmN.json.demande?.id;
  const rl0 = await req('POST', `/client/demandes/${nId}/nudge`, {}, ct);
  check('Relance trop tôt refusée (429)', rl0.status === 429);
  await new Promise((r) => setTimeout(r, 1100));
  const rl1 = await req('POST', `/client/demandes/${nId}/nudge`, {}, ct);
  check('Relance 1 acceptée après le 1er créneau', rl1.status === 200 && rl1.json.demande?.nudgeCount === 1);
  const gnN = await req('GET', '/gerant/notifications', null, gt);
  check('Gérant notifié « attend toujours »', (gnN.json.notifications || []).some((n) => n.type === 'client_waiting' && n.demandeId === nId));
  await new Promise((r) => setTimeout(r, 2100));
  const rl2 = await req('POST', `/client/demandes/${nId}/nudge`, {}, ct);
  const rl3 = await req('POST', `/client/demandes/${nId}/nudge`, {}, ct);
  check('Relances 2 et 3 acceptées (3 max)', rl2.status === 200 && rl3.status === 200 && rl3.json.demande?.nudgeCount === 3);
  const rl4 = await req('POST', `/client/demandes/${nId}/nudge`, {}, ct);
  check('4e relance refusée (400)', rl4.status === 400);
  await req('POST', `/gerant/demandes/${nId}/accept`, {}, gt);
  const rl5 = await req('POST', `/client/demandes/${nId}/nudge`, {}, ct);
  check('Plus de relance une fois le gérant a répondu (400)', rl5.status === 400);
  const gdN = await req('GET', '/gerant/demandes', null, gt);
  check('Le gérant voit le compteur de relances', (gdN.json.demandes || []).find((d) => d.id === nId)?.nudgeCount === 3);

  // ===== « Payer d'abord » : le gérant demande le paiement avant traitement =====
  const dmRP = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'internet', amount: 700, benefName: 'Awa', benefPhone: '07' + uniq }, ct);
  const rpId = dmRP.json.demande?.id;
  const rp = await req('POST', `/gerant/demandes/${rpId}/request-payment`, {}, gt);
  check('Gérant demande le paiement → demande acceptée + paiement demandé', rp.status === 200 && rp.json.demande?.status === 'accepted' && !!rp.json.demande?.paymentRequestedAt);
  const cnrp = await req('GET', '/client/notifications', null, ct);
  check('Client notifié « payez d\'abord »', (cnrp.json.notifications || []).some((n) => n.type === 'payment_requested' && n.demandeId === rpId));
  const payRP = await req('POST', `/client/demandes/${rpId}/paid`, {}, ct);
  check('Client paie ensuite (paid)', payRP.status === 200 && payRP.json.demande?.status === 'paid');
  const rpBad = await req('POST', `/gerant/demandes/${rpId}/request-payment`, {}, gt);
  check('Demande de paiement refusée si déjà payée (400)', rpBad.status === 400);

  // ===== Sécurité : limitation des tentatives de connexion =====
  {
    const victim = '05' + uniq;
    let last = null;
    for (let i = 0; i < 11; i++) last = await req('POST', '/auth/login', { phone: victim, password: 'mauvais' + i, role: 'client' });
    check('Connexion bloquée (429) après 10 tentatives ratées sur un même numéro', last.status === 429);
    const other = await req('POST', '/auth/login', { phone: '07' + uniq, password: '123456', role: 'client' });
    check('Un autre numéro peut toujours se connecter', other.status === 200);
  }
  const weakPwd = await req('POST', '/auth/register', { role: 'client', name: 'Faible', phone: '01' + uniq, password: '123' });
  check('Inscription refusée si mot de passe < 4 caractères', weakPwd.status === 400);

  // ===== Admin : réinitialisation de mot de passe =====
  const rst = await req('POST', '/admin/reset-password', { phone: '07' + uniq }, null, { 'x-admin-key': 'testkey' });
  check('Admin réinitialise le mot de passe → code temporaire 6 chiffres', rst.status === 200 && /^\d{6}$/.test(rst.json.tempPassword || ''));
  const oldLogin = await req('POST', '/auth/login', { phone: '07' + uniq, password: '123456', role: 'client' });
  check('Ancien mot de passe refusé', oldLogin.status === 401);
  const newLogin = await req('POST', '/auth/login', { phone: '07' + uniq, password: rst.json.tempPassword, role: 'client' });
  check('Connexion avec le mot de passe temporaire', newLogin.status === 200);
  if (newLogin.json?.token) ct = newLogin.json.token;

  // ===== Désaccord de paiement sur une demande déjà servie =====
  {
    const dm = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 300, benefName: 'Moi', benefPhone: '07' + uniq }, ct);
    const id = dm.json.demande?.id;
    await req('POST', `/gerant/demandes/${id}/complete`, {}, gt);              // servi sans paiement
    const nr1 = await req('POST', `/gerant/demandes/${id}/not-received`, {}, gt);
    check('Gérant « Pas reçu » sur demande servie', nr1.status === 200 && nr1.json.demande?.status === 'completed' && nr1.json.demande?.notReceivedAt > 0);
    const say = await req('POST', `/client/demandes/${id}/paid`, {}, ct);
    check('Client « J\'ai bien payé » sur demande servie → reste servie, déclaration tracée', say.status === 200 && say.json.demande?.status === 'completed' && say.json.demande?.clientPaidDeclaredCount === 1 && !say.json.demande?.notReceivedAt);
    const gn = await req('GET', '/gerant/notifications', null, gt);
    check('Gérant notifié « client affirme avoir payé »', (gn.json.notifications || []).some((n) => n.type === 'client_says_paid' && n.demandeId === id));
    const nr2 = await req('POST', `/gerant/demandes/${id}/not-received`, {}, gt);
    const say2 = await req('POST', `/client/demandes/${id}/paid`, {}, ct);
    check('Boucle possible : 2e déclaration comptée', nr2.status === 200 && say2.json.demande?.clientPaidDeclaredCount === 2);
    const rc = await req('POST', `/gerant/demandes/${id}/received`, {}, gt);
    check('Gérant « Argent reçu » → réglée', rc.status === 200 && rc.json.demande?.moneyReceived === true && rc.json.demande?.status === 'completed');
    const say3 = await req('POST', `/client/demandes/${id}/paid`, {}, ct);
    check('Après réception confirmée, plus de déclaration possible (400)', say3.status === 400);
  }

  // ===== Relance « J'ai payé, j'attends toujours » (phase 2) =====
  {
    const dm = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 800, benefName: 'Moi', benefPhone: '07' + uniq }, ct);
    const id = dm.json.demande?.id;
    await req('POST', `/gerant/demandes/${id}/accept`, {}, gt);
    await req('POST', `/client/demandes/${id}/paid`, {}, ct);
    const tooEarly = await req('POST', `/client/demandes/${id}/nudge`, {}, ct);
    check('Payée : relance trop tôt → 429', tooEarly.status === 429);
    await new Promise((r) => setTimeout(r, 1100));
    const n1 = await req('POST', `/client/demandes/${id}/nudge`, {}, ct);
    check('Payée : relance « j\'ai payé, j\'attends toujours » acceptée (paidNudgeCount=1)', n1.status === 200 && n1.json.demande?.paidNudgeCount === 1 && !n1.json.demande?.nudgeCount);
    const gn1 = await req('GET', '/gerant/notifications', null, gt);
    check('Gérant notifié : « a payé … attend toujours »', (gn1.json.notifications || []).some((n) => n.type === 'client_waiting' && n.demandeId === id && /a payé/.test(n.text)));
    await req('POST', `/gerant/demandes/${id}/received`, {}, gt);
    await new Promise((r) => setTimeout(r, 1000));
    const n2 = await req('POST', `/client/demandes/${id}/nudge`, {}, ct);
    const gn2 = await req('GET', '/gerant/notifications', null, gt);
    check('Argent reçu mais pas servi : relance 2 → « attend toujours sa recharge »', n2.status === 200 && n2.json.demande?.paidNudgeCount === 2 && (gn2.json.notifications || []).some((n) => n.demandeId === id && /attend toujours sa recharge/.test(n.text)));
    await req('POST', `/gerant/demandes/${id}/complete`, {}, gt);
    const after = await req('POST', `/client/demandes/${id}/nudge`, {}, ct);
    check('Servie : plus de relance possible → 400', after.status === 400);
  }

  // ===== Clôture par le client : « Terminer — tout est réglé » =====
  {
    const dm = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'minutes', amount: 250, benefName: 'Moi', benefPhone: '07' + uniq }, ct);
    const id = dm.json.demande?.id;
    const cl = await req('POST', `/client/demandes/${id}/close`, {}, ct);
    check('Client clôture une demande en attente → Terminée, payée, confirmée', cl.status === 200 && cl.json.demande?.status === 'completed' && cl.json.demande?.moneyReceived === true && cl.json.demande?.clientConfirmedAt > 0 && cl.json.demande?.clientClosedAt > 0);
    const gn = await req('GET', '/gerant/notifications', null, gt);
    check('Gérant prévenu de la clôture', (gn.json.notifications || []).some((n) => n.type === 'client_closed' && n.demandeId === id));
    const again = await req('POST', `/client/demandes/${id}/close`, {}, ct);
    check('Clôture idempotente', again.status === 200 && again.json.demande?.status === 'completed');
    const gh = await req('GET', '/gerant/history', null, gt);
    check('Historique gérant : demande terminée (plus « à encaisser »)', (gh.json.demandes || []).some((d) => d.id === id && d.status === 'completed' && d.moneyReceived));
    const dmC = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 100, benefName: 'Moi', benefPhone: '07' + uniq }, ct);
    await req('POST', `/client/demandes/${dmC.json.demande?.id}/cancel`, {}, ct);
    const clC = await req('POST', `/client/demandes/${dmC.json.demande?.id}/close`, {}, ct);
    check('Clôture impossible sur une demande annulée → 400', clC.status === 400);
    // Signalement libre côté client, demande déjà terminée
    const repFree = await req('POST', '/client/reports', { demandeId: id, reason: 'gerant_overcharge', message: 'Il a demandé 300 au lieu de 250' }, ct);
    check('Client signale un gérant avec un motif libre sur une demande terminée → 201', repFree.status === 201 && repFree.json.report?.targetRole === 'gerant');
  }

  // ===== Client : « J'ai annulé mon transfert Wave » =====
  {
    const dm = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'internet', amount: 1000, benefName: 'Moi', benefPhone: '07' + uniq }, ct);
    const id = dm.json.demande?.id;
    const early = await req('POST', `/client/demandes/${id}/wave-canceled`, {}, ct);
    check('Annulation Wave refusée tant que le client n\'a pas payé → 400', early.status === 400);
    await req('POST', `/client/demandes/${id}/paid`, {}, ct);
    const wc = await req('POST', `/client/demandes/${id}/wave-canceled`, {}, ct);
    check('Payée non servie + Wave annulé → demande annulée, argent non reçu', wc.status === 200 && wc.json.demande?.status === 'canceled' && wc.json.demande?.waveCanceledAt > 0 && wc.json.demande?.moneyReceived === false);
    const gn = await req('GET', '/gerant/notifications', null, gt);
    check('Gérant prévenu « NE LE SERVEZ PLUS »', (gn.json.notifications || []).some((n) => n.type === 'client_wave_canceled' && n.demandeId === id && /SERVEZ PLUS/.test(n.text)));
    const srv = await req('POST', `/gerant/demandes/${id}/complete`, {}, gt);
    check('Le gérant ne peut plus servir la demande annulée → 400', srv.status === 400);
  }

  // ===== Espace propriétaire : historique des actions sur les utilisateurs =====
  {
    const uaPhone = '0988' + uniq.slice(2);
    await req('POST', '/auth/register', { role: 'gerant', name: 'Gérant Actions', phone: uaPhone, password: '123456' });
    const gphone = uaPhone; // utilisateur dédié : le reset du mot de passe ne touche pas les autres tests
    await req('POST', '/admin/grant-free-time', { phone: gphone, days: 3, note: 'test' }, null, { 'x-admin-key': 'testkey' });
    await req('POST', '/admin/set-frozen', { phone: gphone, frozen: true, reason: 'other', note: 'x' }, null, { 'x-admin-key': 'testkey' });
    await req('POST', '/admin/set-frozen', { phone: gphone, frozen: false }, null, { 'x-admin-key': 'testkey' });
    await req('POST', '/admin/reset-password', { phone: gphone }, null, { 'x-admin-key': 'testkey' });
    const all = await req('GET', '/admin/user-actions', null, null, { 'x-admin-key': 'testkey' });
    check('Historique des actions : liste + compteurs', all.status === 200 && Array.isArray(all.json.actions) && all.json.counters.user_suspended >= 1 && all.json.counters.password_reset >= 1);
    const one = await req('GET', `/admin/user-actions?phone=${gphone}`, null, null, { 'x-admin-key': 'testkey' });
    const types = (one.json.actions || []).map((a) => a.type);
    check('Historique d\'un utilisateur : cadeau, suspension (avec motif), réactivation, mot de passe', ['free_time_granted', 'user_suspended', 'user_reactivated', 'password_reset'].every((t) => types.includes(t)) && (one.json.actions || []).some((a) => a.type === 'user_suspended' && a.reason === 'other'));
    const onlyGift = await req('GET', `/admin/user-actions?phone=${gphone}&type=free_time_granted`, null, null, { 'x-admin-key': 'testkey' });
    check('Filtre par type', (onlyGift.json.actions || []).length >= 1 && onlyGift.json.actions.every((a) => a.type === 'free_time_granted'));
    check('Résumé par utilisateur', (one.json.users || []).some((u) => u.phone === gphone && u.count >= 4));
    // remettre le mot de passe de test (connexion ultérieure)
  }

  // ===== Mon compte : nom / numéro (1 fois par mois), suppression =====
  {
    const ph = '0511' + uniq.slice(2), ph2 = '0522' + uniq.slice(2);
    const r = await req('POST', '/auth/register', { role: 'gerant', name: 'Avant Nom', phone: ph, password: '123456' });
    const tk = r.json.token;
    const info0 = await req('GET', '/auth/account', null, tk);
    check('Infos compte : changements possibles au départ', info0.status === 200 && info0.json.canChangeName === true && info0.json.canChangePhone === true);
    const n1 = await req('POST', '/auth/change-name', { name: 'Après Nom' }, tk);
    check('Changement de nom OK + nouveau token', n1.status === 200 && n1.json.user?.name === 'Après Nom' && !!n1.json.token && n1.json.canChangeName === false);
    const n2 = await req('POST', '/auth/change-name', { name: 'Encore' }, n1.json.token);
    check('Deuxième changement de nom dans le mois refusé (429)', n2.status === 429 && /Prochain changement/.test(n2.json.error || ''));
    // Le client qui a ce gérant dans ses contacts voit le nouveau nom
    await req('POST', '/client/gerants', { phone: ph, name: 'x' }, ct);
    const gl = await req('GET', '/client/gerants', null, ct);
    check('Contact du client mis à jour avec le nouveau nom', (gl.json.gerants || []).some((g) => g.phone === ph && g.name === 'Après Nom'));
    const pBad = await req('POST', '/auth/change-phone', { phone: ph2, password: 'mauvais' }, tk);
    check('Changement de numéro : mot de passe exigé (401)', pBad.status === 401);
    const pDup = await req('POST', '/auth/change-phone', { phone: gphone, password: '123456' }, tk);
    check('Changement de numéro : numéro déjà pris refusé (409)', pDup.status === 409);
    const p1 = await req('POST', '/auth/change-phone', { phone: ph2, password: '123456' }, tk);
    check('Changement de numéro OK (Wave suit)', p1.status === 200 && p1.json.user?.phone === ph2 && p1.json.user?.waveNumber === ph2 && p1.json.canChangePhone === false);
    const login = await req('POST', '/auth/login', { phone: ph2, password: '123456', role: 'gerant' });
    check('Connexion avec le nouveau numéro', login.status === 200);
    const oldLogin = await req('POST', '/auth/login', { phone: ph, password: '123456', role: 'gerant' });
    check('Ancien numéro ne permet plus de se connecter', oldLogin.status !== 200);
    const gl2 = await req('GET', '/client/gerants', null, ct);
    check('Contact du client : numéro + Wave à jour', (gl2.json.gerants || []).some((g) => g.phone === ph2 && g.waveNumber === ph2));
    const p2 = await req('POST', '/auth/change-phone', { phone: '0533' + uniq.slice(2), password: '123456' }, tk);
    check('Deuxième changement de numéro dans le mois refusé (429)', p2.status === 429);
    const ua = await req('GET', `/admin/user-actions?phone=${ph2}`, null, null, { 'x-admin-key': 'testkey' });
    const types = (ua.json.actions || []).map((a) => a.type);
    check('Espace propriétaire : nom modifié + numéro changé journalisés (ancien → nouveau)', types.includes('user_name_changed') && types.includes('user_phone_changed') && (ua.json.actions || []).some((a) => a.type === 'user_phone_changed' && a.reason === `${ph} → ${ph2}`));
    const dBad = await req('POST', '/auth/delete-account', { password: 'nope' }, tk);
    check('Suppression : mot de passe exigé (401)', dBad.status === 401);
    const del = await req('POST', '/auth/delete-account', { password: '123456' }, tk);
    check('Suppression du compte par l\'utilisateur', del.status === 200 && del.json.removed === true);
    const me = await req('GET', '/auth/me', null, tk);
    check('Token invalide après suppression', me.status === 401 || me.status === 404);
    const ua2 = await req('GET', '/admin/user-actions?type=user_self_deleted', null, null, { 'x-admin-key': 'testkey' });
    check('Journal : « compte supprimé par l\'utilisateur »', (ua2.json.actions || []).some((a) => a.phone === ph2));
    const re = await req('POST', '/auth/register', { role: 'gerant', name: 'Re', phone: ph2, password: '123456' });
    check('Le numéro est libre pour un nouveau compte', re.status === 201);
  }

  // ===== Badge « Cabine officielle » (cumulable avec « Certifié ») =====
  {
    const o1 = await req('POST', '/admin/set-official', { phone: gphone, official: true }, null, { 'x-admin-key': 'testkey' });
    check('Propriétaire : cabine officielle', o1.status === 200 && o1.json.official === true);
    await req('POST', '/admin/set-certified', { phone: gphone, certified: true }, null, { 'x-admin-key': 'testkey' });
    const gl = await req('GET', '/client/gerants', null, ct);
    check('Client voit les DEUX badges sur le gérant', (gl.json.gerants || []).some((g) => g.phone === gphone && g.certified === true && g.official === true));
    const me = await req('GET', '/auth/me', null, gt);
    check('Gérant voit ses badges sur son profil', me.json.user?.certified === true && me.json.user?.official === true);
    const gn = await req('GET', '/gerant/notifications', null, gt);
    check('Gérant notifié « Cabine officielle »', (gn.json.notifications || []).some((n) => n.type === 'official'));
    const bad = await req('POST', '/admin/set-official', { phone: cphone, official: true }, null, { 'x-admin-key': 'testkey' });
    check('Un client ne peut pas être « officiel » (400)', bad.status === 400);
    const ua = await req('GET', '/admin/user-actions?type=gerant_official', null, null, { 'x-admin-key': 'testkey' });
    check('Journal : cabine officielle', (ua.json.actions || []).some((a) => a.phone === gphone));
    const o0 = await req('POST', '/admin/set-official', { phone: gphone, official: false }, null, { 'x-admin-key': 'testkey' });
    check('Retrait du badge', o0.status === 200 && o0.json.official === false);
  }

  // ===== Étoiles Cabine En Ligne (0-5) =====
  {
    const H = { 'x-admin-key': AK };
    const st = await req('POST', '/admin/set-stars', { phone: gphone, stars: 4 }, null, H);
    check('Admin attribue 4 étoiles au gérant', st.status === 200 && st.json.stars === 4);
    const st9 = await req('POST', '/admin/set-stars', { phone: gphone, stars: 9 }, null, H);
    check('Étoiles bornées à 5', st9.status === 200 && st9.json.stars === 5);
    const av2 = await req('GET', '/client/gerants/available', null, ct);
    const l2 = av2.json.gerants || av2.json.available || [];
    check('Étoiles visibles dans la liste client', l2.some((g) => g.phone === gphone && g.stars === 5));
    const me = await req('GET', '/auth/me', null, gt);
    check('Étoiles visibles sur /me du gérant', me.json.user && me.json.user.stars === 5);
    const stc = await req('POST', '/admin/set-stars', { phone: cphone, stars: 3 }, null, H);
    check('Admin attribue des étoiles à un client', stc.status === 200 && stc.json.stars === 3);
    const ua = await req('GET', '/admin/user-actions?type=user_stars', null, null, H);
    check('Étoiles dans l\'historique des actions', ua.status === 200 && (ua.json.actions || []).some((a) => a.type === 'user_stars' && a.phone === gphone));
    const st0 = await req('POST', '/admin/set-stars', { phone: gphone, stars: 0 }, null, H);
    check('Retrait des étoiles', st0.status === 200 && st0.json.stars === 0);
  }

  // ===== Relance du gérant par le propriétaire =====
  {
    const H = { 'x-admin-key': AK };
    const gl = await req('GET', '/client/gerants', null, ct);
    const gid = (gl.json.gerants || []).find((g) => g.phone === gphone)?.id;
    const nd = await req('POST', '/client/demandes', { gerantId: gid, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 300, benefName: 'Moi', benefPhone: cphone }, ct);
    const did = nd.json.demande?.id || nd.json.id;
    check('Demande ouverte créée pour la relance', nd.status === 201 || nd.status === 200);
    const n1 = await req('POST', `/admin/demandes/${did}/nudge`, { note: 'Merci de traiter vite' }, null, H);
    check('Propriétaire relance une demande en attente', n1.status === 200 && n1.json.count === 1);
    const n2 = await req('POST', `/admin/demandes/${did}/nudge`, {}, null, H);
    check('Deuxième relance immédiate refusée (5 min)', n2.status === 429);
    const gn = await req('GET', '/gerant/notifications', null, gt);
    const gnote = (gn.json.notifications || []).find((n) => n.type === 'admin_nudge' && n.demandeId === did);
    check('Gérant notifié (admin_nudge) avec le message du propriétaire', !!gnote && /En attente/.test(gnote.text) && /Merci de traiter vite/.test(gnote.text));
    const cn = await req('GET', '/client/notifications', null, ct);
    check('Client informé de la relance', (cn.json.notifications || []).some((n) => n.type === 'admin_nudge_client' && n.demandeId === did));
    const ad = await req('GET', '/admin/demandes', null, null, H);
    check('Compteur de relance visible dans Transactions', (ad.json.demandes || []).some((d) => d.id === did && d.adminNudgeCount === 1 && d.lastAdminNudgeAt > 0));
    const ua = await req('GET', '/admin/user-actions?type=demande_admin_nudged', null, null, H);
    check('Relance tracée dans l\'historique des actions', (ua.json.actions || []).some((a) => a.type === 'demande_admin_nudged' && a.phone === gphone));
    await req('POST', `/gerant/demandes/${did}/decline`, {}, gt);
    const n3 = await req('POST', `/admin/demandes/${did}/nudge`, {}, null, H);
    check('Relance refusée sur une demande close', n3.status === 400);
  }

  // ===== Lien Wave Business du gérant =====
  {
    const bad = await req('POST', '/gerant/profile', { payLink: 'https://exemple.com/m/abc' }, gt);
    check('Lien non Wave refusé', bad.status === 400);
    const good = await req('POST', '/gerant/profile', { payLink: 'https://pay.wave.com/m/M_ci_TEST123/c/ci/?x=1' }, gt);
    check('Lien Wave Business accepté (nettoyé)', good.status === 200 && good.json.user.payLink === 'https://pay.wave.com/m/M_ci_TEST123/c/ci/');
    const gl = await req('GET', '/client/gerants', null, ct);
    check('Lien visible dans les contacts du client', (gl.json.gerants || []).some((g) => g.phone === gphone && g.payLink === 'https://pay.wave.com/m/M_ci_TEST123/c/ci/'));
    const gid = (gl.json.gerants || []).find((g) => g.phone === gphone)?.id;
    const nd = await req('POST', '/client/demandes', { gerantId: gid, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 250, benefName: 'Moi', benefPhone: cphone }, ct);
    check('Nouvelle demande porte le lien du gérant', nd.json.demande?.gerantPayLink === 'https://pay.wave.com/m/M_ci_TEST123/c/ci/');
    await req('POST', `/gerant/demandes/${nd.json.demande?.id}/decline`, {}, gt);
    const off = await req('POST', '/gerant/profile', { payLinkOff: true }, gt);
    check('Désactivation du lien (quota atteint) : lien conservé, désactivé', off.status === 200 && off.json.user.payLinkOff === true && off.json.user.payLink !== '');
    const gl2 = await req('GET', '/client/gerants', null, ct);
    check('Lien désactivé invisible pour le client', (gl2.json.gerants || []).some((g) => g.phone === gphone && !g.payLink));
    const nd2 = await req('POST', '/client/demandes', { gerantId: gid, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 250, benefName: 'Moi', benefPhone: cphone }, ct);
    check('Nouvelle demande sans lien quand désactivé', nd2.json.demande && !nd2.json.demande.gerantPayLink);
    await req('POST', `/gerant/demandes/${nd2.json.demande?.id}/decline`, {}, gt);
    const on = await req('POST', '/gerant/profile', { payLinkOff: false }, gt);
    const gl3 = await req('GET', '/client/gerants', null, ct);
    check('Réactivation : lien à nouveau visible', on.status === 200 && (gl3.json.gerants || []).some((g) => g.phone === gphone && g.payLink));
    const clr = await req('POST', '/gerant/profile', { payLink: '' }, gt);
    check('Retrait du lien', clr.status === 200 && clr.json.user.payLink === '');
  }

  // ===== Indisponible : motifs liés à la demande (reste En ligne) =====
  {
    const gl = await req('GET', '/client/gerants', null, ct);
    const gid = (gl.json.gerants || []).find((g) => g.phone === gphone)?.id;
    await req('POST', '/gerant/availability', { available: true }, gt);
    const nd = await req('POST', '/client/demandes', { gerantId: gid, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 300, benefName: 'Moi', benefPhone: cphone }, ct);
    const un = await req('POST', `/gerant/demandes/${nd.json.demande?.id}/unavailable`, { reason: 'nostock' }, gt);
    check('Indisponible « pas assez d\'unités » accepté', un.status === 200 && un.json.demande?.unavailableReason === 'nostock');
    const me = await req('GET', '/gerant/profile', null, gt);
    check('Le gérant reste En ligne pour ce motif', me.json.user && me.json.user.available === true);
    const cn = await req('GET', '/client/notifications', null, ct);
    check('Client prévenu avec le motif', (cn.json.notifications || []).some((n) => n.demandeId === nd.json.demande?.id && /pas assez d'unités/.test(n.text)));
    const nd2 = await req('POST', '/client/demandes', { gerantId: gid, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 300, benefName: 'Moi', benefPhone: cphone }, ct);
    await req('POST', `/gerant/demandes/${nd2.json.demande?.id}/unavailable`, { reason: 'away' }, gt);
    const me2 = await req('GET', '/gerant/profile', null, gt);
    check('Motif « pas à la cabine » : passe Hors ligne', me2.json.user && me2.json.user.available === false);
    await req('POST', '/gerant/availability', { available: true }, gt);
  }

  // ===== Remboursement : indisponible après paiement =====
  {
    const gl = await req('GET', '/client/gerants', null, ct);
    const gid = (gl.json.gerants || []).find((g) => g.phone === gphone)?.id;
    const nd = await req('POST', '/client/demandes', { gerantId: gid, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 700, benefName: 'Moi', benefPhone: cphone }, ct);
    const did = nd.json.demande?.id;
    await req('POST', `/client/demandes/${did}/paid`, {}, ct);
    const un = await req('POST', `/gerant/demandes/${did}/unavailable`, { reason: 'nonetwork' }, gt);
    check('Indisponible après paiement → remboursement dû', un.status === 200 && un.json.demande?.refundDue > 0);
    let gn = await req('GET', '/gerant/notifications', null, gt);
    check('Gérant notifié « À rembourser »', (gn.json.notifications || []).some((n) => n.demandeId === did && /À rembourser/.test(n.text)));
    const rq = await req('POST', `/client/demandes/${did}/refund`, { kind: 'request' }, ct);
    check('Client demande le remboursement', rq.status === 200 && rq.json.demande?.refundRequestedAt > 0);
    const rq2 = await req('POST', `/client/demandes/${did}/refund`, { kind: 'request' }, ct);
    check('Relance < 1 min refusée (429)', rq2.status === 429);
    const nr = await req('POST', `/client/demandes/${did}/refund`, { kind: 'not_received' }, ct);
    check('« Pas reçu » impossible avant « J\'ai remboursé »', nr.status === 400);
    const ny = await req('POST', `/gerant/demandes/${did}/refund`, { kind: 'not_yet' }, gt);
    check('Gérant : pas encore pu', ny.status === 200 && ny.json.demande?.refundNotYetAt > 0);
    const rf = await req('POST', `/gerant/demandes/${did}/refund`, { kind: 'refunded' }, gt);
    check('Gérant : j\'ai remboursé', rf.status === 200 && rf.json.demande?.refundedAt > 0 && !rf.json.demande?.refundNotYetAt);
    let cn = await req('GET', '/client/notifications', null, ct);
    check('Client notifié du remboursement', (cn.json.notifications || []).some((n) => n.demandeId === did && /remboursé 700 F/.test(n.text)));
    const nr2 = await req('POST', `/client/demandes/${did}/refund`, { kind: 'not_received' }, ct);
    check('Client : pas reçu → gérant alerté', nr2.status === 200 && nr2.json.demande?.refundDisputedAt > 0);
    const ok2 = await req('POST', `/client/demandes/${did}/refund`, { kind: 'received' }, ct);
    check('Client : remboursement reçu → clos', ok2.status === 200 && ok2.json.demande?.refundConfirmedAt > 0);
    const again = await req('POST', `/gerant/demandes/${did}/refund`, { kind: 'refunded' }, gt);
    check('Après confirmation : plus d\'action possible', again.status === 400);
    const nd2 = await req('POST', '/client/demandes', { gerantId: gid, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 200, benefName: 'Moi', benefPhone: cphone }, ct);
    await req('POST', `/gerant/demandes/${nd2.json.demande?.id}/unavailable`, { reason: 'nostock' }, gt);
    const no = await req('POST', `/client/demandes/${nd2.json.demande?.id}/refund`, { kind: 'request' }, ct);
    check('Pas de remboursement si le client n\'avait pas payé', no.status === 400);
  }

  // ===== Déjà servi (pas de remboursement) + « Argent non reçu » après Terminer du client =====
  {
    const gl = await req('GET', '/client/gerants', null, ct);
    const gid = (gl.json.gerants || []).find((g) => g.phone === gphone)?.id;
    const nd = await req('POST', '/client/demandes', { gerantId: gid, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 400, benefName: 'Moi', benefPhone: cphone }, ct);
    const did = nd.json.demande?.id;
    await req('POST', `/client/demandes/${did}/paid`, {}, ct);
    await req('POST', `/gerant/demandes/${did}/unavailable`, { reason: 'later' }, gt);
    const sv = await req('POST', `/gerant/demandes/${did}/refund`, { kind: 'served' }, gt);
    check('« Déjà servi » : demande servie + payée, plus de remboursement dû', sv.status === 200 && sv.json.demande?.status === 'completed' && sv.json.demande?.moneyReceived === true && !sv.json.demande?.refundDue);
    const cn = await req('GET', '/client/notifications', null, ct);
    check('Client prévenu : pas de remboursement, vérifiez votre solde', (cn.json.notifications || []).some((n) => n.demandeId === did && /pas de remboursement/.test(n.text)));
    const ns = await req('POST', `/client/demandes/${did}/not-served`, {}, ct);
    check('Le client peut encore contester « rien reçu »', ns.status === 200 && ns.json.demande?.notServedAt > 0);
    await req('POST', '/gerant/availability', { available: true }, gt);
    // Terminer côté client puis « Argent non reçu » côté gérant
    const nd2 = await req('POST', '/client/demandes', { gerantId: gid, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 300, benefName: 'Moi', benefPhone: cphone }, ct);
    const d2 = nd2.json.demande?.id;
    await req('POST', `/gerant/demandes/${d2}/accept`, {}, gt);
    const cl = await req('POST', `/client/demandes/${d2}/close`, {}, ct);
    check('Terminer client : servie + payée (par le client)', cl.status === 200 && cl.json.demande?.moneyReceivedByClient === true);
    const gn = await req('GET', '/gerant/notifications', null, gt);
    check('Gérant prévenu de la clôture par le client', (gn.json.notifications || []).some((n) => n.demandeId === d2 && /a terminé sa demande/.test(n.text)));
    const nr = await req('POST', `/gerant/demandes/${d2}/not-received`, {}, gt);
    check('Gérant : « Argent non reçu » possible après Terminer', nr.status === 200 && nr.json.demande?.moneyReceived === false && nr.json.demande?.status === 'completed');
    await req('POST', `/gerant/demandes/${d2}/received`, {}, gt);
    const nr2 = await req('POST', `/gerant/demandes/${d2}/not-received`, {}, gt);
    check('Mais pas après SA PROPRE confirmation « Argent reçu »', nr2.status === 400);
  }

  // ===== Signalements + suspension motivée =====
  {
    const A = { 'x-admin-key': 'testkey' };
    // Gérant signale un client : servi non payé
    const dm = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 150, benefName: 'Moi', benefPhone: '07' + uniq }, ct);
    const id = dm.json.demande?.id;
    const early = await req('POST', '/gerant/reports', { demandeId: id, reason: 'served_not_paid' }, gt);
    check('Signalement refusé si l\'état ne correspond pas (pas encore servi) → 400', early.status === 400);
    // Motif libre : possible quel que soit l'état (ici demande encore en attente)
    const dmF = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 120, benefName: 'Moi', benefPhone: '07' + uniq }, ct);
    const free = await req('POST', '/gerant/reports', { demandeId: dmF.json.demande?.id, reason: 'client_fake_requests', message: 'Annule à chaque fois' }, gt);
    check('Gérant signale un client avec un motif libre, demande en attente → 201', free.status === 201 && free.json.report?.reason === 'client_fake_requests' && free.json.report?.targetRole === 'client');
    const freeC = await req('POST', '/client/reports', { demandeId: dmF.json.demande?.id, reason: 'client_other' }, ct);
    check('Motif libre gérant refusé côté client → 400', freeC.status === 400);
    await req('POST', `/gerant/demandes/${id}/complete`, {}, gt);
    const rep = await req('POST', '/gerant/reports', { demandeId: id, reason: 'served_not_paid', message: 'Servi hier, toujours rien' }, gt);
    check('Gérant signale un client servi non payé', rep.status === 201 && rep.json.report?.status === 'open' && rep.json.report?.targetRole === 'client');
    const rep2 = await req('POST', '/gerant/reports', { demandeId: id, reason: 'served_not_paid' }, gt);
    check('Second signalement identique = doublon', rep2.json.duplicate === true);
    const cnR = await req('GET', '/client/notifications', null, ct);
    check('Client prévenu qu\'il a été signalé', (cnR.json.notifications || []).some((n) => n.type === 'reported' && n.demandeId === id));
    const wrong = await req('POST', '/client/reports', { demandeId: id, reason: 'served_not_paid' }, ct);
    check('Un client ne peut pas utiliser un motif réservé au gérant (400)', wrong.status === 400);
    const sum = await req('GET', '/admin/summary', null, null, A);
    check('Espace propriétaire liste le signalement', (sum.json.reports || []).some((r) => r.id === rep.json.report.id));
    // Client signale un gérant : payé (réception confirmée) mais pas servi
    const dm2 = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'internet', amount: 500, benefName: 'Moi', benefPhone: '07' + uniq }, ct);
    const id2 = dm2.json.demande?.id;
    await req('POST', `/client/demandes/${id2}/paid`, {}, ct);
    await req('POST', `/gerant/demandes/${id2}/received`, {}, gt);
    const repC = await req('POST', '/client/reports', { demandeId: id2, reason: 'paid_not_served' }, ct);
    check('Client signale un gérant payé mais pas servi', repC.status === 201 && repC.json.report?.targetRole === 'gerant');
    const gnR = await req('GET', '/gerant/notifications', null, gt);
    check('Gérant prévenu du signalement', (gnR.json.notifications || []).some((n) => n.type === 'reported' && n.demandeId === id2));
    // Suspension motivée + notification + réactivation
    const susp = await req('POST', '/admin/set-frozen', { phone: '07' + uniq, frozen: true, reason: 'client_unpaid_demandes', note: 'Demande 150 F du 16/09' }, null, A);
    check('Suspension avec motif enregistrée', susp.status === 200 && susp.json.frozenReason === 'client_unpaid_demandes');
    const meS = await req('GET', '/auth/me', null, ct);
    check('Le client voit son statut suspendu + motif', meS.json.user?.frozen === true && /Demandes traitées non payées/.test(meS.json.user?.frozenText || '') && /150 F/.test(meS.json.user?.frozenText || ''));
    const cnS = await req('GET', '/client/notifications', null, ct);
    check('Client notifié de la suspension', (cnS.json.notifications || []).some((n) => n.type === 'account_suspended'));
    const blocked = await req('POST', '/client/demandes', { gerantId, gerantName: 'Gérant Test', gerantWave: gphone, type: 'unites', amount: 100, benefName: 'Moi', benefPhone: '07' + uniq }, ct);
    check('Client suspendu ne peut plus envoyer de demande (403)', blocked.status === 403);
    const res1 = await req('POST', '/admin/resolve-report', { id: rep.json.report.id, decision: 'resolve' }, null, A);
    check('Propriétaire clôture le signalement', res1.status === 200 && res1.json.report?.status === 'resolved');
    const react = await req('POST', '/admin/set-frozen', { phone: '07' + uniq, frozen: false }, null, A);
    const meR = await req('GET', '/auth/me', null, ct);
    check('Réactivation : plus suspendu, notifié', react.status === 200 && meR.json.user?.frozen === false && (await req('GET', '/client/notifications', null, ct)).json.notifications.some((n) => n.type === 'account_reactivated'));
  }

  // ===== Notes ⭐, client fiable, stats, jalons =====
  {
    const A = { 'x-admin-key': 'testkey' };
    const gp = '0944' + uniq.slice(-6), cp = '0933' + uniq.slice(-6);
    const g = await req('POST', '/auth/register', { role: 'gerant', name: 'NoteG', phone: gp, password: '123456' });
    const c = await req('POST', '/auth/register', { role: 'client', name: 'NoteC', phone: cp, password: '123456' });
    const gt = g.json.token, ct = c.json.token;
    await req('POST', '/client/gerants', { phone: gp, name: 'NoteG' }, ct);
    const gid = ((await req('GET', '/client/gerants', null, ct)).json.gerants || [])[0]?.id;
    const cycle = async () => {
      const d = (await req('POST', '/client/demandes', { gerantId: gid, type: 'unites', amount: 100, benefName: 'Moi', benefPhone: cp }, ct)).json.demande;
      await req('POST', `/gerant/demandes/${d.id}/received`, {}, gt);
      await req('POST', `/gerant/demandes/${d.id}/complete`, {}, gt);
      await req('POST', `/client/demandes/${d.id}/confirm-served`, {}, ct);
      return d.id;
    };
    const d1 = await cycle();
    const gn = (await req('GET', '/gerant/notifications', null, gt)).json.notifications || [];
    check('Jalon « première demande servie » reçu une fois', gn.filter((n) => n.type === 'milestone').length === 1);
    const bad = await req('POST', `/client/demandes/${d1}/rate`, { stars: 9 }, ct);
    check('Note hors 1–5 refusée (400)', bad.status === 400);
    const r1 = await req('POST', `/client/demandes/${d1}/rate`, { stars: 5 }, ct);
    check('Note 5 acceptée après « Bien reçu »', r1.status === 200 && r1.json.demande.rating === 5);
    check('Gérant prévenu d\'une bonne note', ((await req('GET', '/gerant/notifications', null, gt)).json.notifications || []).some((n) => n.type === 'rating_received'));
    let list = (await req('GET', '/client/gerants', null, ct)).json.gerants || [];
    check('Moyenne masquée sous 3 avis', list[0].rating && list[0].rating.avg === null && list[0].rating.count === 1);
    const d2 = await cycle(); await req('POST', `/client/demandes/${d2}/rate`, { stars: 4 }, ct);
    const d3 = await cycle(); await req('POST', `/client/demandes/${d3}/rate`, { stars: 5 }, ct);
    list = (await req('GET', '/client/gerants', null, ct)).json.gerants || [];
    check('Moyenne visible à 3 avis (4,7)', list[0].rating.avg === 4.7 && list[0].rating.count === 3);
    const unrated = (await req('POST', '/client/demandes', { gerantId: gid, type: 'unites', amount: 100, benefName: 'Moi', benefPhone: cp }, ct)).json.demande;
    const early = await req('POST', `/client/demandes/${unrated.id}/rate`, { stars: 5 }, ct);
    check('Impossible de noter avant « Bien reçu » (400)', early.status === 400);
    // Client fiable : 5 demandes clôturées sans litige
    await cycle(); await cycle();
    const gd = (await req('GET', '/gerant/demandes', null, gt)).json.demandes || [];
    check('Badge « Client fiable » visible par le gérant après 5 demandes propres', gd.some((d) => d.clientReliable === true));
    const st = (await req('GET', '/gerant/stats', null, gt)).json.stats;
    check('Stats gérant : servies, montant, note', st.week.served === 5 && st.week.amountServed === 500 && st.rating.avg === 4.7 && st.totalServed === 5);
    const sum = await req('GET', '/admin/summary', null, null, A);
    check('Classement des notes dans l\'Espace propriétaire', (sum.json.ratings || []).some((r) => r.phone === gp && r.avg === 4.7));
    const pub = await req('GET', `/public/u/${g.json.user.id}`, null);
    check('Fiche publique : note incluse', pub.status === 200 && JSON.stringify(pub.json).includes('4.7'));
  }

  // ===== Changer mon mot de passe =====
  {
    const ph = '0955' + uniq.slice(-6);
    const r = await req('POST', '/auth/register', { role: 'client', name: 'Mdp', phone: ph, password: 'ancien1' });
    const tk = r.json.token;
    const bad = await req('POST', '/auth/change-password', { currentPassword: 'faux', newPassword: 'nouveau1' }, tk);
    check('Changement refusé si mot de passe actuel faux (401)', bad.status === 401);
    const short = await req('POST', '/auth/change-password', { currentPassword: 'ancien1', newPassword: '123' }, tk);
    check('Nouveau mot de passe trop court refusé (400)', short.status === 400);
    const ok = await req('POST', '/auth/change-password', { currentPassword: 'ancien1', newPassword: 'nouveau1' }, tk);
    check('Changement de mot de passe accepté', ok.status === 200 && ok.json.ok);
    const oldLogin = await req('POST', '/auth/login', { phone: ph, password: 'ancien1', role: 'client' });
    check('Ancien mot de passe ne fonctionne plus', oldLogin.status === 401);
    const newLogin = await req('POST', '/auth/login', { phone: ph, password: 'nouveau1', role: 'client' });
    check('Nouveau mot de passe fonctionne', newLogin.status === 200 && newLogin.json.token);
    const noAuth = await req('POST', '/auth/change-password', { currentPassword: 'x', newPassword: 'yyyyyy' });
    check('Changement sans connexion refusé (401)', noAuth.status === 401);
  }

  // ===== Bienvenue, alertes d'abonnement, messages du propriétaire =====
  {
    const A = { 'x-admin-key': 'testkey' };
    const DAY = 86400000;
    const ph = '0977' + uniq.slice(-6);
    const r = await req('POST', '/auth/register', { role: 'client', name: 'Alerte', phone: ph, password: '123456' });
    const tk = r.json.token;
    const n0 = await req('GET', '/client/notifications', null, tk);
    check('Message de bienvenue à l\'inscription', (n0.json.notifications || []).some((n) => n.type === 'welcome'));
    const notifTypes = async () => ((await req('GET', '/client/notifications', null, tk)).json.notifications || []).map((n) => n.type);
    // Essai se terminant dans 4 jours → J-5 envoyé une fois
    await req('POST', '/admin/debug-set-subscription', { phone: ph, subscription: { status: 'trial', trialEndsAt: Date.now() + 4 * DAY, subscribedUntil: 0 } }, null, A);
    await req('POST', '/admin/run-alerts', {}, null, A);
    await req('POST', '/admin/run-alerts', {}, null, A);
    let types = await notifTypes();
    check('Alerte J-5 envoyée UNE seule fois malgré 2 passages', types.filter((x) => x === 'alert_expiring').length === 1);
    // Puis J-1
    await req('POST', '/admin/debug-set-subscription', { phone: ph, subscription: { trialEndsAt: Date.now() + 0.5 * DAY } }, null, A);
    await req('POST', '/admin/run-alerts', {}, null, A);
    types = await notifTypes();
    check('Alerte J-1 envoyée (2 alertes « expiring » au total)', types.filter((x) => x === 'alert_expiring').length === 2);
    // Expiré depuis 1 h
    await req('POST', '/admin/debug-set-subscription', { phone: ph, subscription: { trialEndsAt: Date.now() - 3600000 } }, null, A);
    await req('POST', '/admin/run-alerts', {}, null, A);
    await req('POST', '/admin/run-alerts', {}, null, A);
    types = await notifTypes();
    check('Alerte « expiré » envoyée une seule fois', types.filter((x) => x === 'alert_expired').length === 1);
    // Non rétroactif : un autre compte expiré depuis 10 jours ne reçoit rien
    const ph2 = '0966' + uniq.slice(-6);
    const r2 = await req('POST', '/auth/register', { role: 'gerant', name: 'Vieux', phone: ph2, password: '123456' });
    await req('POST', '/admin/debug-set-subscription', { phone: ph2, subscription: { status: 'trial', trialEndsAt: Date.now() - 10 * DAY } }, null, A);
    await req('POST', '/admin/run-alerts', {}, null, A);
    const n2 = await req('GET', '/gerant/notifications', null, r2.json.token);
    check('Pas d\'alerte rétroactive pour une expiration ancienne', !(n2.json.notifications || []).some((n) => n.type.startsWith('alert_')));
    // Après confirmation d'un paiement, les drapeaux sont remis à zéro → nouvelle période, nouvelles alertes possibles
    const dcl = await req('POST', '/client/subscribe', { plan: 'monthly' }, tk);
    await req('POST', '/admin/confirm-payment', { id: dcl.json.payment.id }, null, A);
    const subA = (await req('GET', '/client/subscription', null, tk)).json.subscription;
    check('Reconduction : abonnement actif ~30 jours après confirmation', subA.status === 'active' && subA.daysLeft >= 29 && subA.daysLeft <= 31);
    await req('POST', '/admin/debug-set-subscription', { phone: ph, subscription: { subscribedUntil: Date.now() + 4 * DAY } }, null, A);
    await req('POST', '/admin/run-alerts', {}, null, A);
    types = await notifTypes();
    check('Nouvelle période → alerte J-5 à nouveau possible', types.filter((x) => x === 'alert_expiring').length === 3);
    // Reconduction cumulée : payer alors qu'il reste 4 jours → ~34 jours
    const dcl2 = await req('POST', '/client/subscribe', { plan: 'monthly' }, tk);
    await req('POST', '/admin/confirm-payment', { id: dcl2.json.payment.id }, null, A);
    const subB = (await req('GET', '/client/subscription', null, tk)).json.subscription;
    check('Reconduction cumulée : les jours restants ne sont pas perdus (~34 j)', subB.daysLeft >= 33 && subB.daysLeft <= 35);
    // Messages du propriétaire
    const short = await req('POST', '/admin/announce', { kind: 'tip', audience: 'client', text: 'court' }, null, A);
    check('Message trop court refusé (400)', short.status === 400);
    const ann = await req('POST', '/admin/announce', { kind: 'tip', audience: 'client', title: 'Frais Wave', text: 'Ajoutez 1 % au montant pour couvrir les frais Wave.' }, null, A);
    check('Astuce envoyée aux clients', ann.status === 201 && ann.json.announcement?.recipients >= 1);
    types = await notifTypes();
    check('Le client reçoit l\'astuce', types.includes('announce_tip'));
    const ng = await req('GET', '/gerant/notifications', null, r2.json.token);
    check('Un gérant ne reçoit PAS une astuce ciblée « clients »', !(ng.json.notifications || []).some((n) => n.type === 'announce_tip'));
    const one = await req('POST', '/admin/announce', { kind: 'alert', audience: 'user', userId: r2.json.user.id, text: 'Message personnel pour ce gérant uniquement.' }, null, A);
    check('Message à un seul utilisateur : 1 destinataire', one.status === 201 && one.json.announcement?.recipients === 1 && one.json.announcement.userPhone === ph2);
    check('Le destinataire unique reçoit l\'alerte', ((await req('GET', '/gerant/notifications', null, r2.json.token)).json.notifications || []).some((n) => n.type === 'announce_alert'));
    check('L\'autre utilisateur ne reçoit rien', !(await notifTypes()).includes('announce_alert'));
    const noUser = await req('POST', '/admin/announce', { kind: 'info', audience: 'user', text: 'Sans destinataire choisi.' }, null, A);
    check('Cible « un utilisateur » sans userId refusée (400)', noUser.status === 400);
    const sum = await req('GET', '/admin/summary', null, null, A);
    check('Historique des messages dans l\'Espace propriétaire', (sum.json.announcements || []).some((a) => a.id === ann.json.announcement.id));
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
  check('Déclaration de paiement : abonnement PAS encore actif (validation manuelle)', s1.json.pending === true && s1.json.subscription?.status === 'trial' && s1.json.payment?.status === 'pending' && s1.json.subscription?.pendingPayment?.reference === s1.json.payment?.reference);
  const s1b = await req('POST', '/client/subscribe', { plan: 'monthly' }, ct);
  check('Seconde déclaration = pas de doublon', s1b.json.duplicate === true && s1b.json.payment?.id === s1.json.payment?.id);
  const noKey = await req('POST', '/admin/confirm-payment', { id: s1.json.payment.id }, null);
  check('Confirmation impossible sans clé admin (403)', noKey.status === 403);
  const adminSum = await req('GET', '/admin/summary', null, null, { 'x-admin-key': 'testkey' });
  check('Espace propriétaire liste le paiement à vérifier', (adminSum.json.pendingPayments || []).some((p) => p.id === s1.json.payment.id));
  const cfPay = await req('POST', '/admin/confirm-payment', { id: s1.json.payment.id }, null, { 'x-admin-key': 'testkey' });
  check('Propriétaire confirme → abonnement mensuel 100 FCFA actif', cfPay.status === 200 && cfPay.json.subscription?.status === 'active' && cfPay.json.subscription?.price === 100 && cfPay.json.subscription?.periodLabel === 'mensuel');
  const s1c = await req('GET', '/client/subscription', null, ct);
  check('Côté client : actif, plus de paiement en attente', s1c.json.subscription?.status === 'active' && !s1c.json.subscription?.pendingPayment);
  const cnSub = await req('GET', '/client/notifications', null, ct);
  check('Client notifié « paiement reçu, abonnement actif »', (cnSub.json.notifications || []).some((n) => n.type === 'subscription_confirmed'));
  const cf2 = await req('POST', '/admin/confirm-payment', { id: s1.json.payment.id }, null, { 'x-admin-key': 'testkey' });
  check('Double confirmation refusée (400)', cf2.status === 400);

  // Helper : déclare puis fait confirmer par l'admin (retourne la réponse de confirmation).
  const subscribeConfirmed = async (path, plan, token) => {
    const d = await req('POST', path, { plan }, token);
    if (!d.json.payment?.id) return d;
    return req('POST', '/admin/confirm-payment', { id: d.json.payment.id }, null, { 'x-admin-key': 'testkey' });
  };

  // Abonnement annuel 1000 FCFA (un autre utilisateur)
  const reg2 = await req('POST', '/auth/register', { role: 'client', name: 'Binta', phone: '02' + uniq, password: '123456' });
  const sA = await subscribeConfirmed('/client/subscribe', 'annual', reg2.json.token);
  check('Abonnement annuel 1000 FCFA', sA.json.subscription?.status === 'active' && sA.json.subscription?.price === 1000 && sA.json.subscription?.periodLabel === 'annuel');

  // Rejet : le propriétaire n'a rien reçu
  const reg3 = await req('POST', '/auth/register', { role: 'client', name: 'Rejet', phone: '06' + uniq, password: '123456' });
  const dR = await req('POST', '/client/subscribe', { plan: 'monthly' }, reg3.json.token);
  const rj = await req('POST', '/admin/reject-payment', { id: dR.json.payment.id, note: 'Aucun transfert trouvé' }, null, { 'x-admin-key': 'testkey' });
  const s3 = await req('GET', '/client/subscription', null, reg3.json.token);
  check('Rejet : abonnement inchangé (essai), plus rien en attente', rj.status === 200 && s3.json.subscription?.status === 'trial' && !s3.json.subscription?.pendingPayment);
  const cn3 = await req('GET', '/client/notifications', null, reg3.json.token);
  check('Client notifié du rejet', (cn3.json.notifications || []).some((n) => n.type === 'subscription_rejected'));

  // Abonnement gérant : tarif supérieur (200 FCFA/mois, 2000 FCFA/an)
  const gph = '01' + uniq;
  await req('POST', '/auth/register', { role: 'gerant', name: 'Gérant Pay', phone: gph, password: '123456' });
  const gt2 = (await req('POST', '/auth/login', { phone: gph, password: '123456', role: 'gerant' })).json.token;
  const gm = await subscribeConfirmed('/gerant/subscribe', 'monthly', gt2);
  check('Abonnement gérant mensuel 200 FCFA', gm.json.subscription?.status === 'active' && gm.json.subscription?.price === 200 && gm.json.subscription?.periodLabel === 'mensuel');
  const ga = await subscribeConfirmed('/gerant/subscribe', 'annual', gt2);
  check('Abonnement gérant annuel 2000 FCFA', ga.json.subscription?.status === 'active' && ga.json.subscription?.price === 2000 && ga.json.subscription?.periodLabel === 'annuel');

  // ===== Parrainage / aide mutuelle (paliers 100 / 1000 / 10000 inscrits) =====
  const refPhoneA = '05' + uniq;
  const refA = await req('POST', '/auth/register', { role: 'client', name: 'Parrain A', phone: refPhoneA, password: '123456' });
  // Plus de code auto-généré : l'utilisateur crée le sien.
  check('Parrain : aucun code attribué automatiquement', !refA.json.user?.referralCode);
  const refCodeA = 'REF' + uniq;
  await req('POST', '/referral/code', { code: refCodeA }, refA.json.token);
  check('Parrain : 0 inscrit au départ', refA.json.referral?.registeredCount === 0 && refA.json.referral?.rate === 0);

  const refPhoneB = '04' + uniq;
  const refB = await req('POST', '/auth/register', { role: 'client', name: 'Invitée B', phone: refPhoneB, password: '123456', referrerCode: refCodeA });
  check('Parrainage : inscrit rattaché au parrain', refB.json.user?.phone === refPhoneB);

  // Paiement avant 100 inscrits : aucune commission (part à 0 %).
  const refBSub = await subscribeConfirmed('/client/subscribe', 'monthly', refB.json.token);
  check('Inscrit peut s\'abonner', refBSub.json.subscription?.status === 'active');
  check('Paiement avant 100 inscrits : aucune commission', refBSub.json.referralCommission?.commission === 0 && refBSub.json.referralCommission?.rate === 0);

  // On recrute jusqu'à 100 inscrits -> le taux passe à 5 %.
  for (let i = 0; i < 99; i++) {
    await req('POST', '/auth/register', { role: 'client', name: 'Inscrit ' + i, phone: '03' + uniq.slice(0, 6) + String(i).padStart(2, '0'), password: '123456', referrerCode: refCodeA });
  }
  const refASummary = await req('GET', '/referral/my', null, refA.json.token);
  check('Parrain : 100 inscrits → part de 5 %', refASummary.json.referral?.registeredCount === 100 && refASummary.json.referral?.rate === 5);

  // Après 100 inscrits, un paiement annuel (1000 F) -> 5 % = 50 FCFA.
  const refBSub2 = await subscribeConfirmed('/client/subscribe', 'annual', refB.json.token);
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
