// Footer Service - Manage customizable footer settings
import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { get, ref as rtdbRef, set as rtdbSet } from 'firebase/database';
import { db, rtdb, COLLECTIONS } from './firebase';

export interface SocialMediaLink {
    platform: string;
    label: string;
    url: string;
    icon: string;
    isActive: boolean;
}

export interface FooterSettings {
    id: string;
    companyName: string;
    companyTagline: string;
    copyrightText: string;

    // Contact Info
    whatsappUrl: string;
    email?: string;
    phone?: string;

    // Address
    addressLine1: string;
    addressLine2?: string;
    city: string;
    country: string;

    // Google Maps
    mapsUrl: string;
    mapsEmbedUrl: string;

    // Social Media
    socialMedia: SocialMediaLink[];

    updatedAt: string;
}

// Default footer settings
export const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
    id: 'main',
    companyName: 'TEXA-Ai',
    companyTagline: 'Premium AI Tools Marketplace & Digital Creator',
    copyrightText: '© 2025 Texa Group. All rights reserved.',

    whatsappUrl: 'https://wa.link/32qf1o',
    email: 'contact@texa.ai',
    phone: '+62 xxx xxxx xxxx',

    addressLine1: 'Jl. Example Street No. 123',
    addressLine2: 'Gedung TEXA Lt. 5',
    city: 'Jakarta',
    country: 'Indonesia',

    mapsUrl: 'https://maps.app.goo.gl/VhzbPqZrVDMh3aU78',
    mapsEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d126920.45667891573!2d106.68942995!3d-6.229386699999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f3e945e34b9d%3A0x5371bf0fdad786a2!2sJakarta!5e0!3m2!1sen!2sid!4v1234567890123!5m2!1sen!2sid',

    socialMedia: [
        { platform: 'facebook', label: 'Facebook', url: 'https://facebook.com/texaai', icon: '📘', isActive: true },
        { platform: 'youtube', label: 'YouTube', url: 'https://youtube.com/@texaai', icon: '▶️', isActive: true },
        { platform: 'telegram', label: 'Telegram', url: 'https://t.me/texaai', icon: '✈️', isActive: true },
        { platform: 'instagram', label: 'Instagram', url: 'https://instagram.com/texaai', icon: '📷', isActive: true },
        { platform: 'threads', label: 'Threads', url: 'https://threads.net/@texaai', icon: '🧵', isActive: true },
        { platform: 'tiktok', label: 'TikTok', url: 'https://tiktok.com/@texaai', icon: '🎵', isActive: true }
    ],

    updatedAt: new Date().toISOString()
};

const FOOTER_COLLECTION = COLLECTIONS.FOOTER_SETTINGS;
const FOOTER_DOC = 'main';
const LOCAL_STORAGE_KEY = 'texa_footer_settings';

const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('Timeout')), ms);
            })
        ]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

const normalizeFooterSettings = (data: Partial<FooterSettings> | null | undefined): FooterSettings => {
    const merged = { ...DEFAULT_FOOTER_SETTINGS, ...(data || {}) } as FooterSettings;
    return {
        ...merged,
        id: merged.id || FOOTER_DOC,
        updatedAt: merged.updatedAt || new Date().toISOString()
    };
};

const loadFromLocalStorage = (): FooterSettings | null => {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<FooterSettings>;
        return normalizeFooterSettings(parsed);
    } catch {
        return null;
    }
};

const saveToLocalStorage = (settings: FooterSettings): boolean => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
        return true;
    } catch {
        return false;
    }
};

// Seed default footer settings
export async function seedDefaultFooterSettings(): Promise<void> {
    const docRef = doc(db, FOOTER_COLLECTION, FOOTER_DOC);
    const snapshot = await withTimeout(getDoc(docRef), 6000);
    if (snapshot.exists()) return;

    const payload = normalizeFooterSettings({ ...DEFAULT_FOOTER_SETTINGS, id: FOOTER_DOC });
    saveToLocalStorage(payload);
    await withTimeout(setDoc(docRef, payload), 6000);
}

// Get footer settings
export async function getFooterSettings(): Promise<FooterSettings | null> {
    const docRef = doc(db, FOOTER_COLLECTION, FOOTER_DOC);

    try {
        const snapshot = await withTimeout(getDoc(docRef), 6000);

        if (!snapshot.exists()) {
            await seedDefaultFooterSettings();
            return normalizeFooterSettings(DEFAULT_FOOTER_SETTINGS);
        }

        const settings = normalizeFooterSettings({ ...(snapshot.data() as any), id: snapshot.id });
        saveToLocalStorage(settings);
        return settings;
    } catch (error) {
        console.error('Error getting footer settings:', error);
    }

    try {
        const rtdbPath = `${FOOTER_COLLECTION}/${FOOTER_DOC}`;
        const snap = await withTimeout(get(rtdbRef(rtdb, rtdbPath)), 4000);
        if (snap.exists()) {
            const data = normalizeFooterSettings(snap.val() as Partial<FooterSettings>);
            saveToLocalStorage(data);
            void withTimeout(setDoc(docRef, data), 6000).catch(() => { });
            return data;
        }
    } catch (error) {
        console.error('Error getting footer settings from RTDB:', error);
    }

    const local = loadFromLocalStorage();
    if (local) return local;

    return normalizeFooterSettings(DEFAULT_FOOTER_SETTINGS);
}

// Subscribe to footer settings changes
export function subscribeToFooterSettings(
    callback: (settings: FooterSettings | null) => void
): () => void {
    let stopped = false;
    let inFlight = false;

    const fetchOnce = async () => {
        if (stopped || inFlight) return;
        inFlight = true;
        try {
            const settings = await getFooterSettings();
            if (stopped) return;
            callback(settings);
        } catch {
            if (stopped) return;
            callback(normalizeFooterSettings(DEFAULT_FOOTER_SETTINGS));
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
}

// Update footer settings
export async function updateFooterSettings(
    updates: Partial<FooterSettings>
): Promise<boolean> {
    const currentSettings = (await getFooterSettings()) || DEFAULT_FOOTER_SETTINGS;
    const updatedSettings: FooterSettings = normalizeFooterSettings({
        ...currentSettings,
        ...updates,
        id: FOOTER_DOC,
        updatedAt: new Date().toISOString()
    });

    let wrote = false;
    wrote = saveToLocalStorage(updatedSettings) || wrote;

    try {
        const docRef = doc(db, FOOTER_COLLECTION, FOOTER_DOC);
        await withTimeout(setDoc(docRef, updatedSettings), 6000);
        wrote = true;
    } catch (error) {
        console.error('Error updating footer settings (Firestore):', error);
    }

    try {
        const rtdbPath = `${FOOTER_COLLECTION}/${FOOTER_DOC}`;
        await withTimeout(rtdbSet(rtdbRef(rtdb, rtdbPath), updatedSettings), 4000);
        wrote = true;
    } catch (error) {
        console.error('Error updating footer settings (RTDB):', error);
    }

    return wrote;
}

// Update social media link
export async function updateSocialMediaLink(
    platform: string,
    updates: Partial<SocialMediaLink>
): Promise<boolean> {
    try {
        const settings = await getFooterSettings();
        if (!settings) return false;

        const updatedSocialMedia = settings.socialMedia.map(link =>
            link.platform === platform ? { ...link, ...updates } : link
        );

        return await updateFooterSettings({ socialMedia: updatedSocialMedia });
    } catch (error) {
        console.error('Error updating social media link:', error);
        return false;
    }
}

// Extract Google Maps embed URL from share URL
export function extractMapsEmbedUrl(shareUrl: string): string {
    // If already an embed URL, return as is
    if (shareUrl.includes('/maps/embed')) {
        return shareUrl;
    }

    // Try to extract coordinates or place ID
    // For now, return a default embed with the share URL
    // In production, you might want to use Google Maps Embed API

    // Simple fallback: use the place ID if available
    const match = shareUrl.match(/\/maps\/.*\/(@[\d.-]+,[\d.-]+|place\/[^/]+)/);
    if (match) {
        return `https://www.google.com/maps/embed?pb=${encodeURIComponent(shareUrl)}`;
    }

    // Return original URL as fallback
    return shareUrl;
}
