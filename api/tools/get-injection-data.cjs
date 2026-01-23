const admin = require('firebase-admin');
const fs = require('fs');

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

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const getQueryParam = (req, key) => {
  const rawUrl = req.url || '';
  const host = req.headers?.host || 'localhost';
  const url = rawUrl.startsWith('http') ? new URL(rawUrl) : new URL(rawUrl, `http://${host}`);
  return url.searchParams.get(key);
};

const isActiveSubscription = (subscriptionEnd) => {
  if (!subscriptionEnd) return false;
  const end = new Date(String(subscriptionEnd));
  if (Number.isNaN(end.getTime())) return false;
  return end > new Date();
};

const requireSubscriberOrAdmin = async (req) => {
  const token = getBearerToken(req);
  if (!token) return { ok: false, status: 401, message: 'Unauthorized' };

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const uid = decoded.uid;
  const userSnap = await admin.firestore().doc(`texa_users/${uid}`).get();
  if (!userSnap.exists) return { ok: false, status: 403, message: 'Forbidden' };

  const data = userSnap.data() || {};
  if (data.role === 'ADMIN') return { ok: true, uid, role: 'ADMIN' };
  if (data.isActive === false) return { ok: false, status: 403, message: 'Forbidden' };
  if (!isActiveSubscription(data.subscriptionEnd)) return { ok: false, status: 403, message: 'Forbidden' };

  return { ok: true, uid, role: 'MEMBER' };
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'GET') return json(res, 405, { success: false, message: 'Method not allowed' });

  const init = initAdmin();
  if (!init.ok) return json(res, 500, { success: false, message: 'Admin server belum dikonfigurasi' });

  const guard = await requireSubscriberOrAdmin(req);
  if (!guard.ok) return json(res, guard.status, { success: false, message: guard.message });

  const toolId = String(getQueryParam(req, 'toolId') || '').trim();
  if (!toolId) return json(res, 400, { success: false, message: 'toolId tidak valid' });

  const toolSnap = await admin.firestore().doc(`texa_catalog/${toolId}`).get();
  if (!toolSnap.exists) return json(res, 404, { success: false, message: 'Tool tidak ditemukan' });

  const tool = toolSnap.data() || {};
  if (tool.status && tool.status !== 'active') return json(res, 404, { success: false, message: 'Tool tidak tersedia' });

  return json(res, 200, {
    success: true,
    tool: {
      id: toolSnap.id,
      targetUrl: tool.targetUrl || ''
    }
  });
};
