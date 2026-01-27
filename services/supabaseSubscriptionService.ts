// Supabase Subscription Service - Manage subscription packages
import { supabase } from './supabaseService';

// Subscription Package Interface
export interface SubscriptionPackage {
    id: string;
    name: string;
    durationDays: number;
    price: number;
    discountPrice?: number;
    isActive: boolean;
    sortOrder: number;
    createdAt?: string;
}

// Default subscription packages
const DEFAULT_PACKAGES: Omit<SubscriptionPackage, 'id' | 'createdAt'>[] = [
    { name: '7 Hari', durationDays: 7, price: 25000, discountPrice: 20000, isActive: true, sortOrder: 0 },
    { name: '2 Minggu', durationDays: 14, price: 45000, discountPrice: 35000, isActive: true, sortOrder: 1 },
    { name: '1 Bulan', durationDays: 30, price: 75000, discountPrice: 55000, isActive: true, sortOrder: 2 }
];

// Get all subscription packages
export const getSubscriptionPackages = async (): Promise<SubscriptionPackage[]> => {
    try {
        const { data, error } = await supabase
            .from('subscription_packages')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('Error getting subscription packages:', error);
            return DEFAULT_PACKAGES.map((p, i) => ({ ...p, id: `default-${i}` }));
        }

        if (!data || data.length === 0) {
            await seedDefaultPackages();
            return DEFAULT_PACKAGES.map((p, i) => ({ ...p, id: `default-${i}` }));
        }

        return data.map(p => ({
            id: p.id,
            name: p.name,
            durationDays: p.duration_days,
            price: p.price,
            discountPrice: p.discount_price,
            isActive: p.is_active,
            sortOrder: p.sort_order,
            createdAt: p.created_at
        }));
    } catch (error) {
        console.error('Error getting subscription packages:', error);
        return DEFAULT_PACKAGES.map((p, i) => ({ ...p, id: `default-${i}` }));
    }
};

// Subscribe to subscription packages
export const subscribeToSubscriptionPackages = (callback: (packages: SubscriptionPackage[]) => void) => {
    let stopped = false;

    const fetchPackages = async () => {
        if (stopped) return;
        const packages = await getSubscriptionPackages();
        callback(packages);
    };

    void fetchPackages();
    const intervalId = setInterval(fetchPackages, 15000);
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

// Seed default packages
export const seedDefaultPackages = async (): Promise<boolean> => {
    try {
        const { data: existing } = await supabase.from('subscription_packages').select('id').limit(1);
        if (existing && existing.length > 0) return false;

        const packages = DEFAULT_PACKAGES.map(p => ({
            name: p.name,
            duration_days: p.durationDays,
            price: p.price,
            discount_price: p.discountPrice,
            is_active: p.isActive,
            sort_order: p.sortOrder,
            created_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('subscription_packages').insert(packages);
        if (error) {
            console.error('Error seeding packages:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error seeding packages:', error);
        return false;
    }
};

// Add subscription package
export const addSubscriptionPackage = async (pkg: Omit<SubscriptionPackage, 'id' | 'createdAt'>): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('subscription_packages')
            .insert({
                name: pkg.name,
                duration_days: pkg.durationDays,
                price: pkg.price,
                discount_price: pkg.discountPrice,
                is_active: pkg.isActive,
                sort_order: pkg.sortOrder,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding package:', error);
            return null;
        }
        return data?.id || null;
    } catch (error) {
        console.error('Error adding package:', error);
        return null;
    }
};

// Update subscription package
export const updateSubscriptionPackage = async (id: string, updates: Partial<SubscriptionPackage>): Promise<boolean> => {
    try {
        const updateData: any = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.durationDays !== undefined) updateData.duration_days = updates.durationDays;
        if (updates.price !== undefined) updateData.price = updates.price;
        if (updates.discountPrice !== undefined) updateData.discount_price = updates.discountPrice;
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
        if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

        const { error } = await supabase
            .from('subscription_packages')
            .update(updateData)
            .eq('id', id);

        if (error) {
            console.error('Error updating package:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error updating package:', error);
        return false;
    }
};

// Delete subscription package
export const deleteSubscriptionPackage = async (id: string): Promise<boolean> => {
    try {
        const { error } = await supabase.from('subscription_packages').delete().eq('id', id);
        if (error) {
            console.error('Error deleting package:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error deleting package:', error);
        return false;
    }
};

// Get default packages
export const getDefaultPackages = () => DEFAULT_PACKAGES;
