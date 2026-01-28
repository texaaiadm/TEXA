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

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAILS = new Set([
  'teknoaiglobal.adm@gmail.com'
]);

let adminReady = false;
let adminInitError = '';

// Check Supabase configuration
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  adminReady = true;
  console.log('✅ Supabase configured successfully');
  console.log(`   URL: ${SUPABASE_URL}`);
  if (SUPABASE_SERVICE_ROLE_KEY) {
    console.log('   Service Role Key: configured');
  } else {
    console.log('   ⚠️  Service Role Key: NOT configured (some features limited)');
  }
} else {
  adminInitError = 'Missing SUPABASE_URL or SUPABASE_ANON_KEY';
  console.error('❌ Supabase not configured:', adminInitError);
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

// Fetch wrapper for Supabase API calls
const supabaseFetch = async (endpoint, options = {}) => {
  const url = `${SUPABASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY}`,
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
};

// Verify JWT token from Supabase
const verifySupabaseToken = async (token) => {
  try {
    const response = await supabaseFetch('/auth/v1/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) return null;

    const user = await response.json();
    return user;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
};

const requireAdmin = async (req) => {
  if (!adminReady) return { ok: false, status: 500, message: 'Admin server belum dikonfigurasi' };

  const token = getBearerToken(req);
  if (!token) return { ok: false, status: 401, message: 'Unauthorized' };

  const user = await verifySupabaseToken(token);
  if (!user || !user.email) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const email = user.email.toLowerCase();
  if (ADMIN_EMAILS.has(email)) return { ok: true, uid: user.id, email };

  // Also check user metadata for admin role
  const role = user.user_metadata?.role || user.app_metadata?.role;
  if (role === 'ADMIN') return { ok: true, uid: user.id, email };

  return { ok: false, status: 403, message: 'Forbidden' };
};

// For development mode - allow bypass
const requireAdminOrDev = async (req) => {
  // Check if in dev mode
  const isDev = process.env.NODE_ENV !== 'production';
  const devBypass = req.headers['x-dev-bypass'] === 'true';

  if (isDev && devBypass) {
    return { ok: true, uid: 'dev-mode', email: 'dev@localhost' };
  }

  return requireAdmin(req);
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

// Create user using Supabase Admin API
const handleCreateUser = async (req, res) => {
  const guard = await requireAdminOrDev(req);
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

  try {
    // Create user via Supabase Auth Admin API
    const createPassword = hasPassword ? password : crypto.randomBytes(18).toString('hex');

    const createResponse = await supabaseFetch('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: createPassword,
        email_confirm: true,
        user_metadata: {
          name: name || email,
          role
        }
      })
    });

    let uid;
    let action = 'created';

    if (createResponse.ok) {
      const userData = await createResponse.json();
      uid = userData.id;
    } else {
      const errorData = await createResponse.json();
      if (errorData.msg?.includes('already been registered') || errorData.code === 'email_exists') {
        // User exists, try to update
        action = 'updated';
        // First get the user
        const listResponse = await supabaseFetch(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
        if (!listResponse.ok) {
          return json(res, 500, { success: false, message: 'Gagal mengambil data user' });
        }
        const users = await listResponse.json();
        const existingUser = users.users?.find(u => u.email.toLowerCase() === email);
        if (!existingUser) {
          return json(res, 404, { success: false, message: 'User tidak ditemukan' });
        }
        uid = existingUser.id;

        // Update user
        const updatePayload = {
          user_metadata: {
            name: name || existingUser.user_metadata?.name || email,
            role
          }
        };
        if (hasPassword) updatePayload.password = password;

        await supabaseFetch(`/auth/v1/admin/users/${uid}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload)
        });
      } else {
        console.error('Create user error:', errorData);
        return json(res, 500, { success: false, message: errorData.msg || 'Gagal membuat user' });
      }
    }

    // Update texa_users table
    const nowIso = new Date().toISOString();
    const userTableData = {
      id: uid,
      email,
      name: name || email,
      role,
      subscription_end: sub ? sub.end.toISOString() : null,
      is_active: isActive,
      updated_at: nowIso
    };

    if (action === 'created') {
      userTableData.created_at = nowIso;
    }

    const upsertResponse = await supabaseFetch('/rest/v1/texa_users', {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(userTableData)
    });

    if (!upsertResponse.ok) {
      console.error('Upsert user table error:', await upsertResponse.text());
    }

    // Record transaction if subscription
    if (sub) {
      await supabaseFetch('/rest/v1/texa_transactions', {
        method: 'POST',
        body: JSON.stringify({
          user_id: uid,
          user_email: email,
          plan_name: 'Manual',
          start_date: sub.start.toISOString(),
          end_date: sub.end.toISOString(),
          price: 0,
          status: 'active',
          created_at: nowIso
        })
      });
    }

    return json(res, 200, { success: true, uid, action });
  } catch (error) {
    console.error('Create user error:', error);
    return json(res, 500, { success: false, message: 'Gagal membuat user' });
  }
};

const handleSetPassword = async (req, res) => {
  const guard = await requireAdminOrDev(req);
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
      // Get user by email
      const listResponse = await supabaseFetch(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
      if (!listResponse.ok) {
        return json(res, 500, { success: false, message: 'Gagal mengambil data user' });
      }
      const users = await listResponse.json();
      const existingUser = users.users?.find(u => u.email.toLowerCase() === email);
      if (!existingUser) {
        return json(res, 404, { success: false, message: 'User tidak ditemukan' });
      }
      targetUid = existingUser.id;
    }

    // Update password
    const updateResponse = await supabaseFetch(`/auth/v1/admin/users/${targetUid}`, {
      method: 'PUT',
      body: JSON.stringify({ password })
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      return json(res, 500, { success: false, message: errorData.msg || 'Gagal mengubah password' });
    }

    return json(res, 200, { success: true });
  } catch (error) {
    console.error('Set password error:', error);
    return json(res, 500, { success: false, message: 'Gagal mengubah password' });
  }
};

// Test database connection
const handleTestConnection = async (req, res) => {
  try {
    const response = await supabaseFetch('/rest/v1/', {
      method: 'GET'
    });

    if (response.ok) {
      return json(res, 200, {
        success: true,
        message: 'Koneksi database berhasil',
        supabaseUrl: SUPABASE_URL
      });
    } else {
      return json(res, 500, {
        success: false,
        message: 'Gagal terhubung ke database'
      });
    }
  } catch (error) {
    return json(res, 500, {
      success: false,
      message: `Error: ${error.message}`
    });
  }
};

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('vary', 'origin');
  }
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type,authorization,x-dev-bypass');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url || '/', 'http://localhost');

  // Health check
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, {
      ok: true,
      adminReady,
      adminInitError: adminReady ? undefined : adminInitError,
      backend: 'supabase'
    });
  }

  // Test connection
  if (req.method === 'GET' && url.pathname === '/test-connection') {
    return await handleTestConnection(req, res);
  }

  try {
    if (req.method === 'POST' && (url.pathname === '/admin/create-user' || url.pathname === '/api/admin/create-user')) {
      return await handleCreateUser(req, res);
    }
    if (req.method === 'POST' && (url.pathname === '/admin/set-password' || url.pathname === '/api/admin/set-password')) {
      return await handleSetPassword(req, res);
    }
  } catch (error) {
    console.error('Server error:', error);
    return json(res, 500, { success: false, message: 'Server error' });
  }

  return json(res, 404, { success: false, message: 'Not found' });
});

const port = Number(process.env.ADMIN_PORT || 8787);
const host = process.env.ADMIN_HOST || '127.0.0.1';

server.listen(port, host, () => {
  console.log(`\n🚀 Admin Server running at http://${host}:${port}`);
  console.log(`   Backend: Supabase`);
  console.log(`   Health: http://${host}:${port}/health`);
  console.log(`   Test DB: http://${host}:${port}/test-connection\n`);
});
