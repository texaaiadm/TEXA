import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Log env var availability for debugging
console.log('[api/catalog] ENV check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseServiceKey,
    urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
    envKeys: Object.keys(process.env).filter(k => k.includes('SUPA') || k.includes('VITE')).join(', ') || 'NONE'
});

const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

/**
 * Public API endpoint for fetching the tool catalog
 * Used by extension popup and frontend to display all available tools
 * Returns full tool details with proper field mapping
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
        // Fetch all active tools with full details
        const { data, error } = await supabase
            .from('tools')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Get catalog error:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch catalog' });
        }

        // Map database fields to frontend expected format
        const tools = (data || []).map(tool => ({
            id: tool.id,
            name: tool.name,
            description: tool.description || '',
            category: tool.category || '',
            imageUrl: tool.image_url || '',
            targetUrl: tool.tool_url || '',  // Map tool_url to targetUrl
            apiUrl: tool.api_url || '',
            cookiesData: tool.cookies_data || null,
            status: tool.is_active ? 'active' : 'inactive',
            priceMonthly: tool.price_monthly || 0,
            price7Days: tool.price_7_days || tool.price_monthly || 0,
            price14Days: tool.price_14_days || 0,
            price30Days: tool.price_30_days || 0,
            order: tool.sort_order || 0
        }));

        console.log('[catalog] Returning', tools.length, 'tools');
        return res.status(200).json(tools);
    } catch (e) {
        console.error('Get catalog error:', e);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
}
