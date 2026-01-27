// Dashboard Content Service - Kelola konten teks dan styling dashboard
import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { db, COLLECTIONS } from './firebase';

const SETTINGS_COLLECTION = COLLECTIONS.SETTINGS;
const DASHBOARD_CONTENT_DOC = 'dashboard_content';

// Dashboard Content Settings Interface
export interface DashboardContentSettings {
    // Catalog Section Text
    catalogTitle: string;
    catalogBadgeText: string;  // Supports {count} placeholder
    catalogSubtitle: string;

    // Catalog Section Styling
    catalogTitleColor?: string;
    catalogSubtitleColor?: string;
    catalogBadgeBgColor?: string;
    catalogBadgeTextColor?: string;

    // Empty State
    emptyStateEmoji: string;
    emptyStateTitle: string;
    emptyStateSubtitle: string;
    emptyStateButtonText: string;

    // Metadata
    updatedAt?: string;
    updatedBy?: string;
}

// Default Settings
export const DEFAULT_DASHBOARD_CONTENT: DashboardContentSettings = {
    // Catalog Section
    catalogTitle: 'Katalog AI Premium',
    catalogBadgeText: '{count} Tools',
    catalogSubtitle: 'Aktifkan tool favoritmu dalam hitungan detik.',

    // Styling - empty means use default theme colors
    catalogTitleColor: '',
    catalogSubtitleColor: '',
    catalogBadgeBgColor: '',
    catalogBadgeTextColor: '',

    // Empty State
    emptyStateEmoji: '🔍',
    emptyStateTitle: 'Tidak Ada Tools',
    emptyStateSubtitle: 'Coba pilih kategori lain atau reset filter.',
    emptyStateButtonText: 'Reset Filter'
};

// Get dashboard content settings
export const getDashboardContentSettings = async (): Promise<DashboardContentSettings> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, DASHBOARD_CONTENT_DOC);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { ...DEFAULT_DASHBOARD_CONTENT, ...docSnap.data() } as DashboardContentSettings;
        }
        return DEFAULT_DASHBOARD_CONTENT;
    } catch (error) {
        console.error('Error getting dashboard content settings:', error);
        return DEFAULT_DASHBOARD_CONTENT;
    }
};

// Subscribe to dashboard content changes (polling-based for lite SDK)
export const subscribeToDashboardContent = (
    callback: (settings: DashboardContentSettings) => void
) => {
    const docRef = doc(db, SETTINGS_COLLECTION, DASHBOARD_CONTENT_DOC);
    let stopped = false;

    const fetchOnce = async () => {
        if (stopped) return;
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                callback({ ...DEFAULT_DASHBOARD_CONTENT, ...docSnap.data() } as DashboardContentSettings);
            } else {
                callback(DEFAULT_DASHBOARD_CONTENT);
            }
        } catch (error) {
            console.error('Error subscribing to dashboard content:', error);
            callback(DEFAULT_DASHBOARD_CONTENT);
        }
    };

    void fetchOnce();
    const intervalId = setInterval(fetchOnce, 10000);

    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

// Save dashboard content settings
export const saveDashboardContentSettings = async (
    settings: Partial<DashboardContentSettings>,
    updatedBy?: string
): Promise<boolean> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, DASHBOARD_CONTENT_DOC);
        await setDoc(
            docRef,
            {
                ...settings,
                updatedAt: new Date().toISOString(),
                updatedBy: updatedBy || 'admin'
            },
            { merge: true }
        );
        return true;
    } catch (error) {
        console.error('Error saving dashboard content settings:', error);
        return false;
    }
};
