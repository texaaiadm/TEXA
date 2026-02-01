// Vercel Serverless API - Payment Gateways Admin
// GET/POST /api/admin/payment-gateways

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Verify admin access
async function isAdmin(authHeader: string | undefined): Promise<boolean> {
    if (!supabase || !authHeader) return false;

    try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) return false;

        const { data: userData } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        return userData?.is_admin === true;
    } catch {
        return false;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Verify admin
    const admin = await isAdmin(req.headers.authorization);
    if (!admin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    if (!supabase) {
        return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    try {
        if (req.method === 'GET') {
            // Get all payment gateways
            const { data, error } = await supabase
                .from('payment_gateways')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching gateways:', error);
                return res.status(500).json({ success: false, error: error.message });
            }

            return res.status(200).json({ success: true, data });
        }

        if (req.method === 'POST') {
            // Create new payment gateway
            const { name, type, is_active, is_default, config } = req.body;

            // Validation
            if (!name || !type || !config) {
                return res.status(400).json({
                    success: false,
                    error: 'Name, type, and config are required'
                });
            }

            // If setting as default, unset others
            if (is_default) {
                await supabase
                    .from('payment_gateways')
                    .update({ is_default: false })
                    .eq('is_default', true);
            }

            const { data, error } = await supabase
                .from('payment_gateways')
                .insert([{
                    name,
                    type,
                    is_active: is_active ?? false,
                    is_default: is_default ?? false,
                    config
                }])
                .select()
                .single();

            if (error) {
                console.error('Error creating gateway:', error);
                return res.status(500).json({ success: false, error: error.message });
            }

            return res.status(201).json({ success: true, data });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });
    } catch (error: any) {
        console.error('API error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
