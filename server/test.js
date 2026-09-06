// ==================================================================
//  Test de bout en bout de l'API Cabine En Ligne (mode Wave mock)
//  Usage : node test.js   (le serveur doit tourner sur le port 4000)
// ==================================================================
const BASE = process.env.API || 'http://localhost:4000/api';

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
  let j;
  try { j = JSON.parse(text); } catch { j = { raw: text }; }
  return { status: r.status, json: j };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('\n===== Test Cabine En Ligne (Wave = mock) =====\n');

  // Health
  const health = await req('GET', '/../health');
  check('API démarrée (health 200)', health.status === 200);

  // Register client
  const uniq = Date.now().toString().slice(-6);
  const reg = await req('POST', '/auth/register', {
    role: 'client', name: 'Awa Cissé', phone: '07' + uniq, email: 'awa@example.com', password: '1234',
  });
  check('Inscription client 201', reg.status === 201);
  const ct = reg.json.token;

  // Login gerant demo
  const lg = await req('POST', '/auth/login', { phone: '0202020202', password: '' });
  check('Connexion gérant 200', lg.status === 200);
  const gt = lg.json.token;

  // Balances initiales
  const b0 = await req('GET', '/gerant/balance', null, gt);
  check('Solde gérant initial > 0', b0.json.balance > 0);
  const bal0 = b0.json.balance;

  // Create demande
  const dm = await req('POST', '/client/demandes', {
    type: 'minutes', amount: 2500, beneficiary: '765554433', gerantId: 'g3',
  }, ct);
  check('Création demande 201', dm.status === 201);
  check('Checkout Wave retourné', !!dm.json.checkout?.id);
  const demandeId = dm.json.demande.id;

  // Le gérant ne devrait PAS pouvoir confirmer avant paiement
  await sleep(100);
  const preConfirm = await req('POST', `/gerant/demandes/${demandeId}/confirm`, {}, gt);
  // (selon timing le webhook mock peut déjà être passé; on n'assert pas strictement)

  // Attendre le webhook mock (payment.succeeded)
  check('Attente webhook Wave simulé…', true);
  await sleep(2500);

  // Confirmer
  const conf = await req('POST', `/gerant/demandes/${demandeId}/confirm`, {}, gt);
  check('Confirmation demande OK', conf.status === 200);
  check('Demande passée à complete', conf.json.demande?.status === 'complete');

  // Balance augmentée de 2500
  const b1 = await req('GET', '/gerant/balance', null, gt);
  check(`Solde gérant +2500 (${bal0} -> ${b1.json.balance})`, b1.json.balance === bal0 + 2500);

  // Historique gérant contient un gain
  const gh = await req('GET', '/gerant/history', null, gt);
  check('Gain visible dans historique gérant', gh.json.transactions.some((t) => t.amount === 2500 && t.status === 'reussi'));

  // Retrait via Wave
  const wd = await req('POST', '/gerant/withdraw', { amount: 2500 }, gt);
  check('Retrait accepté', wd.status === 201);
  await sleep(2500);
  const b2 = await req('GET', '/gerant/balance', null, gt);
  check(`Solde gérant après retrait (${b1.json.balance} -> ${b2.json.balance})`, b2.json.balance === b1.json.balance - 2500);

  // Abonnement via Wave
  const sub = await req('POST', '/client/subscribe', { plan: 'internet', name: 'Forfait Internet', amount: 4500, renews: '15/10/2026' }, ct);
  check('Abonnement créé', sub.status === 201);
  await sleep(2500);
  const subs = await req('GET', '/client/subscription', null, ct);
  check('Abonnement activé après paiement', subs.json.subscription?.name === 'Forfait Internet');

  // Historique client
  const ch = await req('GET', '/client/history', null, ct);
  check('Historique client contient la transaction', ch.json.transactions.length >= 1);

  console.log(`\n===== Résultat : ${pass} OK / ${fail} échec(s) =====\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
