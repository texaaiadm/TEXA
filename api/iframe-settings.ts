// Vercel Serverless API - Public Iframe Settings
// GET /api/iframe-settings - Get iframe allowed hosts (public, no auth)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    if (!supabase) {
        // Return empty if DB not configured — client will use env var / defaults
        return res.status(200).json({ success: true, hosts: [] });
    }

    try {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'iframe_allowed_hosts')
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('[iframe-settings] DB error:', error);
            return res.status(200).json({ success: true, hosts: [] });
        }

        const hosts: string[] = data?.value?.hosts || [];
        return res.status(200).json({ success: true, hosts });
    } catch (e) {
        console.error('[iframe-settings] Error:', e);
        return res.status(200).json({ success: true, hosts: [] });
    }
}
