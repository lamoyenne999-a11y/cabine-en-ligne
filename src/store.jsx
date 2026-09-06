import React, { createContext, useContext, useMemo, useReducer, useState, useEffect, useCallback } from 'react';
import { api, setToken, clearToken } from './api';
import { DATA_MODE } from './config';

// ============================================================
//  Cabine En Ligne — store global (v2 simplifiée)
//  ZÉRO argent stocké sur l'app. L'app ne fait que connecter
//  clients <-> gérants. Paiement direct via Wave hors app.
// ============================================================

const now = () => Date.now();

const seed = () => ({
  loggedIn: false,
  role: null,
  user: null,          // { id, role, name, phone, waveNumber, email }
  subscription: null,  // { status: trial|active|expired, daysLeft, price }

  // Client : ses gérants (contacts) + ses demandes
  gerants: [
    { id: 'g1', userId: 'u_amadou', name: 'Boutique Amadou', phone: '771234567', waveNumber: '771234567', rating: 4.8, online: true },
    { id: 'g2', userId: 'u_fatou', name: 'Kiosque Fatou', phone: '789876543', waveNumber: '789876543', rating: 4.6, online: false },
    { id: 'g3', userId: 'u_moussa', name: 'Cabine Moussa', phone: '765554433', waveNumber: '765554433', rating: 4.2, online: true },
  ],
  demandes: [],

  // Gérant : demandes reçues
  gerantDemandes: [],
});

function reducer(state, action) {
  switch (action.type) {
    case 'SELECT_ROLE':
      return { ...state, role: action.role };
    case 'SET_BACKEND':
      return { ...state, connected: true, backendMode: action.mode };
    case 'LOGIN':
    case 'SIGNUP':
      return { ...state, loggedIn: true, user: action.payload.user, subscription: action.payload.subscription };
    case 'LOGOUT':
      return { ...seed(), loggedIn: false, role: state.role };

    case 'HYDRATE': {
      const p = action.payload || {};
      return {
        ...state,
        ...(p.user ? { subscription: p.subscription, user: p.user } : {}),
        ...(p.gerants ? { gerants: p.gerants } : {}),
        ...(p.demandes ? { demandes: p.demandes } : {}),
        ...(p.subscription !== undefined ? { subscription: p.subscription } : {}),
      };
    }

    case 'ADD_GERANT':
      return { ...state, gerants: [...state.gerants, action.payload] };
    case 'REMOVE_GERANT':
      return { ...state, gerants: state.gerants.filter((g) => g.id !== action.payload) };

    case 'ADD_DEMANDE':
      return { ...state, demandes: [action.payload, ...state.demandes] };
    case 'CLIENT_UPDATE_DEMANDE':
      return { ...state, demandes: state.demandes.map((d) => (d.id === action.payload.id ? { ...d, ...action.payload } : d)) };

    case 'SET_GERANT_DEMANDES':
      return { ...state, gerantDemandes: action.payload };
    case 'GERANT_UPDATE_DEMANDE':
      return { ...state, gerantDemandes: state.gerantDemandes.map((d) => (d.id === action.payload.id ? { ...d, ...action.payload } : d)) };

    case 'SET_SUBSCRIPTION':
      return { ...state, subscription: action.payload };

    default:
      return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, seed);
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(true);

  const probe = useCallback(async () => {
    setChecking(true);
    if (DATA_MODE === 'mock') { setChecking(false); setOnline(false); return; }
    try {
      const h = await api.health();
      setOnline(!!h && h.status === 'ok');
      if (h && h.status === 'ok' && h.mode) dispatch({ type: 'SET_BACKEND', mode: h.mode });
    } catch { setOnline(false); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => { probe(); }, [probe]);

  // ---- Auth ----
  const login = useCallback(async ({ role, phone, password }) => {
    if (!online) {
      const name = role === 'gerant' ? 'Cabine Marie' : 'Jean Dupont';
      const user = { id: role === 'gerant' ? 'u_marie' : 'u_client', role, name, phone, waveNumber: phone };
      dispatch({ type: 'LOGIN', payload: { user, subscription: { status: 'trial', daysLeft: 30, price: 100 } } });
      return { source: 'mock' };
    }
    try {
      const { token, user, subscription } = await api.login({ phone, password: password || '' });
      setToken(token);
      dispatch({ type: 'LOGIN', payload: { user, subscription } });
      return { source: 'api' };
    } catch (e) {
      if (e && e.status === 401) throw e;
      dispatch({ type: 'LOGIN', payload: { user: { id: 'u_client', role, name: 'Jean Dupont', phone, waveNumber: phone }, subscription: { status: 'trial', daysLeft: 30, price: 100 } } });
      return { source: 'mock' };
    }
  }, [online]);

  const register = useCallback(async (payload) => {
    if (!online) {
      dispatch({ type: 'SIGNUP', payload: { user: { ...payload }, subscription: { status: 'trial', daysLeft: 30, price: 100 } } });
      return { source: 'mock' };
    }
    try {
      const { token, user, subscription } = await api.register(payload);
      setToken(token);
      dispatch({ type: 'SIGNUP', payload: { user, subscription } });
      return { source: 'api' };
    } catch (e) {
      if (e && (e.status === 401 || e.status === 409)) throw e;
      dispatch({ type: 'SIGNUP', payload: { user: { ...payload }, subscription: { status: 'trial', daysLeft: 30, price: 100 } } });
      return { source: 'mock' };
    }
  }, [online]);

  const logout = useCallback(() => { clearToken(); dispatch({ type: 'LOGOUT' }); }, []);

  // ---- Rafraîchit depuis le serveur ----
  const refresh = useCallback(async () => {
    if (!online) return;
    try {
      const sub = await (state.role === 'gerant' ? api.gerant.subscription() : api.client.subscription()).catch(() => null);
      if (sub) dispatch({ type: 'SET_SUBSCRIPTION', payload: sub.subscription });

      if (state.role === 'client') {
        const [g, d] = await Promise.all([
          api.client.gerants().catch(() => null),
          api.client.myDemandes().catch(() => null),
        ]);
        dispatch({ type: 'HYDRATE', payload: { gerants: g?.gerants, demandes: d?.demandes } });
      } else if (state.role === 'gerant') {
        const d = await api.gerant.demandes().catch(() => null);
        if (d) dispatch({ type: 'SET_GERANT_DEMANDES', payload: d.demandes });
      }
    } catch { /* silencieux */ }
  }, [online, state.role]);

  useEffect(() => { if (online && state.loggedIn) refresh(); }, [online, state.loggedIn]); // eslint-disable-line

  // ---- Actions ----
  const addGerant = useCallback(async (payload) => {
    if (online) {
      try {
        const { gerant } = await api.client.addGerant(payload);
        dispatch({ type: 'ADD_GERANT', payload: gerant });
        return gerant;
      } catch { /* fallback */ }
    }
    dispatch({ type: 'ADD_GERANT', payload: { id: 'g_' + now(), name: payload.name || `Gérant ${(payload.phone || '').slice(-4)}`, phone: payload.phone, waveNumber: payload.phone, rating: 4.0, online: true } });
    return { id: 'g_' + now() };
  }, [online]);

  const removeGerant = useCallback(async (id) => {
    dispatch({ type: 'REMOVE_GERANT', payload: id });
    if (online) { try { await api.client.removeGerant(id); } catch {} }
  }, [online]);

  const createDemande = useCallback(async (payload) => {
    let d;
    if (online) {
      try {
        const { demande } = await api.client.createDemande(payload);
        dispatch({ type: 'ADD_DEMANDE', payload: demande });
        return demande;
      } catch { /* fallback */ }
    }
    d = { id: 'd_' + now(), status: 'pending', type: payload.type, amount: payload.amount, gerantName: payload.gerantName, gerantWave: payload.gerantWave, clientName: 'Vous', benefName: payload.benefName, benefPhone: payload.benefPhone, gerantId: payload.gerantId, createdAt: now() };
    dispatch({ type: 'ADD_DEMANDE', payload: d });
    return d;
  }, [online]);

  const markPaid = useCallback(async (id) => {
    dispatch({ type: 'CLIENT_UPDATE_DEMANDE', payload: { id, status: 'paid' } });
    if (online) { try { await api.client.markPaid(id); } catch {} }
  }, [online]);

  const acceptDemande = useCallback(async (id) => {
    dispatch({ type: 'GERANT_UPDATE_DEMANDE', payload: { id, status: 'accepted' } });
    if (online) { try { await api.gerant.accept(id); } catch {} }
  }, [online]);

  const declineDemande = useCallback(async (id) => {
    dispatch({ type: 'GERANT_UPDATE_DEMANDE', payload: { id, status: 'declined' } });
    if (online) { try { await api.gerant.decline(id); } catch {} }
  }, [online]);

  const completeDemande = useCallback(async (id) => {
    dispatch({ type: 'GERANT_UPDATE_DEMANDE', payload: { id, status: 'completed' } });
    if (online) { try { await api.gerant.complete(id); } catch {} }
  }, [online]);

  const subscribe = useCallback(async () => {
    const sub = { status: 'active', daysLeft: 30, price: 100 };
    dispatch({ type: 'SET_SUBSCRIPTION', payload: sub });
    if (online) { try { const r = await (state.role === 'gerant' ? api.gerant.subscribe() : api.client.subscribe()); if (r?.subscription) dispatch({ type: 'SET_SUBSCRIPTION', payload: r.subscription }); } catch {} }
    return sub;
  }, [online, state.role]);

  const value = useMemo(
    () => ({ state, dispatch, online, checking, login, register, logout, refresh, addGerant, removeGerant, createDemande, markPaid, acceptDemande, declineDemande, completeDemande, subscribe }),
    [state, online, checking, login, register, logout, refresh, addGerant, removeGerant, createDemande, markPaid, acceptDemande, declineDemande, completeDemande, subscribe],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() { return useContext(Ctx); }
