// Vercel Serverless API - TokoPay Webhook Handler
// POST /api/tokopay/webhook

import type { VercelRequest, VercelResponse } from '@vercel/node';
import CryptoJS from 'crypto-js';

// TokoPay Config
const TOKOPAY_CONFIG = {
    merchantId: process.env.TOKOPAY_MERCHANT_ID || 'M250828KEAYY483',
    secretKey: process.env.TOKOPAY_SECRET_KEY || 'b3bb79b23b82ed33a54927dbaac95d8a70e19de7f5d47a613d1db4d32776125c',
    webhookIp: '178.128.104.179'
};

// Firebase Admin SDK for server-side operations
// Note: You need to set FIREBASE_SERVICE_ACCOUNT env var with the service account JSON

interface TokopayWebhookPayload {
    data: {
        created_at: string;
        updated_at: string;
        customer_email: string;
        customer_name: string;
        customer_phone: string;
        merchant_id: string;
        payment_channel: string;
        total_dibayar: number;
        total_diterima: number;
    };
    reference: string;      // TokoPay transaction ID (e.g., TP231005NPNX005088)
    reff_id: string;        // Our order reference ID (e.g., SUB1234567ABC)
    signature: string;      // MD5 hash for verification
    status: 'Success' | 'Completed';
}

// Verify signature from TokoPay
function verifySignature(merchantId: string, refId: string, receivedSignature: string): boolean {
    const signatureString = `${merchantId}:${TOKOPAY_CONFIG.secretKey}:${refId}`;
    const expectedSignature = CryptoJS.MD5(signatureString).toString();
    return expectedSignature.toLowerCase() === receivedSignature.toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ status: false, error: 'Method not allowed' });
    }

    try {
        const payload = req.body as TokopayWebhookPayload;

        console.log('TokoPay Webhook Received:', JSON.stringify(payload, null, 2));

        // Validate required fields
        if (!payload.reff_id || !payload.signature || !payload.status) {
            console.error('Missing required webhook fields');
            return res.status(400).json({ status: false, error: 'Invalid payload' });
        }

        // Verify signature
        const isValidSignature = verifySignature(
            payload.data.merchant_id || TOKOPAY_CONFIG.merchantId,
            payload.reff_id,
            payload.signature
        );

        if (!isValidSignature) {
            console.error('Invalid signature received:', payload.signature);
            return res.status(401).json({ status: false, error: 'Invalid signature' });
        }

        // Check if payment is successful
        if (payload.status !== 'Success' && payload.status !== 'Completed') {
            console.log('Payment not successful:', payload.status);
            return res.status(200).json({ status: true });
        }

        // Process successful payment
        console.log('Processing successful payment for ref_id:', payload.reff_id);

        // Parse reference ID to determine type
        const refId = payload.reff_id;
        const isSubscription = refId.startsWith('SUB');
        const isIndividual = refId.startsWith('TXA');

        // TODO: Update order status in Firebase
        // TODO: Activate subscription or tool access for user
        // 
        // This requires Firebase Admin SDK initialization with service account
        // For now, we'll just log the successful payment
        //
        // Example implementation:
        // 1. Get order from Firestore using refId
        // 2. Update order status to 'paid'
        // 3. If subscription: update user's subscription expiry date
        // 4. If individual tool: add tool access to user's account

        console.log('Payment Success:', {
            refId: payload.reff_id,
            tokopayRef: payload.reference,
            amount: payload.data.total_dibayar,
            received: payload.data.total_diterima,
            channel: payload.data.payment_channel,
            customerEmail: payload.data.customer_email,
            type: isSubscription ? 'subscription' : isIndividual ? 'individual' : 'unknown'
        });

        // Return success to TokoPay (REQUIRED)
        return res.status(200).json({ status: true });

    } catch (error: any) {
        console.error('Webhook processing error:', error);
        // Still return success to prevent retry spam
        return res.status(200).json({ status: true });
    }
}
