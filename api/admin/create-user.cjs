const admin = require('firebase-admin');
const fs = require('fs');
const crypto = require('crypto');

const ADMIN_EMAILS = new Set([
  'teknoaiglobal.adm@gmail.com',
  'teknoaiglobal@gmail.com',
  'teknoaurora@gmail.com',
  'admin@texa.id'
]);

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

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
};

const getBearerToken = (req) => {
  const authHeader = req.headers?.authorization || '';
  const match = String(authHeader).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const computeSubscriptionEnd = (days) => {
  const durationDays = Number(days);
  if (!Number.isFinite(durationDays) || durationDays <= 0) return null;
  const start = new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + durationDays);
  return { start, end, durationDays };
};

const requireAdmin = async (req) => {
  const token = getBearerToken(req);
  if (!token) return { ok: false, status: 401, message: 'Unauthorized' };

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const email = decoded && decoded.email ? String(decoded.email).toLowerCase() : '';
  if (email && ADMIN_EMAILS.has(email)) return { ok: true, uid: decoded.uid };

  const snap = await admin.firestore().doc(`texa_users/${decoded.uid}`).get();
  const role = snap.exists ? snap.data().role : null;
  if (role !== 'ADMIN') return { ok: false, status: 403, message: 'Forbidden' };

  return { ok: true, uid: decoded.uid };
};

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { success: false, message: 'Method not allowed' });

  const init = initAdmin();
  if (!init.ok) return json(res, 500, { success: false, message: 'Admin server belum dikonfigurasi' });

  const guard = await requireAdmin(req);
  if (!guard.ok) return json(res, guard.status, { success: false, message: guard.message });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { success: false, message: 'Body tidak valid' });
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const hasPassword = password.length > 0;
  const name = String(body.name || '').trim();
  const role = body.role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
  const isActive = body.isActive !== false;
  const sub = computeSubscriptionEnd(body.subscriptionDays);

  if (!email) return json(res, 400, { success: false, message: 'Email tidak valid' });
  if (hasPassword && password.length < 6) return json(res, 400, { success: false, message: 'Password minimal 6 karakter' });

  let uid;
  let action = 'created';
  try {
    const createPassword = hasPassword ? password : crypto.randomBytes(18).toString('hex');
    const userRecord = await admin.auth().createUser({
      email,
      password: createPassword,
      displayName: name || undefined,
      disabled: !isActive
    });
    uid = userRecord.uid;
  } catch (e) {
    const code = e && e.code ? String(e.code) : '';
    if (code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(email);
      uid = existing.uid;
      action = 'updated';
      const updatePayload = {
        displayName: name || existing.displayName || undefined,
        disabled: !isActive
      };
      if (hasPassword) updatePayload.password = password;
      await admin.auth().updateUser(uid, updatePayload);
    } else {
      return json(res, 500, { success: false, message: 'Gagal membuat user' });
    }
  }

  const userDoc = admin.firestore().doc(`texa_users/${uid}`);
  const nowIso = new Date().toISOString();
  const userData = {
    email,
    name: name || email,
    role,
    subscriptionEnd: sub ? sub.end.toISOString() : null,
    isActive,
    updatedAt: nowIso
  };

  if (action === 'created') {
    await userDoc.set(
      {
        ...userData,
        createdAt: nowIso,
        lastLogin: null
      },
      { merge: true }
    );
  } else {
    await userDoc.set(userData, { merge: true });
  }

  if (sub) {
    await admin.firestore().collection('texa_transactions').add({
      userId: uid,
      userEmail: email,
      planName: 'Manual',
      startDate: sub.start.toISOString(),
      endDate: sub.end.toISOString(),
      price: 0,
      status: 'active',
      createdAt: nowIso
    });
  }

  return json(res, 200, { success: true, uid, action });
};

