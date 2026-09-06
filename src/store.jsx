import React, { createContext, useContext, useMemo, useReducer, useState, useEffect, useCallback } from 'react';
import { api, setToken, clearToken } from './api';
import { DATA_MODE } from './config';

// ============================================================
//  Cabine En Ligne — global store (in-memory, respawns on reload)
// ============================================================

const now = () => Date.now();

const seed = () => ({
  loggedIn: false,
  role: null,
  user: null,

  // Mode connecté (backend)
  connected: false,
  backendMode: 'mock',

  // Preferences (client)
  hideBalance: false,
  notifications: true,

  // Balances (CEL account)
  clientBalance: 15000,
  gerantBalance: 45000,

  // Active subscription (client) — the new model
  activeSubscription: {
    id: 'sub_1',
    plan: 'minutes',
    name: 'Forfait Minutes',
    amount: 3000,
    renews: '14/10/2026',
  },

  // Client's list of gérants
  gerants: [
    { id: 'g1', name: 'Boutique Amadou', phone: '771234567', rating: 4.8, tx: 156, online: true },
    { id: 'g2', name: 'Kiosque Fatou', phone: '789876543', rating: 4.6, tx: 89, online: false },
    { id: 'g3', name: 'Cabine Moussa', phone: '765554433', rating: 4.2, tx: 234, online: true },
  ],

  // Gérant's clients
  clients: [
    { id: 'c1', name: 'Jean Dupont', phone: '771112233', tx: 45, online: true, added: '09/09/2025' },
    { id: 'c2', name: 'Marie Diallo', phone: '784445566', tx: 23, online: true, added: '12/09/2025' },
    { id: 'c3', name: 'Ibrahima Fall', phone: '767778899', tx: 67, online: false, added: '04/02/2025' },
  ],

  // Transactions (shown in client + gérant history)
  // type: recharge | unites | minutes | internet | retrait | abonnement
  // status: reussi | en_attente | annule
  transactions: [
    { id: 't1', role: 'client', type: 'recharge', label: 'Recharge', amount: 10000, date: '14 sept. à 21:51', status: 'reussi' },
    { id: 't2', role: 'client', type: 'internet', label: 'internet', amount: -1000, date: '14 sept. à 18:51', pour: '789876543', status: 'reussi' },
    { id: 't3', role: 'client', type: 'unites', label: 'units', amount: -2000, date: '13 sept. à 23:51', pour: '771234567', status: 'reussi' },
    { id: 't4', role: 'client', type: 'recharge', label: 'Recharge', amount: 5000, date: '12 sept. à 23:51', status: 'reussi' },
    { id: 't5', role: 'client', type: 'unites', label: 'units', amount: -800, date: '14 sept. à 23:57', pour: '0303030303', status: 'reussi' },
    { id: 't6', role: 'client', type: 'recharge', label: 'Recharge', amount: 1000, date: '14 sept. à 23:58', status: 'reussi' },

    { id: 't7', role: 'gerant', type: 'retrait', label: 'Retrait Wave', amount: -15000, date: 'Il y a 3 h', status: 'reussi' },
    { id: 't8', role: 'gerant', type: 'minutes', label: 'minutes', amount: 3000, date: 'Il y a 5h', pour: '765554433', status: 'en_attente' },
    { id: 't9', role: 'gerant', type: 'internet', label: 'internet', amount: 2000, date: 'Hier', pour: '781234567', status: 'reussi' },
    { id: 't10', role: 'gerant', type: 'retrait', label: 'Retrait Wave', amount: -10000, date: 'Il y a 2 jours', status: 'reussi' },
    { id: 't11', role: 'gerant', type: 'unites', label: 'units', amount: 5000, date: 'Il y a 3 jours', pour: '774567890', status: 'reussi' },
  ],

  // Demandes (gérant processing queue), linked to a client transaction
  demandes: [
    { id: 'd1', txId: 't8', type: 'minutes', amount: 3000, client: 'Moussa Ndiaye', benef: '765554433', created: now() - 5 * 60000, expiresIn: 163, status: 'en_attente' },
    { id: 'd2', txId: 't9', type: 'internet', amount: 2000, client: 'Fatou Sow', benef: '781234567', created: now() - 3600000 * 2, expiresIn: 208, status: 'en_attente' },
  ],
});

function reducer(state, action) {
  switch (action.type) {
    case 'SELECT_ROLE':
      return { ...state, role: action.role };

    case 'SET_BACKEND':
      return { ...state, backendMode: action.mode, connected: true };

    case 'HYDRATE': {
      const p = action.payload || {};
      return {
        ...state,
        ...(p.gerants ? { gerants: p.gerants } : {}),
        ...(p.clients ? { clients: p.clients } : {}),
        ...(p.transactions ? { transactions: p.transactions } : {}),
        ...(p.clientBalance != null ? { clientBalance: p.clientBalance } : {}),
        ...(p.gerantBalance != null ? { gerantBalance: p.gerantBalance } : {}),
        ...(p.activeSubscription ? { activeSubscription: p.activeSubscription } : {}),
      };
    }

    case 'LOGIN':
      return { ...state, loggedIn: true, user: action.user };

    case 'SIGNUP':
      return { ...state, loggedIn: true, user: action.user };

    case 'LOGOUT':
      return { ...seed(), loggedIn: false, role: state.role };

    case 'TOGGLE_HIDE_BALANCE':
      return { ...state, hideBalance: !state.hideBalance };
    case 'TOGGLE_NOTIFICATIONS':
      return { ...state, notifications: !state.notifications };

    // ---- Client: send a demande to a gérant via Wave ----
    case 'SEND_DEMANDE': {
      const { type, amount, beneficiary, gerantId } = action.payload;
      const txId = 'tx_' + now();
      const dId = 'd_' + now();
      const tx = {
        id: txId, role: 'client', type,
        label: typeLabel(type), amount: -amount,
        date: 'À l\'instant', pour: beneficiary || '', status: 'en_attente',
      };
      const d = {
        id: dId, txId, type, amount,
        client: state.user?.name || 'Client',
        benef: beneficiary || '', gerantId,
        created: now(), expiresIn: 300, status: 'en_attente',
      };
      return {
        ...state,
        transactions: [tx, ...state.transactions],
        demandes: [d, ...state.demandes],
      };
    }

    // ---- Gérant: confirm (treat) a demande ----
    case 'CONFIRM_DEMANDE': {
      const dId = action.payload;
      const d = state.demandes.find((x) => x.id === dId);
      if (!d) return state;
      const demandes = state.demandes.map((x) => (x.id === dId ? { ...x, status: 'complete', done: true } : x));
      const transactions = state.transactions.map((x) =>
        x.id === d.txId ? { ...x, status: 'reussi' } : x,
      );
      const gainTx = {
        id: 'gtx_' + now(), role: 'gerant', type: d.type,
        label: typeLabel(d.type), amount: d.amount,
        date: 'À l\'instant', pour: d.benef || '', status: 'reussi',
      };
      return {
        ...state,
        demandes,
        transactions: [gainTx, ...transactions],
        gerantBalance: state.gerantBalance + d.amount,
      };
    }

    // ---- Client: subscribe via Wave (abonnement) ----
    case 'SUBSCRIBE': {
      const { plan, name, amount, renews } = action.payload;
      const tx = {
        id: 'tx_' + now(), role: 'client', type: 'abonnement',
        label: name || 'Abonnement', amount: -amount, date: 'À l\'instant',
        status: 'reussi', sub: plan,
      };
      return {
        ...state,
        activeSubscription: { id: 'sub_' + now(), plan, name, amount, renews: renews || '14/10/2026' },
        transactions: [tx, ...state.transactions],
      };
    }

    // ---- Gérant: withdraw via Wave ----
    case 'WITHDRAW': {
      const { amount } = action.payload;
      const tx = {
        id: 'tx_' + now(), role: 'gerant', type: 'retrait',
        label: 'Retrait Wave', amount: -amount, date: 'À l\'instant', status: 'reussi',
      };
      return {
        ...state,
        gerantBalance: state.gerantBalance - amount,
        transactions: [tx, ...state.transactions],
      };
    }

    case 'ADD_GERANT': {
      const { name, phone } = action.payload;
      const id = 'g_' + now();
      return {
        ...state,
        gerants: [...state.gerants, { id, name, phone, rating: 3.5, tx: 0, online: true }],
      };
    }
    case 'ADD_CLIENT': {
      const { name, phone } = action.payload;
      const id = 'c_' + now();
      return {
        ...state,
        clients: [...state.clients, { id, name, phone, tx: 0, online: true, added: '06/09/2025' }],
      };
    }
    case 'DELETE_GERANT': {
      return { ...state, gerants: state.gerants.filter((g) => g.id !== action.payload) };
    }
    case 'DELETE_CLIENT': {
      return { ...state, clients: state.clients.filter((c) => c.id !== action.payload) };
    }

    default:
      return state;
  }
}

function typeLabel(t) {
  return ({ unites: 'units', minutes: 'minutes', internet: 'internet', recharge: 'Recharge' })[t] || t;
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, seed);
  // online: true si l'API est joignable -> on fonctionne en mode connecté.
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(true);

  // ---- Détection de l'API au démarrage ----
  const probe = useCallback(async () => {
    setChecking(true);
    if (DATA_MODE === 'mock') { setChecking(false); setOnline(false); return; }
    try {
      const h = await api.health();
      setOnline(!!h && h.status === 'ok');
      if (h && h.status === 'ok' && h.mode) {
        dispatch({ type: 'SET_BACKEND', mode: h.mode });
      }
    } catch {
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { probe(); }, [probe]);

  // ---- Login / register : API d'abord, sinon démo locale ----
  const login = useCallback(async ({ role, phone, password }) => {
    if (!online) {
      const name = role === 'gerant' ? 'Marie Diallo' : 'Jean Dupont';
      dispatch({ type: 'LOGIN', user: { role, name, phone, email: role === 'gerant' ? 'marie@example.com' : 'jean@example.com' } });
      return { source: 'mock' };
    }
    try {
      const { token, user } = await api.login({ phone, password: password || '' });
      setToken(token);
      dispatch({ type: 'LOGIN', user });
      return { source: 'api' };
    } catch (e) {
      // Erreur d'authentification (401) -> on la remonte ; sinon repli démo
      if (e && e.status === 401) throw e;
      const name = role === 'gerant' ? 'Marie Diallo' : 'Jean Dupont';
      dispatch({ type: 'LOGIN', user: { role, name, phone, email: role === 'gerant' ? 'marie@example.com' : 'jean@example.com' } });
      return { source: 'mock' };
    }
  }, [online]);

  const register = useCallback(async (payload) => {
    if (!online) {
      dispatch({ type: 'SIGNUP', user: { ...payload, email: payload.email || '' } });
      return { source: 'mock' };
    }
    try {
      const { token, user } = await api.register(payload);
      setToken(token);
      dispatch({ type: 'SIGNUP', user });
      return { source: 'api' };
    } catch (e) {
      if (e && (e.status === 401 || e.status === 409)) throw e;
      dispatch({ type: 'SIGNUP', user: { ...payload, email: payload.email || '' } });
      return { source: 'mock' };
    }
  }, [online]);

  const logout = useCallback(() => {
    clearToken();
    dispatch({ type: 'LOGOUT' });
  }, []);

  // ---- Rafraîchit les données du serveur dans l'état local ----
  const refresh = useCallback(async () => {
    if (!online) return;
    try {
      if (state.role === 'client') {
        const [g, sub, hist, bal] = await Promise.all([
          api.client.gerants().catch(() => null),
          api.client.subscription().catch(() => null),
          api.client.history().catch(() => null),
          api.client.balance().catch(() => null),
        ]);
        dispatch({ type: 'HYDRATE', payload: {
          gerants: g?.gerants, transactions: hist?.transactions,
          clientBalance: bal?.balance, activeSubscription: sub?.subscription,
        } });
      } else if (state.role === 'gerant') {
        const [cli, hist, bal] = await Promise.all([
          api.gerant.clients().catch(() => null),
          api.gerant.history().catch(() => null),
          api.gerant.balance().catch(() => null),
        ]);
        dispatch({ type: 'HYDRATE', payload: {
          clients: cli?.clients, transactions: hist?.transactions,
          gerantBalance: bal?.balance,
        } });
      }
    } catch {
      /* silencieux : on garde l'état local */
    }
  }, [online, state.role]);

  // ---- Fonctions d'action : appel API + mise à jour locale optimiste ----
  const sendDemande = useCallback(async (payload) => {
    dispatch({ type: 'SEND_DEMANDE', payload });
    if (online) { try { await api.client.createDemande(payload); refresh(); } catch { /* optimiste */ } }
  }, [online, refresh]);

  const subscribe = useCallback(async (payload) => {
    dispatch({ type: 'SUBSCRIBE', payload });
    if (online) { try { await api.client.subscribe(payload); refresh(); } catch { /* optimiste */ } }
  }, [online, refresh]);

  const addGerant = useCallback(async (payload) => {
    dispatch({ type: 'ADD_GERANT', payload });
    if (online) { try { await api.client.addGerant(payload); refresh(); } catch { /* optimiste */ } }
  }, [online, refresh]);

  const deleteGerant = useCallback(async (id) => {
    dispatch({ type: 'DELETE_GERANT', payload: id });
    if (online) { try { await api.client.deleteGerant(id); } catch { /* optimiste */ } }
  }, [online]);

  const withdraw = useCallback(async (amount) => {
    dispatch({ type: 'WITHDRAW', payload: { amount } });
    if (online) { try { await api.gerant.withdraw(amount); refresh(); } catch { /* optimiste */ } }
  }, [online, refresh]);

  const confirmDemande = useCallback(async (id) => {
    dispatch({ type: 'CONFIRM_DEMANDE', payload: id });
    if (online) { try { await api.gerant.confirmDemande(id); refresh(); } catch { /* optimiste */ } }
  }, [online, refresh]);

  const addClient = useCallback(async (payload) => {
    dispatch({ type: 'ADD_CLIENT', payload });
    if (online) { try { await api.gerant.addClient(payload); refresh(); } catch { /* optimiste */ } }
  }, [online, refresh]);

  const deleteClient = useCallback(async (id) => {
    dispatch({ type: 'DELETE_CLIENT', payload: id });
    if (online) { try { await api.gerant.deleteClient(id); } catch { /* optimiste */ } }
  }, [online]);

  // S'enregistre comme mode connecté si une session JWT existe
  useEffect(() => {
    if (online && state.loggedIn) refresh();
  }, [online]); // eslint-disable-line

  const value = useMemo(
    () => ({
      state, dispatch, online, checking, login, register, logout, refresh,
      sendDemande, subscribe, addGerant, deleteGerant, withdraw,
      confirmDemande, addClient, deleteClient,
    }),
    [state, online, checking, login, register, logout, refresh, sendDemande,
      subscribe, addGerant, deleteGerant, withdraw, confirmDemande, addClient, deleteClient],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  return useContext(Ctx);
}
