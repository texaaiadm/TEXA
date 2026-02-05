// Vercel Serverless API - Create TokoPay Order
// POST /api/tokopay/create-order

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

// Fetch TokoPay config from database with fallback to env vars
async function getTokopayConfig() {
    if (supabase) {
        try {
            const { data } = await supabase
                .from('payment_gateways')
                .select('config')
                .eq('type', 'tokopay')
                .eq('is_active', true)
                .single();

            if (data && data.config) {
                return {
                    merchantId: data.config.merchantId,
                    secretKey: data.config.secretKey,
                    apiBaseUrl: 'https://api.tokopay.id/v1'
                };
            }
        } catch (error) {
            console.log('Using fallback TokoPay config from environment variables');
        }
    }

    // Fallback to environment variables
    return {
        merchantId: process.env.TOKOPAY_MERCHANT_ID || 'M250828KEAYY483',
        secretKey: process.env.TOKOPAY_SECRET_KEY || 'b3bb79b23b82ed33a54927dbaac95d8a70e19de7f5d47a613d1db4d32776125c',
        apiBaseUrl: 'https://api.tokopay.id/v1'
    };
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { refId, nominal, metode, userId, userEmail, type, itemId, itemName, duration, includedToolIds } = req.body;

        // Validate required fields
        if (!refId || !nominal || !metode) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: refId, nominal, metode'
            });
        }

        // Get TokoPay config from database or fallback to env vars
        const tokopayConfig = await getTokopayConfig();

        // Build TokoPay API URL
        const params = new URLSearchParams({
            merchant: tokopayConfig.merchantId,
            secret: tokopayConfig.secretKey,
            ref_id: refId,
            nominal: nominal.toString(),
            metode: metode
        });

        const apiUrl = `${tokopayConfig.apiBaseUrl}/order?${params.toString()}`;

        // Call TokoPay API
        const tokopayResponse = await fetch(apiUrl);
        const tokopayResult = await tokopayResponse.json();

        if (tokopayResult.status === 'Success') {
            if (supabase && userId && userEmail) {
                try {
                    const now = new Date().toISOString();
                    const insertData: any = {
                        ref_id: refId,
                        user_id: userId,
                        user_email: userEmail,
                        type: type || 'subscription',
                        item_id: itemId || '',
                        item_name: itemName || '',
                        duration: Number.isFinite(Number(duration)) ? Number(duration) : 0,
                        nominal,
                        payment_method: metode,
                        status: 'pending',
                        tokopay_trx_id: tokopayResult.data.trx_id,
                        pay_url: tokopayResult.data.pay_url,
                        total_bayar: tokopayResult.data.total_bayar,
                        total_diterima: tokopayResult.data.total_diterima,
                        included_tool_ids: includedToolIds || [],
                        created_at: now,
                        updated_at: now
                    };
                    const { error } = await supabase.from('orders').insert(insertData);
                    if (error) {
                        console.error('Error saving order to Supabase:', error);
                    }
                } catch (e) {
                    console.error('Supabase order insert error:', e);
                }
            }

            return res.status(200).json({
                success: true,
                data: {
                    refId: refId,
                    payUrl: tokopayResult.data.pay_url,
                    trxId: tokopayResult.data.trx_id,
                    totalBayar: tokopayResult.data.total_bayar,
                    totalDiterima: tokopayResult.data.total_diterima,
                    qrLink: tokopayResult.data.qr_link || null,
                    qrString: tokopayResult.data.qr_string || null,
                    nomorVa: tokopayResult.data.nomor_va || null,
                    checkoutUrl: tokopayResult.data.checkout_url || null
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                error: tokopayResult.message || 'Failed to create order',
                details: tokopayResult
            });
        }

    } catch (error: any) {
        console.error('TokoPay Create Order Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
}
