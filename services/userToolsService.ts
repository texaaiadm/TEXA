// User Tools Service - Check individual tool access
import { supabase } from './supabaseService';

export interface UserToolAccess {
    user_id: string;
    tool_id: string;
    access_end: string;
    order_ref_id?: string;
    created_at: string;
}

// Check if user has active individual access to a specific tool
export const hasIndividualToolAccess = async (userId: string, toolId: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('user_tools')
            .select('access_end')
            .eq('user_id', userId)
            .eq('tool_id', toolId)
            .single();

        if (error || !data) {
            return false;
        }

        // Check if access is still valid
        const accessEnd = new Date(data.access_end);
        return accessEnd > new Date();
    } catch (error) {
        console.error('Error checking individual tool access:', error);
        return false;
    }
};

// Get all active tool accesses for a user - uses API endpoint to bypass RLS
export const getUserToolAccesses = async (userId: string): Promise<UserToolAccess[]> => {
    try {
        // Use API endpoint which has service role key to bypass RLS
        const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const apiBaseUrl = isDev ? 'http://127.0.0.1:8787' : '';

        const response = await fetch(`${apiBaseUrl}/api/public/user-tools?userId=${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                console.log('[userToolsService] Got', result.data.length, 'active tools for user');
                return result.data as UserToolAccess[];
            }
        }

        console.warn('[userToolsService] API call failed, falling back to direct Supabase');
        // Fallback to direct Supabase (may fail due to RLS)
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('user_tools')
            .select('*')
            .eq('user_id', userId)
            .gt('access_end', now);

        if (error) {
            console.error('Error getting user tool accesses:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error getting user tool accesses:', error);
        return [];
    }
};

// Check if user can access a tool (either via subscription or individual purchase)
// UPDATED: Now checks user_tools table for BOTH subscription package tools and individual purchases
// Subscription packages now store their included tools in user_tools on payment success
export const canAccessTool = async (
    user: { id: string; subscriptionEnd?: string } | null,
    toolId: string
): Promise<boolean> => {
    if (!user) return false;

    // Check user_tools table for specific tool access
    // This now handles BOTH:
    // 1. Individual tool purchases (stored with access_end)
    // 2. Subscription package tools (stored per-tool with package's access_end)
    return await hasIndividualToolAccess(user.id, toolId);
};
