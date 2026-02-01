// Vercel Serverless API - Payment Gateway by ID
// GET/PUT/DELETE /api/admin/payment-gateways/[id]

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
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

    // Get ID from query or path
    const id = req.query.id as string;
    if (!id) {
        return res.status(400).json({ success: false, error: 'Gateway ID required' });
    }

    try {
        if (req.method === 'GET') {
            // Get specific payment gateway
            const { data, error } = await supabase
                .from('payment_gateways')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching gateway:', error);
                return res.status(404).json({ success: false, error: 'Gateway not found' });
            }

            return res.status(200).json({ success: true, data });
        }

        if (req.method === 'PUT') {
            // Update payment gateway
            const { name, type, is_active, is_default, config } = req.body;

            const updates: any = { updated_at: new Date().toISOString() };
            if (name !== undefined) updates.name = name;
            if (type !== undefined) updates.type = type;
            if (is_active !== undefined) updates.is_active = is_active;
            if (is_default !== undefined) updates.is_default = is_default;
            if (config !== undefined) updates.config = config;

            // If setting as default, unset others
            if (is_default) {
                await supabase
                    .from('payment_gateways')
                    .update({ is_default: false })
                    .eq('is_default', true)
                    .neq('id', id);
            }

            const { data, error } = await supabase
                .from('payment_gateways')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating gateway:', error);
                return res.status(500).json({ success: false, error: error.message });
            }

            return res.status(200).json({ success: true, data });
        }

        if (req.method === 'DELETE') {
            // Delete payment gateway
            const { error } = await supabase
                .from('payment_gateways')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting gateway:', error);
                return res.status(500).json({ success: false, error: error.message });
            }

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });
    } catch (error: any) {
        console.error('API error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
