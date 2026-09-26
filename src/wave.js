// Frais Wave (transfert de personne à personne, Côte d'Ivoire) :
//  - de 1 à 500 F : 5 F ; ensuite 1 % par tranche de 500 F entamée
//    (ex. 1 200 F → 1 000 F = 10 F + 200 F = 5 F → 15 F).
export function waveFee(amount) {
  const a = Math.max(0, parseInt(amount, 10) || 0);
  return a > 0 ? Math.ceil(a / 500) * 5 : 0;
}
export const WAVE_FEE_TEXT = '5 F jusqu\'à 500 F, puis 1 % par tranche de 500 F';
