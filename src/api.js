import { API_URL } from './config';

// ============================================================
//  Client API — appelle le backend Node/Express (server/).
//  API_URL est '' en web (même origine, l'app et le serveur de
//  preview proxifient /api vers le backend) ou l'URL du backend
//  sur appareil. Les chemins ci-dessous sont absolus.
// ============================================================

let authToken = null;

export function setToken(token) { authToken = token; }
export function clearToken() { authToken = null; }
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

  register: (payload) => request('POST', '/api/auth/register', payload),
  login: (payload) => request('POST', '/api/auth/login', payload),
  me: () => request('GET', '/api/auth/me'),

  client: {
    gerants: () => request('GET', '/api/client/gerants'),
    addGerant: (p) => request('POST', '/api/client/gerants', p),
    deleteGerant: (id) => request('DELETE', `/api/client/gerants/${id}`),
    createDemande: (p) => request('POST', '/api/client/demandes', p),
    subscribe: (p) => request('POST', '/api/client/subscribe', p),
    subscription: () => request('GET', '/api/client/subscription'),
    history: () => request('GET', '/api/client/history'),
    balance: () => request('GET', '/api/client/balance'),
  },

  gerant: {
    dashboard: () => request('GET', '/api/gerant/dashboard'),
    demandes: () => request('GET', '/api/gerant/demandes'),
    confirmDemande: (id) => request('POST', `/api/gerant/demandes/${id}/confirm`),
    clients: () => request('GET', '/api/gerant/clients'),
    addClient: (p) => request('POST', '/api/gerant/clients', p),
    deleteClient: (id) => request('DELETE', `/api/gerant/clients/${id}`),
    history: () => request('GET', '/api/gerant/history'),
    balance: () => request('GET', '/api/gerant/balance'),
    withdraw: (amount) => request('POST', '/api/gerant/withdraw', { amount }),
  },
};
