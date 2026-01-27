// Supabase Dock Service - Manage floating dock shortcuts
import { supabase } from './supabaseService';

// Dock Item Interface
export interface DockItem {
    id: string;
    icon: string;
    label: string;
    actionType: 'url' | 'route';
    actionValue: string;
    order: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// Default dock items
const DEFAULT_DOCK_ITEMS: Omit<DockItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { icon: '🏠', label: 'Home', actionType: 'route', actionValue: '/', order: 0, isActive: true },
    { icon: '🛒', label: 'Marketplace', actionType: 'route', actionValue: '/#/', order: 1, isActive: true },
    { icon: '⚙️', label: 'Admin', actionType: 'route', actionValue: '/#/admin', order: 2, isActive: true },
    { icon: '📚', label: 'Docs', actionType: 'url', actionValue: 'https://docs.texa.ai', order: 3, isActive: true }
];

// Convert Supabase format to local format
const toLocalDockItem = (item: any): DockItem => ({
    id: item.id,
    icon: item.icon,
    label: item.name || item.label,
    actionType: item.url?.startsWith('/#') || item.url?.startsWith('/') ? 'route' : 'url',
    actionValue: item.url,
    order: item.order ?? 0,
    isActive: item.is_active ?? true,
    createdAt: item.created_at,
    updatedAt: item.updated_at
});

// Subscribe to dock items (polling)
export const subscribeToDockItems = (callback: (items: DockItem[]) => void) => {
    let stopped = false;

    const fetchDockItems = async () => {
        if (stopped) return;
        try {
            const { data, error } = await supabase
                .from('dock_items')
                .select('*')
                .eq('is_active', true)
                .order('order', { ascending: true });

            if (error) {
                console.error('Error fetching dock items:', error);
                callback([]);
                return;
            }

            if (!data || data.length === 0) {
                await seedDefaultDockItems();
                const { data: newData } = await supabase
                    .from('dock_items')
                    .select('*')
                    .eq('is_active', true)
                    .order('order', { ascending: true });
                callback((newData || []).map(toLocalDockItem));
            } else {
                callback(data.map(toLocalDockItem));
            }
        } catch (error) {
            console.error('Error subscribing to dock items:', error);
            callback([]);
        }
    };

    void fetchDockItems();
    const intervalId = setInterval(fetchDockItems, 10000);
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

// Get all dock items (including inactive, for admin)
export const getAllDockItems = async (): Promise<DockItem[]> => {
    try {
        const { data, error } = await supabase
            .from('dock_items')
            .select('*')
            .order('order', { ascending: true });

        if (error) {
            console.error('Error getting all dock items:', error);
            return [];
        }
        return (data || []).map(toLocalDockItem);
    } catch (error) {
        console.error('Error getting all dock items:', error);
        return [];
    }
};

// Seed default dock items
export const seedDefaultDockItems = async (): Promise<boolean> => {
    try {
        const { data: existing } = await supabase.from('dock_items').select('id').limit(1);
        if (existing && existing.length > 0) return false;

        const items = DEFAULT_DOCK_ITEMS.map(item => ({
            icon: item.icon,
            name: item.label,
            url: item.actionValue,
            order: item.order,
            is_active: item.isActive,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('dock_items').insert(items);
        if (error) {
            console.error('Error seeding dock items:', error);
            return false;
        }
        console.log('Default dock items seeded successfully');
        return true;
    } catch (error) {
        console.error('Error seeding dock items:', error);
        return false;
    }
};

// Add new dock item
export const addDockItem = async (item: Omit<DockItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
    try {
        const { data: existing } = await supabase
            .from('dock_items')
            .select('order')
            .order('order', { ascending: false })
            .limit(1);
        const maxOrder = existing?.[0]?.order ?? -1;

        const { data, error } = await supabase
            .from('dock_items')
            .insert({
                icon: item.icon,
                name: item.label,
                url: item.actionValue,
                order: maxOrder + 1,
                is_active: item.isActive,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding dock item:', error);
            return null;
        }
        return data?.id || null;
    } catch (error) {
        console.error('Error adding dock item:', error);
        return null;
    }
};

// Update dock item
export const updateDockItem = async (id: string, updates: Partial<Omit<DockItem, 'id' | 'createdAt'>>): Promise<boolean> => {
    try {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (updates.icon !== undefined) updateData.icon = updates.icon;
        if (updates.label !== undefined) updateData.name = updates.label;
        if (updates.actionValue !== undefined) updateData.url = updates.actionValue;
        if (updates.order !== undefined) updateData.order = updates.order;
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

        const { error } = await supabase
            .from('dock_items')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error('Error updating dock item:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error updating dock item:', error);
        return false;
    }
};

// Delete dock item
export const deleteDockItem = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('dock_items').delete().eq('id', id);
        if (error) {
            console.error('Error deleting dock item:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error deleting dock item:', error);
        return false;
    }
};

// Reorder dock items
export const reorderDockItems = async (items: DockItem[]): Promise<boolean> => {
    try {
        const updates = items.map((item, index) =>
            supabase.from('dock_items').update({ order: index, updated_at: new Date().toISOString() }).eq('id', item.id)
        );
        await Promise.all(updates);
        return true;
    } catch (error) {
        console.error('Error reordering dock items:', error);
        return false;
    }
};
