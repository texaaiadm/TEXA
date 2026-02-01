// Payment Gateway Service
// Handles payment gateway operations and database access

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

export interface PaymentGateway {
    id: string;
    name: string;
    type: 'tokopay' | 'midtrans' | 'xendit' | string;
    is_active: boolean;
    is_default: boolean;
    config: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface TokopayConfig {
    merchantId: string;
    secretKey: string;
    webhookIp?: string;
}

export interface MidtransConfig {
    serverKey: string;
    clientKey: string;
    isProduction: boolean;
}

/**
 * Get the active/default payment gateway
 */
export async function getActiveGateway(): Promise<PaymentGateway | null> {
    if (!supabase) return null;

    try {
        // First try to get the default gateway
        const { data: defaultGateway, error: defaultError } = await supabase
            .from('payment_gateways')
            .select('*')
            .eq('is_default', true)
            .eq('is_active', true)
            .single();

        if (!defaultError && defaultGateway) {
            return defaultGateway;
        }

        // If no default, get any active gateway
        const { data: activeGateway, error: activeError } = await supabase
            .from('payment_gateways')
            .select('*')
            .eq('is_active', true)
            .limit(1)
            .single();

        if (activeError) {
            console.error('Error fetching active gateway:', activeError);
            return null;
        }

        return activeGateway;
    } catch (error) {
        console.error('Error in getActiveGateway:', error);
        return null;
    }
}

/**
 * Get all payment gateways
 */
export async function getAllGateways(): Promise<PaymentGateway[]> {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('payment_gateways')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching gateways:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getAllGateways:', error);
        return [];
    }
}

/**
 * Get gateway by ID
 */
export async function getGatewayById(id: string): Promise<PaymentGateway | null> {
    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('payment_gateways')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching gateway:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in getGatewayById:', error);
        return null;
    }
}

/**
 * Get gateway by type
 */
export async function getGatewayByType(type: string): Promise<PaymentGateway | null> {
    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('payment_gateways')
            .select('*')
            .eq('type', type)
            .eq('is_active', true)
            .single();

        if (error) {
            console.error('Error fetching gateway by type:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in getGatewayByType:', error);
        return null;
    }
}

/**
 * Create payment gateway
 */
export async function createGateway(gateway: Omit<PaymentGateway, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentGateway | null> {
    if (!supabase) return null;

    try {
        // If this is set as default, unset others
        if (gateway.is_default) {
            await supabase
                .from('payment_gateways')
                .update({ is_default: false })
                .eq('is_default', true);
        }

        const { data, error } = await supabase
            .from('payment_gateways')
            .insert([gateway])
            .select()
            .single();

        if (error) {
            console.error('Error creating gateway:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in createGateway:', error);
        return null;
    }
}

/**
 * Update payment gateway
 */
export async function updateGateway(id: string, updates: Partial<PaymentGateway>): Promise<PaymentGateway | null> {
    if (!supabase) return null;

    try {
        // If this is set as default, unset others
        if (updates.is_default) {
            await supabase
                .from('payment_gateways')
                .update({ is_default: false })
                .eq('is_default', true)
                .neq('id', id);
        }

        const { data, error } = await supabase
            .from('payment_gateways')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating gateway:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error in updateGateway:', error);
        return null;
    }
}

/**
 * Delete payment gateway
 */
export async function deleteGateway(id: string): Promise<boolean> {
    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('payment_gateways')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting gateway:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error in deleteGateway:', error);
        return false;
    }
}

/**
 * Test gateway connection
 */
export async function testGatewayConnection(gateway: PaymentGateway): Promise<{ success: boolean; message: string }> {
    try {
        switch (gateway.type) {
            case 'tokopay':
                return await testTokopayConnection(gateway.config as TokopayConfig);

            case 'midtrans':
                return { success: false, message: 'Midtrans test connection not yet implemented' };

            case 'xendit':
                return { success: false, message: 'Xendit test connection not yet implemented' };

            default:
                return { success: false, message: `Unknown gateway type: ${gateway.type}` };
        }
    } catch (error: any) {
        return { success: false, message: error.message || 'Connection test failed' };
    }
}

/**
 * Test TokoPay connection
 */
async function testTokopayConnection(config: TokopayConfig): Promise<{ success: boolean; message: string }> {
    try {
        if (!config.merchantId || !config.secretKey) {
            return { success: false, message: 'Merchant ID and Secret Key are required' };
        }

        // Test by making a simple API call to TokoPay (optional - just validate config format)
        // For now, just validate the config structure
        if (config.merchantId.length < 10) {
            return { success: false, message: 'Invalid Merchant ID format' };
        }

        if (config.secretKey.length < 32) {
            return { success: false, message: 'Invalid Secret Key format' };
        }

        return {
            success: true,
            message: 'TokoPay configuration is valid. Webhook will be tested on actual payment.'
        };
    } catch (error: any) {
        return { success: false, message: error.message || 'TokoPay test failed' };
    }
}

/**
 * Get TokoPay config (with fallback to env vars)
 */
export async function getTokopayConfig(): Promise<TokopayConfig> {
    const gateway = await getGatewayByType('tokopay');

    if (gateway && gateway.config) {
        return gateway.config as TokopayConfig;
    }

    // Fallback to environment variables
    return {
        merchantId: process.env.TOKOPAY_MERCHANT_ID || 'M250828KEAYY483',
        secretKey: process.env.TOKOPAY_SECRET_KEY || 'b3bb79b23b82ed33a54927dbaac95d8a70e19de7f5d47a613d1db4d32776125c',
        webhookIp: '178.128.104.179'
    };
}
