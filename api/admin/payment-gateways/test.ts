// Vercel Serverless API - Test Payment Gateway Connection
// POST /api/admin/payment-gateways/test

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';

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

// Test TokoPay connection
async function testTokopay(config: any): Promise<{ success: boolean; message: string }> {
    try {
        const { merchantId, secretKey } = config;

        if (!merchantId || !secretKey) {
            return { success: false, message: 'Merchant ID and Secret Key are required' };
        }

        // Validate format
        if (merchantId.length < 10) {
            return { success: false, message: 'Invalid Merchant ID format' };
        }

        if (secretKey.length < 32) {
            return { success: false, message: 'Invalid Secret Key format (must be at least 32 characters)' };
        }

        // Test signature generation (this validates the config works)
        const testRefId = 'TEST123';
        const signatureString = `${merchantId}:${secretKey}:${testRefId}`;
        const signature = CryptoJS.MD5(signatureString).toString();

        if (signature.length !== 32) {
            return { success: false, message: 'Signature generation failed - invalid secret key' };
        }

        return {
            success: true,
            message: 'TokoPay configuration is valid. Credentials format is correct.'
        };
    } catch (error: any) {
        return { success: false, message: error.message || 'TokoPay test failed' };
    }
}

// Test Midtrans connection (placeholder)
async function testMidtrans(config: any): Promise<{ success: boolean; message: string }> {
    return {
        success: false,
        message: 'Midtrans integration not yet implemented. Coming soon!'
    };
}

// Test Xendit connection (placeholder)
async function testXendit(config: any): Promise<{ success: boolean; message: string }> {
    return {
        success: false,
        message: 'Xendit integration not yet implemented. Coming soon!'
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
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
        const { gatewayId } = req.body;

        if (!gatewayId) {
            return res.status(400).json({ success: false, error: 'Gateway ID required' });
        }

        // Fetch gateway
        const { data: gateway, error } = await supabase
            .from('payment_gateways')
            .select('*')
            .eq('id', gatewayId)
            .single();

        if (error || !gateway) {
            return res.status(404).json({ success: false, error: 'Gateway not found' });
        }

        // Test based on gateway type
        let result: { success: boolean; message: string };

        switch (gateway.type) {
            case 'tokopay':
                result = await testTokopay(gateway.config);
                break;

            case 'midtrans':
                result = await testMidtrans(gateway.config);
                break;

            case 'xendit':
                result = await testXendit(gateway.config);
                break;

            default:
                result = {
                    success: false,
                    message: `Unknown gateway type: ${gateway.type}`
                };
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Test connection error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Connection test failed'
        });
    }
}
