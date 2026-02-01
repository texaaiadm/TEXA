// Vercel Serverless API - TokoPay Webhook Handler
// POST /api/tokopay/webhook

import type { VercelRequest, VercelResponse } from '@vercel/node';
import CryptoJS from 'crypto-js';
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
                    webhookIp: data.config.webhookIp || '178.128.104.179'
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
        webhookIp: '178.128.104.179'
    };
}


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
function verifySignature(merchantId: string, refId: string, receivedSignature: string, secretKey: string): boolean {
    const signatureString = `${merchantId}:${secretKey}:${refId}`;
    const expectedSignature = CryptoJS.MD5(signatureString).toString();
    return expectedSignature.toLowerCase() === receivedSignature.toLowerCase();
}

// Activate subscription for user
async function activateSubscription(userId: string, durationDays: number): Promise<boolean> {
    if (!supabase) return false;

    try {
        // Get current user's subscription_end
        const { data: user } = await supabase
            .from('users')
            .select('subscription_end')
            .eq('id', userId)
            .single();

        // Calculate new subscription end
        let baseDate = new Date();
        if (user?.subscription_end) {
            const currentEnd = new Date(user.subscription_end);
            // If subscription is still active, extend from current end
            if (currentEnd > baseDate) {
                baseDate = currentEnd;
            }
        }

        // Add duration days
        const newSubscriptionEnd = new Date(baseDate);
        newSubscriptionEnd.setDate(newSubscriptionEnd.getDate() + durationDays);

        // Update user's subscription_end
        const { error } = await supabase
            .from('users')
            .update({
                subscription_end: newSubscriptionEnd.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            console.error('Error activating subscription:', error);
            return false;
        }

        console.log(`✅ Subscription activated for user ${userId} until ${newSubscriptionEnd.toISOString()}`);
        return true;
    } catch (e) {
        console.error('Subscription activation error:', e);
        return false;
    }
}

// Activate individual tool access for user
async function activateIndividualTool(userId: string, toolId: string, durationDays: number, orderRefId: string): Promise<boolean> {
    if (!supabase) return false;

    try {
        // Calculate access end date
        const accessEnd = new Date();
        accessEnd.setDate(accessEnd.getDate() + durationDays);

        // Check if user_tools table exists by trying to query it
        // If it fails, we'll create the entry anyway (table should exist)

        // Insert or update user_tools entry
        const { error } = await supabase
            .from('user_tools')
            .upsert({
                user_id: userId,
                tool_id: toolId,
                access_end: accessEnd.toISOString(),
                order_ref_id: orderRefId,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,tool_id',
                ignoreDuplicates: false
            });

        if (error) {
            // If table doesn't exist, log but don't fail
            console.error('Error activating individual tool (table may not exist):', error);
            return false;
        }

        console.log(`✅ Individual tool ${toolId} activated for user ${userId} until ${accessEnd.toISOString()}`);
        return true;
    } catch (e) {
        console.error('Individual tool activation error:', e);
        return false;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Allow GET for connection test from TokoPay dashboard
    if (req.method === 'GET') {
        return res.status(200).json({
            status: true,
            message: 'TokoPay webhook endpoint is active',
            timestamp: new Date().toISOString()
        });
    }

    // Only allow POST for actual webhooks
    if (req.method !== 'POST') {
        return res.status(405).json({ status: false, error: 'Method not allowed' });
    }

    try {
        const payload = req.body as TokopayWebhookPayload;

        console.log('TokoPay Webhook Received:', JSON.stringify(payload, null, 2));

        // Handle empty or test payloads gracefully
        if (!payload || Object.keys(payload).length === 0) {
            return res.status(200).json({ status: true, message: 'Webhook endpoint ready' });
        }

        // Validate required fields for actual payment callbacks
        if (!payload.reff_id || !payload.signature || !payload.status) {
            console.log('Missing required webhook fields (possibly a test ping)');
            return res.status(200).json({ status: true, message: 'Connection test successful' });
        }

        // Get TokoPay config for signature verification
        const tokopayConfig = await getTokopayConfig();

        // Verify signature
        const isValidSignature = verifySignature(
            payload.data.merchant_id || tokopayConfig.merchantId,
            payload.reff_id,
            payload.signature,
            tokopayConfig.secretKey
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

        console.log('Processing successful payment for ref_id:', payload.reff_id);

        // Parse reference ID to determine type
        const refId = payload.reff_id;
        const isSubscription = refId.startsWith('SUB');
        const isIndividual = refId.startsWith('TXA');

        if (supabase) {
            try {
                const now = new Date().toISOString();

                // First, get the order details to know user_id and duration
                const { data: order, error: orderFetchError } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('ref_id', refId)
                    .single();

                if (orderFetchError || !order) {
                    console.error('Error fetching order:', orderFetchError);
                } else {
                    // Update order status to paid
                    const updateData: any = {
                        status: 'paid',
                        tokopay_trx_id: payload.reference,
                        total_bayar: payload.data.total_dibayar,
                        total_diterima: payload.data.total_diterima,
                        payment_method: payload.data.payment_channel,
                        updated_at: now,
                        paid_at: now
                    };

                    const { error: updateError } = await supabase
                        .from('orders')
                        .update(updateData)
                        .eq('ref_id', refId);

                    if (updateError) {
                        console.error('Error updating order in Supabase:', updateError);
                    }

                    // ==========================================
                    // ACTIVATE SUBSCRIPTION OR INDIVIDUAL TOOL
                    // ==========================================

                    const userId = order.user_id;
                    const duration = order.duration || 30; // Default 30 days
                    const itemId = order.item_id;

                    if (isSubscription && userId) {
                        // Activate subscription - update user's subscription_end
                        await activateSubscription(userId, duration);
                        console.log(`📦 Subscription activated: ${duration} days for user ${userId}`);
                    } else if (isIndividual && userId && itemId) {
                        // Activate individual tool access
                        await activateIndividualTool(userId, itemId, duration, refId);
                        console.log(`🔧 Individual tool ${itemId} activated: ${duration} days for user ${userId}`);
                    }
                }
            } catch (e) {
                console.error('Supabase order update error:', e);
            }
        }

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

