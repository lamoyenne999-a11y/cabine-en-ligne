// Règles des numéros de téléphone (Côte d'Ivoire : 10 chiffres, sans indicatif).
export const PHONE_LEN = 10;
export const cleanPhone = (v) => String(v || '').replace(/[^0-9]/g, '').slice(0, PHONE_LEN);
export const isValidPhone = (v) => /^[0-9]{10}$/.test(String(v || ''));
// 0707070707 → 07 07 07 07 07
export const fmtPhone = (v) => String(v || '').replace(/(\d{2})(?=\d)/g, '$1 ').trim();
