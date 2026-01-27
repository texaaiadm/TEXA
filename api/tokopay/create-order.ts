// Vercel Serverless API - Create TokoPay Order
// POST /api/tokopay/create-order

import type { VercelRequest, VercelResponse } from '@vercel/node';
import CryptoJS from 'crypto-js';

// TokoPay Config
const TOKOPAY_CONFIG = {
    merchantId: process.env.TOKOPAY_MERCHANT_ID || 'M250828KEAYY483',
    secretKey: process.env.TOKOPAY_SECRET_KEY || 'b3bb79b23b82ed33a54927dbaac95d8a70e19de7f5d47a613d1db4d32776125c',
    apiBaseUrl: 'https://api.tokopay.id/v1'
};

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
        const { refId, nominal, metode, userId, userEmail, type, itemId, itemName, duration } = req.body;

        // Validate required fields
        if (!refId || !nominal || !metode) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: refId, nominal, metode'
            });
        }

        // Build TokoPay API URL
        const params = new URLSearchParams({
            merchant: TOKOPAY_CONFIG.merchantId,
            secret: TOKOPAY_CONFIG.secretKey,
            ref_id: refId,
            nominal: nominal.toString(),
            metode: metode
        });

        const apiUrl = `${TOKOPAY_CONFIG.apiBaseUrl}/order?${params.toString()}`;

        // Call TokoPay API
        const tokopayResponse = await fetch(apiUrl);
        const tokopayResult = await tokopayResponse.json();

        if (tokopayResult.status === 'Success') {
            // Return success response with payment details
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
