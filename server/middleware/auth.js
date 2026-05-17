// server/middleware/auth.js
// requireAdmin: session check + CSRF guard for mutating requests

export function requireAdmin(req, res, next) {
  if (!req.session?.admin) {
    return res.status(401).json({ error: 'Unauthorized — please log in' });
  }
  // CSRF guard: all non-GET requests must include the custom header
  // sameSite=strict on the cookie already blocks most CSRF; this is a second layer
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({ error: 'CSRF check failed' });
  }
  next();
}
