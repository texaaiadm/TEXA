import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

/**
 * Public API endpoint for fetching user's tool accesses
 * Used by frontend to check which tools the user has access to
 * Uses service role key to bypass RLS policies
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    // Get userId from query parameter
    const userId = req.query.userId as string;
    if (!userId) {
        return res.status(400).json({ success: false, message: 'userId parameter required' });
    }

    // Check if database is configured
    if (!supabase) {
        console.error('Database not configured');
        return res.status(500).json({
            success: false,
            message: 'Database not configured'
        });
    }

    try {
        const now = new Date().toISOString();

        // Fetch active tool accesses for the user using service role key
        const { data, error } = await supabase
            .from('user_tools')
            .select('*')
            .eq('user_id', userId)
            .gt('access_end', now);

        if (error) {
            console.error('Get user tools error:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch user tools' });
        }

        console.log('[user-tools] Found', data?.length || 0, 'active tools for user:', userId);
        return res.status(200).json({ success: true, data: data || [] });
    } catch (e) {
        console.error('Get user tools error:', e);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}
