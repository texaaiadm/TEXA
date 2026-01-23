// Footer Service - Manage customizable footer settings
import { ref as dbRef, set, get, onValue } from 'firebase/database';
import { rtdb, COLLECTIONS } from './firebase';

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
const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
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

// Seed default footer settings
export async function seedDefaultFooterSettings(): Promise<void> {
    const footerRef = dbRef(rtdb, `${COLLECTIONS.FOOTER_SETTINGS}/main`);
    const snapshot = await get(footerRef);

    if (!snapshot.exists()) {
        await set(footerRef, DEFAULT_FOOTER_SETTINGS);
        console.log('✅ Default footer settings seeded');
    }
}

// Get footer settings
export async function getFooterSettings(): Promise<FooterSettings | null> {
    try {
        const footerRef = dbRef(rtdb, `${COLLECTIONS.FOOTER_SETTINGS}/main`);
        const snapshot = await get(footerRef);

        if (snapshot.exists()) {
            return snapshot.val() as FooterSettings;
        }

        // Seed if not exists
        await seedDefaultFooterSettings();
        return DEFAULT_FOOTER_SETTINGS;
    } catch (error) {
        console.error('Error getting footer settings:', error);
        return null;
    }
}

// Subscribe to footer settings changes
export function subscribeToFooterSettings(
    callback: (settings: FooterSettings | null) => void
): () => void {
    const footerRef = dbRef(rtdb, `${COLLECTIONS.FOOTER_SETTINGS}/main`);

    // Initial fetch
    get(footerRef).then(snapshot => {
        if (!snapshot.exists()) {
            void seedDefaultFooterSettings();
            callback(DEFAULT_FOOTER_SETTINGS);
        } else {
            callback(snapshot.val() as FooterSettings);
        }
    }).catch(error => {
        console.error('Error in initial footer fetch:', error);
        callback(null);
    });

    // Real-time updates every 10 seconds
    const intervalId = setInterval(async () => {
        try {
            const snapshot = await get(footerRef);
            if (snapshot.exists()) {
                callback(snapshot.val() as FooterSettings);
            }
        } catch (error) {
            console.error('Error polling footer settings:', error);
        }
    }, 10000);

    // Return cleanup function
    return () => clearInterval(intervalId);
}

// Update footer settings
export async function updateFooterSettings(
    updates: Partial<FooterSettings>
): Promise<boolean> {
    try {
        const footerRef = dbRef(rtdb, `${COLLECTIONS.FOOTER_SETTINGS}/main`);
        const snapshot = await get(footerRef);

        if (!snapshot.exists()) {
            await seedDefaultFooterSettings();
        }

        const currentSettings = snapshot.exists() ? snapshot.val() : DEFAULT_FOOTER_SETTINGS;
        const updatedSettings = {
            ...currentSettings,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await set(footerRef, updatedSettings);
        return true;
    } catch (error) {
        console.error('Error updating footer settings:', error);
        return false;
    }
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
