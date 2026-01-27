// Supabase Theme Service - Manage theme settings
import { supabase } from './supabaseService';

// Theme Settings Interface
export interface ThemeSettings {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    borderRadius: string;
    glassEffect: boolean;
    darkMode: boolean;
    customCSS?: string;
}

// Default theme settings
const DEFAULT_THEME_SETTINGS: ThemeSettings = {
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    accentColor: '#22c55e',
    backgroundColor: '#0f172a',
    textColor: '#f1f5f9',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '1rem',
    glassEffect: true,
    darkMode: true,
    customCSS: ''
};

// Get theme setting by key
export const getThemeSetting = async <K extends keyof ThemeSettings>(key: K): Promise<ThemeSettings[K]> => {
    try {
        const { data, error } = await supabase
            .from('theme_settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error || !data) {
            return DEFAULT_THEME_SETTINGS[key];
        }
        return data.value as ThemeSettings[K];
    } catch (error) {
        console.error(`Error getting theme setting ${key}:`, error);
        return DEFAULT_THEME_SETTINGS[key];
    }
};

// Get all theme settings
export const getAllThemeSettings = async (): Promise<ThemeSettings> => {
    try {
        const { data, error } = await supabase
            .from('theme_settings')
            .select('*');

        if (error || !data || data.length === 0) {
            return DEFAULT_THEME_SETTINGS;
        }

        const settings: Partial<ThemeSettings> = {};
        data.forEach(item => {
            (settings as any)[item.key] = item.value;
        });

        return { ...DEFAULT_THEME_SETTINGS, ...settings };
    } catch (error) {
        console.error('Error getting all theme settings:', error);
        return DEFAULT_THEME_SETTINGS;
    }
};

// Subscribe to theme settings (polling)
export const subscribeToThemeSettings = (callback: (settings: ThemeSettings) => void) => {
    let stopped = false;

    const fetchSettings = async () => {
        if (stopped) return;
        const settings = await getAllThemeSettings();
        callback(settings);
    };

    void fetchSettings();
    const intervalId = setInterval(fetchSettings, 15000);
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

// Save theme setting
export const saveThemeSetting = async <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]): Promise<boolean> => {
    try {
        const { error } = await supabase
            .from('theme_settings')
            .upsert({
                key,
                value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) {
            console.error(`Error saving theme setting ${key}:`, error);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`Error saving theme setting ${key}:`, error);
        return false;
    }
};

// Save all theme settings
export const saveAllThemeSettings = async (settings: ThemeSettings): Promise<boolean> => {
    try {
        const entries = Object.entries(settings) as [keyof ThemeSettings, any][];
        const upserts = entries.map(([key, value]) => ({
            key,
            value,
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('theme_settings')
            .upsert(upserts, { onConflict: 'key' });

        if (error) {
            console.error('Error saving all theme settings:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error saving all theme settings:', error);
        return false;
    }
};

// Apply theme to document
export const applyTheme = (settings: ThemeSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', settings.primaryColor);
    root.style.setProperty('--secondary-color', settings.secondaryColor);
    root.style.setProperty('--accent-color', settings.accentColor);
    root.style.setProperty('--bg-color', settings.backgroundColor);
    root.style.setProperty('--text-color', settings.textColor);
    root.style.setProperty('--font-family', settings.fontFamily);
    root.style.setProperty('--border-radius', settings.borderRadius);

    if (settings.customCSS) {
        let styleEl = document.getElementById('custom-theme-css');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'custom-theme-css';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = settings.customCSS;
    }
};

// Get default theme settings
export const getDefaultThemeSettings = (): ThemeSettings => DEFAULT_THEME_SETTINGS;
