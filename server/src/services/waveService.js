import crypto from 'node:crypto';
import { config } from '../config.js';

// ==================================================================
//  WaveGateway
//  - mode "mock" : simule Checkout / Payout et déclenche les webhooks
//      automatiquement (aucun appel réseau).
//  - mode "live" : appelle l'API réelle https://api.wave.com/v1 et fait
//      confiance aux webhooks entrants (vérifiés par signature HMAC).
//
//  C'est le SEUL endroit à modifier pour brancher le vrai Wave.
// ==================================================================

class WaveGateway {
  constructor() {
    this.mode = config.waveMode;
    this.base = config.waveBaseUrl;
    this.apiKey = config.waveApiKey;
    this.secret = config.waveWebhookSecret;
    this.fakeId = 0;
    // Le serveur enregistre ici la fonction qui traite les événements Wave
    this.eventHandler = null;
  }

  /** Enregistre le handler métier appelé à chaque événement Wave. */
  onEvent(fn) {
    this.eventHandler = fn;
  }

  // ---- Helpers ----
  _fakeRef(prefix) {
    this.fakeId += 1;
    return `${prefix}-${Date.now()}-${String(this.fakeId).padStart(4, '0')}`;
  }

  _sign(body) {
    return crypto.createHmac('sha256', this.secret).update(body).digest('hex');
  }

  /** Vérifie la signature HMAC d'un webhook entrant. */
  verifySignature(rawBody, signature) {
    try {
      const expected = this._sign(rawBody);
      const a = Buffer.from(String(signature));
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  // ---- HTTP (mode réel) ----
  async _request(method, path, body, headers = {}) {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!res.ok) throw new Error(`Wave API ${res.status}: ${text}`);
    return json;
  }

  // ---- CHECKOUT ----
  // Le client paie (abonnement OU paiement direct au gérant).
  async createCheckout({ amount, currency = 'XOF', client_reference, description, metadata = {} }) {
    if (this.mode === 'mock') {
      const session = {
        id: this._fakeRef('chk'),
        checkout_url: `https://mock.wave/checkout/${client_reference}`,
        reference: client_reference,
        amount: { currency, value: amount },
        status: 'created',
        description,
        metadata,
      };
      // Simule le client qui confirme + le webhook payment.succeeded
      setTimeout(() => this._emit(session), config.waveMockDelayMs);
      return session;
    }

    const session = await this._request('POST', '/checkout', {
      amount: { currency, value: amount },
      reference: client_reference,
      description,
      metadata,
    });
    // En live, la confirmation arrivera par webhook HTTP (POST /api/webhooks/wave)
    return session;
  }

  // ---- PAYOUT ----
  // Envoi d'argent vers un numéro mobile (payer le gérant, retrait du gérant).
  async createPayout({ amount, currency = 'XOF', mobile, name, client_reference }) {
    if (this.mode === 'mock') {
      const payout = {
        id: this._fakeRef('po'),
        reference: client_reference,
        recipient: { name, mobile },
        amount: { currency, value: amount },
        status: 'processing',
      };
      setTimeout(() => this._emit(payout, 'payout'), config.waveMockDelayMs);
      return payout;
    }

    const payout = await this._request(
      'POST',
      '/payout',
      {
        currency,
        receive_amount: amount,
        name,
        mobile: this.#normalizeMobile(mobile),
        client_reference,
      },
      { 'idempotency-key': client_reference },
    );
    return payout;
  }

  // ---- Webhook external handler (mode réel) ----
  async handleWebhook(rawBody, signature) {
    if (!this.verifySignature(rawBody, signature)) {
      throw new Error('Signature HMAC invalide');
    }
    const event = JSON.parse(rawBody);
    if (this.eventHandler) await this.eventHandler(event);
    return event;
  }

  // ---- Internal mock emission (mode mock) ----
  async _emit(payload, kind = 'payment') {
    const event = {
      type: kind === 'payout' ? 'payout.succeeded' : 'payment.succeeded',
      data: payload,
      timestamp: new Date().toISOString(),
    };
    if (this.eventHandler) await this.eventHandler(event);
  }

  #normalizeMobile(mobile) {
    const m = String(mobile).replace(/[^0-9]/g, '');
    return m.startsWith('00') ? `+${m.slice(2)}` : `+${m}`;
  }
}

export const wave = new WaveGateway();
