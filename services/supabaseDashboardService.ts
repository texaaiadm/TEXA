// Supabase Dashboard Content Service - Manage dashboard content settings
import { supabase } from './supabaseService';

// Dashboard Content Settings Interface
export interface DashboardContentSettings {
    heroTitle: string;
    heroSubtitle: string;
    heroImage?: string;
    showPromoBar: boolean;
    promoText: string;
    showStats: boolean;
    statsItems: StatItem[];
    showTestimonials: boolean;
    testimonials: Testimonial[];
    showFeatures: boolean;
    features: Feature[];
}

export interface StatItem {
    label: string;
    value: string;
    icon?: string;
}

export interface Testimonial {
    name: string;
    role: string;
    avatar?: string;
    text: string;
}

export interface Feature {
    title: string;
    description: string;
    icon?: string;
}

// Default dashboard content
export const DEFAULT_DASHBOARD_CONTENT: DashboardContentSettings = {
    heroTitle: 'Akses AI Premium Indonesia Tanpa Ribet',
    heroSubtitle: 'Gunakan ChatGPT Plus, Midjourney, Claude, dan 10+ AI tools premium dengan harga terjangkau.',
    showPromoBar: true,
    promoText: '🎉 Promo Spesial! Diskon 30% untuk member baru!',
    showStats: true,
    statsItems: [
        { label: 'Member', value: '1000+', icon: '👥' },
        { label: 'AI Tools', value: '15+', icon: '🤖' },
        { label: 'Uptime', value: '99.9%', icon: '⚡' }
    ],
    showTestimonials: false,
    testimonials: [],
    showFeatures: true,
    features: [
        { title: 'Akses Instan', description: 'Langsung akses setelah pembayaran', icon: '⚡' },
        { title: 'Hemat Budget', description: 'Lebih murah dari langganan individual', icon: '💰' },
        { title: 'Support 24/7', description: 'Tim support siap membantu', icon: '🎧' }
    ]
};

// Get dashboard content setting by key
export const getDashboardContent = async <K extends keyof DashboardContentSettings>(key: K): Promise<DashboardContentSettings[K]> => {
    try {
        const { data, error } = await supabase
            .from('dashboard_content')
            .select('value')
            .eq('key', key)
            .single();

        if (error || !data) {
            return DEFAULT_DASHBOARD_CONTENT[key];
        }
        return data.value as DashboardContentSettings[K];
    } catch (error) {
        console.error(`Error getting dashboard content ${key}:`, error);
        return DEFAULT_DASHBOARD_CONTENT[key];
    }
};

// Get all dashboard content settings
export const getAllDashboardContent = async (): Promise<DashboardContentSettings> => {
    try {
        const { data, error } = await supabase
            .from('dashboard_content')
            .select('*');

        if (error || !data || data.length === 0) {
            return DEFAULT_DASHBOARD_CONTENT;
        }

        const content: Partial<DashboardContentSettings> = {};
        data.forEach(item => {
            (content as any)[item.key] = item.value;
        });

        return { ...DEFAULT_DASHBOARD_CONTENT, ...content };
    } catch (error) {
        console.error('Error getting all dashboard content:', error);
        return DEFAULT_DASHBOARD_CONTENT;
    }
};

// Subscribe to dashboard content (polling)
export const subscribeToDashboardContent = (callback: (content: DashboardContentSettings) => void) => {
    let stopped = false;

    const fetchContent = async () => {
        if (stopped) return;
        const content = await getAllDashboardContent();
        callback(content);
    };

    void fetchContent();
    const intervalId = setInterval(fetchContent, 15000);
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

// Save dashboard content setting
export const saveDashboardContent = async <K extends keyof DashboardContentSettings>(key: K, value: DashboardContentSettings[K]): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('dashboard_content')
            .upsert({
                key,
                value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) {
            console.error(`Error saving dashboard content ${key}:`, error);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`Error saving dashboard content ${key}:`, error);
        return false;
    }
};

// Save all dashboard content settings
export const saveAllDashboardContent = async (content: DashboardContentSettings): Promise<boolean> => {
    try {
        const entries = Object.entries(content) as [keyof DashboardContentSettings, any][];
        const upserts = entries.map(([key, value]) => ({
            key,
            value,
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('dashboard_content')
            .upsert(upserts, { onConflict: 'key' });

        if (error) {
            console.error('Error saving all dashboard content:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error saving all dashboard content:', error);
        return false;
    }
};

// Get default dashboard content
export const getDefaultDashboardContent = (): DashboardContentSettings => DEFAULT_DASHBOARD_CONTENT;
