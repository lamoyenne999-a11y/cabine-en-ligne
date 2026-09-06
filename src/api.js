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

async function request(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(json.error || `Erreur ${res.status}`), { status: res.status });
  return json;
}

export const api = {
  health: () => request('GET', '/health'),

  // ---- auth (identifiant = téléphone) ----
  register: (p) => request('POST', '/api/auth/register', p),
  login: (p) => request('POST', '/api/auth/login', p),
  me: () => request('GET', '/api/auth/me'),

  // ---- public (liens de partage) ----
  public: {
    profile: (id) => request('GET', `/api/public/u/${id}`),
  },

  // ---- client ----
  client: {
    gerants: () => request('GET', '/api/client/gerants'),
    addGerant: (p) => request('POST', '/api/client/gerants', p),
    removeGerant: (id) => request('DELETE', `/api/client/gerants/${id}`),
    createDemande: (p) => request('POST', '/api/client/demandes', p),
    myDemandes: () => request('GET', '/api/client/demandes'),
    history: () => request('GET', '/api/client/history'),
    markPaid: (id) => request('POST', `/api/client/demandes/${id}/paid`),
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
    complete: (id) => request('POST', `/api/gerant/demandes/${id}/complete`),
    profile: () => request('GET', '/api/gerant/profile'),
    updateProfile: (p) => request('POST', '/api/gerant/profile', p),
    notifications: () => request('GET', '/api/gerant/notifications'),
    markNotificationRead: (id) => request('POST', `/api/gerant/notifications/${id}/read`),
    markAllNotificationsRead: () => request('POST', '/api/gerant/notifications/read-all'),
    subscription: () => request('GET', '/api/gerant/subscription'),
    subscribe: (plan) => request('POST', '/api/gerant/subscribe', { plan }),
  },
};
