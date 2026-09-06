export function notFound(req, res) {
  res.status(404).json({ error: 'Route introuvable' });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({ error: err.message || 'Erreur serveur' });
}
