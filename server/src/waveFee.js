// Frais Wave : 5 F de 1 à 500 F, puis 1 % par tranche de 500 F entamée (1 200 F → 15 F).
export function waveFee(amount) {
  const a = Math.max(0, parseInt(amount, 10) || 0);
  return a > 0 ? Math.ceil(a / 500) * 5 : 0;
}
