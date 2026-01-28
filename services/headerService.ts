// Header Service - Migrated to Supabase
import { supabase } from './supabaseService';

const SETTINGS_KEY = 'header_config';

export type HeaderNavActionType = 'route' | 'url';

export interface HeaderNavItem {
  id: string;
  label: string;
  actionType: HeaderNavActionType;
  actionValue: string;
  isActive?: boolean;
}

export interface HeaderContactInfo {
  phone: string;
  email: string;
  location: string;
}

export interface HeaderSettings {
  logoUrl: string;
  brandName: string;
  tagline: string;
  navItems: HeaderNavItem[];
  contact: HeaderContactInfo;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_HEADER_SETTINGS: HeaderSettings = {
  logoUrl: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExcmZsdmIyeWFldDVlcXhoeGNpNWx3N2FyYml3Zjh4NnV2ancxaXBiayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/dXlUFmuOWFRlHYgc9i/giphy.gif',
  brandName: 'TEXA',
  tagline: 'AI Digital Store',
  navItems: [
    { id: 'nav-1', label: 'Page 1', actionType: 'route', actionValue: '', isActive: true },
    { id: 'nav-2', label: 'Page 2', actionType: 'route', actionValue: '', isActive: true },
    { id: 'nav-3', label: 'Page 3', actionType: 'route', actionValue: '', isActive: true },
    { id: 'nav-4', label: 'Page 4', actionType: 'route', actionValue: '', isActive: true },
    { id: 'nav-5', label: 'Page 5', actionType: 'route', actionValue: '', isActive: true },
    { id: 'nav-6', label: 'Page 6', actionType: 'route', actionValue: '', isActive: true },
    { id: 'nav-7', label: 'Page 7', actionType: 'route', actionValue: '', isActive: true }
  ],
  contact: {
    phone: '+62-812-8888-8888',
    email: 'support@texa.ai',
    location: 'Indonesia'
  }
};

export const getHeaderSettings = async (): Promise<HeaderSettings> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single();

    if (error || !data) {
      return DEFAULT_HEADER_SETTINGS;
    }

    return { ...DEFAULT_HEADER_SETTINGS, ...(data.value as object) } as HeaderSettings;
  } catch (error) {
    console.error('Error getting header settings:', error);
    return DEFAULT_HEADER_SETTINGS;
  }
};

export const subscribeToHeaderSettings = (callback: (settings: HeaderSettings) => void) => {
  let stopped = false;
  let inFlight = false;

  const fetchOnce = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const settings = await getHeaderSettings();
      if (!stopped) callback(settings);
    } catch (error) {
      console.error('Error subscribing to header settings:', error);
      if (!stopped) callback(DEFAULT_HEADER_SETTINGS);
    } finally {
      inFlight = false;
    }
  };

  void fetchOnce();
  const intervalId = setInterval(fetchOnce, 10000);
  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
};

export const saveHeaderSettings = async (
  settings: Partial<HeaderSettings>,
  updatedBy?: string
): Promise<boolean> => {
  try {
    const current = await getHeaderSettings();
    const merged = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || 'admin'
    };

    const { error } = await supabase
      .from('settings')
      .upsert({
        key: SETTINGS_KEY,
        value: merged,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.error('Error saving header settings:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving header settings:', error);
    return false;
  }
};
