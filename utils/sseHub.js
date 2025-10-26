// utils/sseHub.js
// Very small in-memory connection hub for SSE.

const clientsByUser = new Map();   // userId -> Set(res)
const adminClients = new Set();     // all admin connections
const allClients = new Set();       // everyone (for audience: 'all')

export function addClient({ res, user }) {
  // track in "all"
  allClients.add(res);

  // track per-user
  const set = clientsByUser.get(String(user._id)) || new Set();
  set.add(res);
  clientsByUser.set(String(user._id), set);

  // track admin group
  if (user.role === 'admin') adminClients.add(res);

  // cleanup on close
  reqOnClose(res, () => {
    allClients.delete(res);
    const s = clientsByUser.get(String(user._id));
    if (s) { s.delete(res); if (s.size === 0) clientsByUser.delete(String(user._id)); }
    if (user.role === 'admin') adminClients.delete(res);
  });
}

export function sendToUser(userId, payload) {
  const set = clientsByUser.get(String(userId));
  if (!set) return;
  for (const res of set) safeWrite(res, payload);
}

export function sendToAdmins(payload) {
  for (const res of adminClients) safeWrite(res, payload);
}

export function sendToAll(payload) {
  for (const res of allClients) safeWrite(res, payload);
}

function safeWrite(res, payload) {
  try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
}

function reqOnClose(res, cb) {
  res.on('close', cb);
  res.on('finish', cb);
}

