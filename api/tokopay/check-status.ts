import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

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
        } catch {
        }
    }

    return {
        merchantId: process.env.TOKOPAY_MERCHANT_ID || 'M250828KEAYY483',
        secretKey: process.env.TOKOPAY_SECRET_KEY || 'b3bb79b23b82ed33a54927dbaac95d8a70e19de7f5d47a613d1db4d32776125c',
        apiBaseUrl: 'https://api.tokopay.id/v1'
    };
}

const normalizeStatus = (value: unknown) => String(value || '').toLowerCase();

const computeSubscriptionEnd = (currentEnd: string | null | undefined, durationDays: number) => {
    if (!Number.isFinite(durationDays) || durationDays <= 0) return null;
    let base = new Date();
    if (currentEnd) {
        const current = new Date(currentEnd);
        if (!Number.isNaN(current.getTime()) && current > base) {
            base = current;
        }
    }
    const end = new Date(base);
    end.setDate(end.getDate() + durationDays);
    return end;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    if (!supabase) {
        return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    const refIdFromQuery = typeof req.query.refId === 'string' ? req.query.refId : '';
    const refIdFromUrl = (() => {
        try {
            return new URL(req.url || '', 'http://localhost').searchParams.get('refId') || '';
        } catch {
            return '';
        }
    })();
    const refId = refIdFromQuery || refIdFromUrl;

    if (!refId) {
        return res.status(400).json({ success: false, error: 'Missing refId parameter' });
    }

    try {
        const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .eq('ref_id', refId)
            .limit(1);

        let order = orders?.[0] || null;

        if (order && order.status === 'pending' && order.tokopay_trx_id) {
            const tokopayConfig = await getTokopayConfig();
            const statusParams = new URLSearchParams({
                merchant: tokopayConfig.merchantId,
                secret: tokopayConfig.secretKey,
                ref_id: refId,
                nominal: String(order.nominal || 0),
                metode: order.payment_method || 'QRISREALTIME'
            });

            const tokopayStatusResp = await fetch(`${tokopayConfig.apiBaseUrl}/order?${statusParams.toString()}`);
            const tokopayStatus = await tokopayStatusResp.json();

            if (tokopayStatus.status === 'Success' && tokopayStatus.data) {
                const statusValue = normalizeStatus(tokopayStatus.data.status);
                if (['paid', 'completed', 'success', 'settlement', 'settled'].includes(statusValue)) {
                    const nowIso = new Date().toISOString();
                    await supabase
                        .from('orders')
                        .update({
                            status: 'paid',
                            paid_at: nowIso,
                            updated_at: nowIso
                        })
                        .eq('ref_id', refId);

                    order = {
                        ...order,
                        status: 'paid',
                        paid_at: nowIso,
                        updated_at: nowIso
                    };
                }
            }
        }

        if (order && order.status === 'paid' && order.user_id && order.user_id !== 'anonymous' && order.user_id !== 'guest-user') {
            const isSubscription = refId.startsWith('SUB');
            const isIndividual = refId.startsWith('TXA');
            const duration = Number(order.duration) || 30;
            const nowIso = new Date().toISOString();

            if (isSubscription) {
                const { data: user } = await supabase
                    .from('users')
                    .select('subscription_end')
                    .eq('id', order.user_id)
                    .single();

                const end = computeSubscriptionEnd(user?.subscription_end, duration);
                if (end) {
                    await supabase
                        .from('users')
                        .update({
                            subscription_end: end.toISOString(),
                            updated_at: nowIso
                        })
                        .eq('id', order.user_id);

                    // CRITICAL: Activate user_tools for each included tool in the package
                    const includedTools = order.included_tool_ids || [];
                    if (Array.isArray(includedTools) && includedTools.length > 0) {
                        console.log('[check-status] Activating subscription tools:', includedTools);

                        for (const toolId of includedTools) {
                            try {
                                // Check if tool already exists for this user
                                const { data: existingToolData } = await supabase
                                    .from('user_tools')
                                    .select('id')
                                    .eq('user_id', order.user_id)
                                    .eq('tool_id', toolId)
                                    .limit(1);

                                if (existingToolData && existingToolData.length > 0) {
                                    // Update existing
                                    await supabase
                                        .from('user_tools')
                                        .update({
                                            access_end: end.toISOString(),
                                            order_ref_id: refId
                                        })
                                        .eq('user_id', order.user_id)
                                        .eq('tool_id', toolId);
                                    console.log('[check-status] Tool access updated:', toolId);
                                } else {
                                    // Insert new
                                    await supabase
                                        .from('user_tools')
                                        .insert({
                                            user_id: order.user_id,
                                            tool_id: toolId,
                                            access_end: end.toISOString(),
                                            order_ref_id: refId,
                                            created_at: nowIso
                                        });
                                    console.log('[check-status] Tool access granted:', toolId);
                                }
                            } catch (toolErr) {
                                console.error('[check-status] Error activating tool:', toolId, toolErr);
                            }
                        }
                    }
                }
            } else if (isIndividual && order.item_id) {
                const { data: tools } = await supabase
                    .from('user_tools')
                    .select('access_end')
                    .eq('user_id', order.user_id)
                    .eq('tool_id', order.item_id)
                    .limit(1);

                const existing = tools?.[0];
                const needsActivation = !existing?.access_end || new Date(existing.access_end) < new Date();

                if (needsActivation) {
                    const accessEnd = new Date();
                    accessEnd.setDate(accessEnd.getDate() + duration);
                    await supabase
                        .from('user_tools')
                        .upsert({
                            user_id: order.user_id,
                            tool_id: order.item_id,
                            access_end: accessEnd.toISOString(),
                            order_ref_id: refId,
                            created_at: nowIso
                        }, {
                            onConflict: 'user_id,tool_id'
                        });
                }
            }
        }

        return res.status(200).json({
            success: true,
            status: order?.status || 'pending',
            paidAt: order?.paid_at || null,
            itemName: order?.item_name || null,
            duration: order?.duration || null,
            activated: order?.status === 'paid'
        });
    } catch {
        return res.status(200).json({ success: true, status: 'pending' });
    }
}
