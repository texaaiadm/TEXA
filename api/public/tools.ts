import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

/**
 * Public API endpoint for fetching active tools
 * Used by CheckoutPopup to display included tools in subscription packages
 * No authentication required - returns only active tools with limited fields
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

    // Check if database is configured
    if (!supabase) {
        console.error('Database not configured');
        return res.status(500).json({
            success: false,
            message: 'Database not configured'
        });
    }

    try {
        // Fetch only active tools with limited fields for public access
        const { data, error } = await supabase
            .from('tools')
            .select('id, name, category, image_url, is_active')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Get public tools error:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch tools' });
        }

        return res.status(200).json({ success: true, data: data || [] });
    } catch (e) {
        console.error('Get public tools error:', e);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}
