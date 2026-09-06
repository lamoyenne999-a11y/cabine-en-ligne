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
async function req(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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

  // Connexion gérant démo (identifiant = téléphone)
  const lg = await req('POST', '/auth/login', { phone: '771234567', password: PWD });
  check('Connexion gérant par téléphone 200', lg.status === 200 && lg.json.user?.role === 'gerant');
  const gt = lg.json.token;

  // Aucune notion de solde : le champ solde ne doit pas exister
  check('Pas de solde dans la réponse d\'auth', !('balance' in (lg.json.user || {})));

  // Profil public via lien de partage (sans authentification)
  const pp = await req('GET', `/public/u/${lg.json.user.id}`);
  check('Profil public accessibles sans token', pp.status === 200 && pp.json.profile?.id === 'u_amadou');
  check('Profil public expose le Wave marchand', !!pp.json.profile?.waveNumber);

  // Le gérant définit son lien Wave marchand (pour paiement direct)
  const PAYLINK = 'https://pay.wave.com/m/M_ci_JEUXTEST_/c/ci/';
  const upd = await req('POST', '/gerant/profile', { payLink: PAYLINK }, gt);
  check('Gérant met à jour son lien Wave marchand', upd.status === 200 && upd.json.user?.payLink === PAYLINK);
  const pp2 = await req('GET', `/public/u/${lg.json.user.id}`);
  check('Profil public expose le lien Wave marchand', pp2.json.profile?.payLink === PAYLINK);

  // Ajout d'un gérant par le nouveau client (via le lien public)
  const addg = await req('POST', '/client/gerants', { phone: '771234567', name: 'Boutique Amadou' }, ct);
  check('Ajout de gérant 201', addg.status === 201 && !!addg.json.gerant?.id);
  const gerantId = addg.json.gerant?.id;

  // Création d'une demande (unités)
  const dm = await req('POST', '/client/demandes', {
    gerantId, gerantName: 'Boutique Amadou', gerantWave: '771234567',
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

  // Le gérant accepte
  const acc = await req('POST', `/gerant/demandes/${demandeId}/accept`, {}, gt);
  check('Acceptation gérant OK', acc.status === 200 && acc.json.demande?.status === 'accepted');

  // Le client la voit « à payer »
  const cd = await req('GET', '/client/demandes', null, ct);
  const seen = (cd.json.demandes || []).find((d) => d.id === demandeId);
  check('Client voit la demande acceptée', seen?.status === 'accepted');
  check('Demande expose le Wave marchand du gérant', seen?.gerantWave === '771234567');
  check('Demande porte le lien Wave du gérant', seen?.gerantPayLink === PAYLINK);

  // Paiement direct Wave (hors app) : le client signale qu'il a payé
  const paid = await req('POST', `/client/demandes/${demandeId}/paid`, {}, ct);
  check('Client signale le paiement (paid)', paid.status === 200 && paid.json.demande?.status === 'paid');

  // Le gérant complète le service
  const comp = await req('POST', `/gerant/demandes/${demandeId}/complete`, {}, gt);
  check('Gérant complète la demande', comp.status === 200 && comp.json.demande?.status === 'completed');

  // État final côté client
  const cf = await req('GET', '/client/demandes', null, ct);
  const fin = (cf.json.demandes || []).find((d) => d.id === demandeId);
  check('Demande finalement « completed »', fin?.status === 'completed');

  // Historique client : total dépensé = somme des achats
  const ch = await req('GET', '/client/history', null, ct);
  check('Historique client : total dépensé = 2000', ch.json.summary?.totalSpent === 2000);
  check('Historique client : 1 demande complétée', ch.json.summary?.counts?.completed === 1);
  check('Historique client : liste des transactions', (ch.json.demandes || []).length === 1);

  // Historique gérant : +2000 servi, +1 complétée, la demande est présente
  const gh = await req('GET', '/gerant/history', null, gt);
  check('Historique gérant : total servi +2000', gh.json.summary?.totalServed === base.totalServed + 2000);
  check('Historique gérant : +1 demande complétée', gh.json.summary?.counts?.completed === (base.counts?.completed || 0) + 1);
  check('Historique gérant : la demande apparaît', (gh.json.demandes || []).some((d) => d.id === demandeId && d.status === 'completed'));

  // ===== Paiement AVANT acceptation (le client paie directement, gérant n'a pas encore répondu) =====
  const dm2 = await req('POST', '/client/demandes', {
    gerantId, gerantName: 'Boutique Amadou', gerantWave: '771234567',
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
    gerantId, gerantName: 'Boutique Amadou', gerantWave: '771234567',
    type: 'unites', amount: 700, benefName: 'Awa', benefPhone: '07' + uniq,
  }, ct);
  const demande3Id = dm3.json.demande?.id;
  const early = await req('POST', `/client/demandes/${demande3Id}/cancel`, {}, ct);
  // avec DEMANDE_EXPIRE_MS très petit, le délai est dépassé dès la création
  check('Client annule une demande non traitée à temps', early.status === 200 && early.json.demande?.status === 'canceled');

  const dm4 = await req('POST', '/client/demandes', {
    gerantId, gerantName: 'Boutique Amadou', gerantWave: '771234567',
    type: 'minutes', amount: 800, benefName: 'Awa', benefPhone: '07' + uniq,
  }, ct);
  const demande4Id = dm4.json.demande?.id;
  const gd_cancel = await req('GET', '/gerant/demandes', null, gt);
  check('La demande avant annulation était pending', (gd_cancel.json.demandes || []).some((d) => d.id === demande4Id && d.status === 'pending'));

  // Abonnement client : essai puis activation à 100 FCFA/mois
  const s0 = await req('GET', '/client/subscription', null, ct);
  check('Abonnement client en essai', s0.json.subscription?.status === 'trial');
  const s1 = await req('POST', '/client/subscribe', {}, ct);
  check('Activation abonnement 100 FCFA', s1.json.subscription?.status === 'active' && s1.json.subscription?.price === 100);

  // Retrait du gérant (ajout/retrait libres)
  const rm = await req('DELETE', `/client/gerants/${gerantId}`, null, ct);
  check('Retrait du gérant OK', rm.status === 200 && rm.json?.ok === true);
  const cg2 = await req('GET', '/client/gerants', null, ct);
  check('Le gérant n\'est plus dans la liste', !(cg2.json.gerants || []).some((g) => g.id === gerantId));

  console.log(`\n===== Résultat : ${pass} OK / ${fail} échec(s) =====\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
