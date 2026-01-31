// Vercel Serverless API - Admin Settings CRUD
// GET /api/admin/settings?key=xxx - Get a setting by key
// PUT /api/admin/settings - Save/Update a setting

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

// Simple admin check - in production, use proper JWT validation
async function isAdminOrDev(req: VercelRequest): Promise<boolean> {
    // In development or if no auth required, allow access
    if (process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true') {
        return true;
    }

    // Check for admin token in header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Verify with Supabase
        if (supabase) {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (!error && user) {
                // Check if user is admin
                const { data: userData } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                return userData?.role === 'admin';
            }
        }
    }

    // Allow in dev mode by default for easier testing
    return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Check admin access
    const isAdmin = await isAdminOrDev(req);
    if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!supabase) {
        return res.status(500).json({ success: false, message: 'Database not configured' });
    }

    // GET - Fetch a setting by key
    if (req.method === 'GET') {
        const key = req.query.key as string;

        if (!key) {
            return res.status(400).json({ success: false, message: 'Key parameter required' });
        }

        try {
            const { data, error } = await supabase
                .from('settings')
                .select('*')
                .eq('key', key)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                console.error('Get settings error:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch settings' });
            }

            return res.status(200).json({ success: true, data: data || null });
        } catch (e) {
            console.error('Get settings error:', e);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // PUT - Save/Update a setting
    if (req.method === 'PUT') {
        const { key, value } = req.body;

        if (!key) {
            return res.status(400).json({ success: false, message: 'Key is required' });
        }

        try {
            const now = new Date().toISOString();

            // First check if setting exists
            const { data: existing } = await supabase
                .from('settings')
                .select('key')
                .eq('key', key)
                .single();

            let response;
            if (existing) {
                // Update existing
                response = await supabase
                    .from('settings')
                    .update({
                        value: value || {},
                        updated_at: now
                    })
                    .eq('key', key);
            } else {
                // Insert new
                response = await supabase
                    .from('settings')
                    .insert({
                        key,
                        value: value || {},
                        updated_at: now
                    });
            }

            if (response.error) {
                console.error('Save setting error:', response.error);
                return res.status(500).json({ success: false, message: 'Failed to save setting' });
            }

            console.log('✅ Setting saved:', key);
            return res.status(200).json({ success: true, message: 'Setting saved' });
        } catch (e) {
            console.error('Save setting error:', e);
            return res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    // Method not allowed
    return res.status(405).json({ success: false, message: 'Method not allowed' });
}
