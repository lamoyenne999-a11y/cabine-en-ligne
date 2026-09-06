import { getDb, save, insert, findOne, update } from '../db.js';
import { wave } from './waveService.js';

// ==================================================================
//  Logique métier : relie les événements Wave à la vie de l'app.
//  - Paiement client réussi -> la demande est "payée", la transaction
//    client passe à réussie.
//  - Le gérant CONFIRME le traitement -> son solde CEL est crédité.
//  - Retrait gérant -> vérif solde + Payout (remboursé si échec).
// ==================================================================

const TYPE_LABEL = {
  unites: 'units',
  minutes: 'minutes',
  internet: 'internet',
  abonnement: 'Abonnement',
  retrait: 'Retrait Wave',
  recharge: 'Recharge',
};

function nowLabel() {
  return new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function addTransaction(tx) {
  return insert('transactions', {
    role: tx.role,
    type: tx.type,
    label: tx.label,
    amount: tx.amount,
    date: nowLabel(),
    pour: tx.pour || '',
    status: tx.status || 'reussi',
    sub: tx.sub || '',
    userId: tx.userId || '',
    meta: tx.meta || {},
  });
}

// ----- Crée une demande (client) + transaction client + session Checkout -----
export async function createDemande({ client, type, amount, beneficiary, gerantId }) {
  const gerant = findOne('gerants', (g) => g.id === gerantId);
  if (!gerant) throw Object.assign(new Error('Gérant introuvable'), { status: 404 });

  const ref = `demande:${Date.now()}`;
  const d = insert('demandes', {
    ref,
    type,
    amount,
    client: client.name,
    clientId: client.id,
    benef: beneficiary || client.name,
    gerantId,
    gerantPhone: gerant.phone,
    gerantName: gerant.name,
    createdAt: Date.now(),
    expiresIn: 300,
    status: 'en_attente',
    paid: false,
  });

  addTransaction({
    role: 'client', type, label: TYPE_LABEL[type] || type,
    amount: -amount, pour: beneficiary || client.name, status: 'en_attente',
    userId: client.id, meta: { demandeId: d.id, ref },
  });

  const session = await wave.createCheckout({
    amount,
    client_reference: ref,
    description: `${type} pour ${gerant.name}`,
    metadata: { demandeId: d.id, gerantId, clientId: client.id },
  });

  return { demande: d, checkout: session };
}

// ----- Abonnement (client) via Checkout -----
export async function subscribe({ client, plan, name, amount, renews }) {
  const ref = `sub:${Date.now()}`;
  const session = await wave.createCheckout({
    amount,
    client_reference: ref,
    description: `Abonnement ${name}`,
    metadata: { clientId: client.id, plan, name, amount, renews },
  });
  return { checkout: session, ref };
}

// ----- Retrait du gérant -----
export async function withdraw({ gerant, amount }) {
  const db = getDb();
  const bal = db.balances[gerant.id] || 0;
  if (amount <= 0) throw Object.assign(new Error('Montant invalide'), { status: 400 });
  if (amount > bal) throw Object.assign(new Error('Solde insuffisant'), { status: 400 });

  const ref = `withdraw:${Date.now()}`;
  db.balances[gerant.id] = bal - amount;
  save();

  const tx = addTransaction({
    role: 'gerant', type: 'retrait', label: TYPE_LABEL.retrait,
    amount: -amount, status: 'en_attente',
    userId: gerant.id, meta: { ref, userId: gerant.id, mobile: gerant.phone, revert: true },
  });

  const payout = await wave.createPayout({
    amount,
    mobile: gerant.phone,
    name: gerant.name,
    client_reference: ref,
  });
  return { tx, payout };
}

// ----- Confirme le traitement d'une demande (crédite le gérant connecté) -----
export function confirmDemande({ demandeId, gerant }) {
  const d = findOne('demandes', (x) => x.id === demandeId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.status === 'complete') return { demande: d, already: true };

  if (d.paid === false) {
    throw Object.assign(new Error('Le client n\'a pas encore payé cette demande'), { status: 400 });
  }

  // Crédite le solde CEL du gérant connecté
  const db = getDb();
  db.balances[gerant.id] = (db.balances[gerant.id] || 0) + d.amount;
  save();

  addTransaction({
    role: 'gerant', type: d.type, label: TYPE_LABEL[d.type] || d.type,
    amount: d.amount, pour: d.client, status: 'reussi',
    userId: gerant.id, meta: { demandeId: d.id, ref: d.ref },
  });

  update('demandes', (x) => x.id === demandeId, { status: 'complete' });

  // La transaction client liée passe à réussie (elle est payée)
  const ct = findOne('transactions', (x) => x.meta?.demandeId === demandeId);
  if (ct) update('transactions', (x) => x.id === ct.id, { status: 'reussi' });

  const updated = findOne('demandes', (x) => x.id === demandeId);
  return { demande: updated, already: false };
}

// ==================================================================
//  Traitement des événements Wave
// ==================================================================
export async function onWaveEvent(event) {
  const { type, data } = event;
  if (type === 'payment.succeeded') await onPaymentSucceeded(data);
  else if (type === 'payout.succeeded') await onPayoutSucceeded(data);
  else if (type === 'payout.failed') await onPayoutFailed(data);
}

async function onPaymentSucceeded(data) {
  const ref = data.reference || data.client_reference;
  const value = data.amount?.value || data.value || 0;

  if (ref?.startsWith('demande:')) {
    const d = findOne('demandes', (x) => x.ref === ref);
    if (d) {
      update('demandes', (x) => x.id === d.id, { paid: true });
      const ct = findOne('transactions', (x) => x.meta?.demandeId === d.id);
      if (ct) update('transactions', (x) => x.id === ct.id, { status: 'reussi' });
    }
  } else if (ref?.startsWith('sub:')) {
    const m = data.metadata || {};
    const db = getDb();
    db.subscriptions[m.clientId] = {
      plan: m.plan || 'minutes',
      name: m.name || 'Forfait',
      amount: value,
      renews: m.renews || '15/10/2026',
    };
    save();
    addTransaction({
      role: 'client', type: 'abonnement', label: TYPE_LABEL.abonnement,
      amount: -value, status: 'reussi', userId: m.clientId, meta: { ref },
    });
  }
}

async function onPayoutSucceeded(data) {
  const ref = data.reference || data.client_reference;
  const tx = findOne('transactions', (x) => x.meta?.ref === ref);
  if (tx) update('transactions', (x) => x.id === tx.id, { status: 'reussi' });
}

async function onPayoutFailed(data) {
  const ref = data.reference || data.client_reference;
  const tx = findOne('transactions', (x) => x.meta?.ref === ref);
  if (tx && tx.meta?.revert) {
    update('transactions', (x) => x.id === tx.id, { status: 'annule' });
    const db = getDb();
    db.balances[tx.meta.userId] = (db.balances[tx.meta.userId] || 0) + Math.abs(tx.amount);
    save();
  }
}
