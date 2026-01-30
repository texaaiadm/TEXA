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

// Get all active tool accesses for a user
export const getUserToolAccesses = async (userId: string): Promise<UserToolAccess[]> => {
    try {
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
export const canAccessTool = async (
    user: { id: string; subscriptionEnd?: string } | null,
    toolId: string
): Promise<boolean> => {
    if (!user) return false;

    // Check subscription first
    if (user.subscriptionEnd) {
        const subEnd = new Date(user.subscriptionEnd);
        if (subEnd > new Date()) {
            return true; // Has active subscription
        }
    }

    // Check individual tool access
    return await hasIndividualToolAccess(user.id, toolId);
};
