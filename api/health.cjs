const admin = require('firebase-admin');
const fs = require('fs');

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const getAdminCredential = () => {
  const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (sa) return admin.credential.cert(JSON.parse(sa));
  if (saPath) return admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8')));
  throw new Error('Missing FIREBASE_ADMIN_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS');
};

const initAdmin = () => {
  if (admin.apps.length) return { ok: true };
  try {
    admin.initializeApp({ credential: getAdminCredential() });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e && e.message ? String(e.message) : 'Admin credential error' };
  }
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});

  const init = initAdmin();
  return json(res, 200, { ok: true, adminReady: init.ok, adminInitError: init.ok ? undefined : init.message });
};

