const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const loadEnvFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
  }
};

loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

const admin = require('firebase-admin');

const ADMIN_EMAILS = new Set([
  'teknoaiglobal.adm@gmail.com'
]);

const getAdminCredential = () => {
  const sa = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (sa) return admin.credential.cert(JSON.parse(sa));
  if (saPath) return admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8')));
  throw new Error('Missing FIREBASE_ADMIN_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS');
};

let adminReady = false;
let adminInitError = '';
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: getAdminCredential()
    });
    adminReady = true;
  } catch (e) {
    adminReady = false;
    adminInitError = e && e.message ? String(e.message) : 'Admin credential error';
  }
}

const json = (res, statusCode, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization'
  });
  res.end(payload);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const requireAdmin = async (req) => {
  if (!adminReady) return { ok: false, status: 500, message: 'Admin server belum dikonfigurasi' };
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
  return { ok: false, status: 403, message: 'Forbidden' };
};

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const computeSubscriptionEnd = (days) => {
  const durationDays = Number(days);
  if (!Number.isFinite(durationDays) || durationDays <= 0) return null;
  const start = new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + durationDays);
  return { start, end, durationDays };
};

const handleCreateUser = async (req, res) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return json(res, guard.status, { success: false, message: guard.message });

  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const hasPassword = password.length > 0;
  const name = String(body.name || '').trim();
  const role = body.role === 'ADMIN' && ADMIN_EMAILS.has(email) ? 'ADMIN' : 'MEMBER';
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
    await userDoc.set({
      ...userData,
      createdAt: nowIso,
      lastLogin: null
    }, { merge: true });
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

const handleSetPassword = async (req, res) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return json(res, guard.status, { success: false, message: guard.message });

  const body = await readBody(req);
  const password = String(body.password || '');
  const email = body.email ? normalizeEmail(body.email) : null;
  const uid = body.uid ? String(body.uid) : null;

  if (password.length < 6) return json(res, 400, { success: false, message: 'Password minimal 6 karakter' });
  if (!email && !uid) return json(res, 400, { success: false, message: 'Target tidak valid' });

  try {
    let targetUid = uid;
    if (!targetUid && email) {
      const existing = await admin.auth().getUserByEmail(email);
      targetUid = existing.uid;
    }
    await admin.auth().updateUser(targetUid, { password });
    return json(res, 200, { success: true });
  } catch {
    return json(res, 500, { success: false, message: 'Gagal mengubah password' });
  }
};

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('vary', 'origin');
  }
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, adminReady, adminInitError: adminReady ? undefined : adminInitError });
  }

  try {
    if (req.method === 'POST' && (url.pathname === '/admin/create-user' || url.pathname === '/api/admin/create-user')) {
      return await handleCreateUser(req, res);
    }
    if (req.method === 'POST' && (url.pathname === '/admin/set-password' || url.pathname === '/api/admin/set-password')) {
      return await handleSetPassword(req, res);
    }
    
    // Serve API endpoints for local development
    if (url.pathname === '/api/catalog') {
      return await require('../api/catalog/index.cjs')(req, res);
    }
    if (url.pathname === '/api/tools/get-injection-data') {
      return await require('../api/tools/get-injection-data.cjs')(req, res);
    }
  } catch (error) {
    console.error('Server error:', error);
    return json(res, 500, { success: false, message: 'Server error' });
  }

  return json(res, 404, { success: false, message: 'Not found' });
});

const port = Number(process.env.ADMIN_PORT || 8787);
const host = process.env.ADMIN_HOST || '127.0.0.1';
server.listen(port, host);
