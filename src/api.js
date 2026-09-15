import { API_URL } from './config';
import { storage } from './storage';

// ============================================================
//  Client API — appelle le backend Node/Express (server/).
//  API_URL est '' en web (même origine, proxy) ou l'URL du backend.
//  Le jeton est persisté (localStorage) pour rester connecté.
// ============================================================

let authToken = storage.get('cel_token') || null;
export function setToken(t) { authToken = t; storage.set('cel_token', t); }
export function clearToken() { authToken = null; storage.remove('cel_token'); }
export function getToken() { return authToken; }

async function request(method, path, body, extraHeaders) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(extraHeaders || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(json.error || `Erreur ${res.status}`), { status: res.status, code: json.code || null });
  return json;
}

export const api = {
  health: () => request('GET', '/health'),

  // ---- auth (identifiant = téléphone) ----
  register: (p) => request('POST', '/api/auth/register', p),
  login: (p) => request('POST', '/api/auth/login', p),
  me: () => request('GET', '/api/auth/me'),
  pushToken: (token) => request('POST', '/api/auth/push-token', { token }),
  pushTokenRemove: (token) => request('POST', '/api/auth/push-token/remove', { token }),
  pushSubscription: (subscription) => request('POST', '/api/auth/push-subscription', { subscription }),
  pushSubscriptionRemove: (endpoint) => request('POST', '/api/auth/push-subscription/remove', { endpoint }),

  // ---- public (liens de partage) ----
  public: {
    profile: (id) => request('GET', `/api/public/u/${id}`),
    pushKey: () => request('GET', '/api/public/push-key'),
    // Demande de déblocage déposée par un utilisateur bloqué (sans connexion).
    submitUnblockRequest: (phone, message) => request('POST', '/api/public/unblock-request', { phone, message }),
  },

  // ---- client ----
  client: {
    gerants: () => request('GET', '/api/client/gerants'),
    availableGerants: () => request('GET', '/api/client/gerants/available'),
    addGerant: (p) => request('POST', '/api/client/gerants', p),
    removeGerant: (id) => request('DELETE', `/api/client/gerants/${id}`),
    createDemande: (p) => request('POST', '/api/client/demandes', p),
    myDemandes: () => request('GET', '/api/client/demandes'),
    history: () => request('GET', '/api/client/history'),
    markPaid: (id) => request('POST', `/api/client/demandes/${id}/paid`),
    confirmServed: (id) => request('POST', `/api/client/demandes/${id}/confirm-served`),
    notServed: (id) => request('POST', `/api/client/demandes/${id}/not-served`),
    paymentReply: (id, kind) => request('POST', `/api/client/demandes/${id}/payment-reply`, { kind }),
    cancelDemande: (id) => request('POST', `/api/client/demandes/${id}/cancel`),
    subscription: () => request('GET', '/api/client/subscription'),
    subscribe: (plan) => request('POST', '/api/client/subscribe', { plan }),
    notifications: () => request('GET', '/api/client/notifications'),
    markNotificationRead: (id) => request('POST', `/api/client/notifications/${id}/read`),
    markAllNotificationsRead: () => request('POST', '/api/client/notifications/read-all'),
  },

  // ---- gérant ----
  gerant: {
    demandes: () => request('GET', '/api/gerant/demandes'),
    history: () => request('GET', '/api/gerant/history'),
    accept: (id) => request('POST', `/api/gerant/demandes/${id}/accept`),
    decline: (id) => request('POST', `/api/gerant/demandes/${id}/decline`),
    unavailable: (id, reason) => request('POST', `/api/gerant/demandes/${id}/unavailable`, { reason }),
    requestPayment: (id) => request('POST', `/api/gerant/demandes/${id}/request-payment`),
    setAvailability: (available) => request('POST', '/api/gerant/availability', { available }),
    complete: (id) => request('POST', `/api/gerant/demandes/${id}/complete`),
    received: (id) => request('POST', `/api/gerant/demandes/${id}/received`),
    notReceived: (id) => request('POST', `/api/gerant/demandes/${id}/not-received`),
    partial: (id) => request('POST', `/api/gerant/demandes/${id}/partial`),
    profile: () => request('GET', '/api/gerant/profile'),
    updateProfile: (p) => request('POST', '/api/gerant/profile', p),
    notifications: () => request('GET', '/api/gerant/notifications'),
    markNotificationRead: (id) => request('POST', `/api/gerant/notifications/${id}/read`),
    markAllNotificationsRead: () => request('POST', '/api/gerant/notifications/read-all'),
    subscription: () => request('GET', '/api/gerant/subscription'),
    subscribe: (plan) => request('POST', '/api/gerant/subscribe', { plan }),
  },

  // ---- Parrainage / commission ----
  referral: {
    my: () => request('GET', '/api/referral/my'),
    check: (code) => request('GET', `/api/referral/check/${encodeURIComponent(code)}`),
    setCode: (code) => request('POST', '/api/referral/code', { code }),
  },

  // ---- Vue propriétaire (paiements d'abonnement) ----
  admin: {
    summary: (key) => request('GET', '/api/admin/summary', null, { 'x-admin-key': key }),
    users: (key) => request('GET', '/api/admin/users', null, { 'x-admin-key': key }),
    setFrozen: (key, phone, frozen) => request('POST', '/api/admin/set-frozen', { phone, frozen }, { 'x-admin-key': key }),
    setCertified: (key, phone, certified) => request('POST', '/api/admin/set-certified', { phone, certified }, { 'x-admin-key': key }),
    grantFreeTime: (key, phone, days, note) => request('POST', '/api/admin/grant-free-time', { phone, days, note }, { 'x-admin-key': key }),
    gifts: (key) => request('GET', '/api/admin/gifts', null, { 'x-admin-key': key }),
    deleteAccount: (key, phone) => request('POST', '/api/admin/delete-account', { phone }, { 'x-admin-key': key }),
    blockAccount: (key, phone, reason) => request('POST', '/api/admin/block-account', { phone, reason }, { 'x-admin-key': key }),
    unblockAccount: (key, phone) => request('POST', '/api/admin/unblock-account', { phone }, { 'x-admin-key': key }),
    unblockRequests: (key) => request('GET', '/api/admin/unblock-requests', null, { 'x-admin-key': key }),
    resolveUnblockRequest: (key, id, decision) => request('POST', '/api/admin/resolve-unblock-request', { id, decision }, { 'x-admin-key': key }),
  },
};
