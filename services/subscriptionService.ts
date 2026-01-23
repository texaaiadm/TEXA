// Subscription Settings Service - Kelola konfigurasi pembayaran di Firestore
import {
    doc,
    getDoc,
    setDoc
} from 'firebase/firestore/lite';
import { db, COLLECTIONS } from './firebase';

// Collection and document name - use from centralized config
const SETTINGS_COLLECTION = COLLECTIONS.SETTINGS;
const SUBSCRIPTION_DOC = 'subscription_config';
const REVENUE_SHARE_DOC = 'revenue_share_config';

// Subscription Settings Interface
export interface SubscriptionSettings {
    // Payment Gateway URLs
    paymentUrl: string;           // URL halaman pembayaran (tripay, midtrans, dll)
    paymentApiUrl?: string;       // API endpoint untuk create transaction

    // Redirect URLs
    successRedirectUrl: string;   // Redirect setelah pembayaran sukses
    failedRedirectUrl: string;    // Redirect setelah pembayaran gagal
    pendingRedirectUrl?: string;  // Redirect untuk pending payment

    // Webhook Configuration
    webhookUrl?: string;          // URL untuk terima notifikasi payment
    webhookSecret?: string;       // Secret key untuk validasi webhook

    // Pricing Packages
    packages: SubscriptionPackage[];

    // UI Settings
    popupTitle?: string;          // Judul popup pembayaran
    popupDescription?: string;    // Deskripsi popup
    buttonText?: string;          // Teks tombol beli
    whatsappNumber?: string;      // Nomor WA untuk konfirmasi manual

    // Feature Flags
    enableAutoActivation?: boolean;   // Auto aktifkan setelah bayar
    enableManualPayment?: boolean;    // Aktifkan pembayaran manual/transfer
    enableQRIS?: boolean;             // Aktifkan QRIS

    // Timestamps
    updatedAt?: string;
    updatedBy?: string;
}

// Subscription Package Interface
export interface SubscriptionPackage {
    id: string;
    name: string;               // "Paket 30 Hari"
    duration: number;           // Durasi dalam hari
    price: number;              // Harga dalam IDR
    discountPrice?: number;     // Harga diskon (optional)
    features: string[];         // List fitur yang termasuk
    popular?: boolean;          // Tandai sebagai populer
    active: boolean;            // Status aktif/nonaktif
}

// Default settings
export const DEFAULT_SETTINGS: SubscriptionSettings = {
    paymentUrl: '',
    successRedirectUrl: '',
    failedRedirectUrl: '',
    packages: [
        {
            id: 'pkg-7',
            name: 'Paket 7 Hari',
            duration: 7,
            price: 25000,
            features: ['Akses semua AI Tools', 'Support via WhatsApp'],
            active: true
        },
        {
            id: 'pkg-30',
            name: 'Paket 30 Hari',
            duration: 30,
            price: 75000,
            discountPrice: 65000,
            features: ['Akses semua AI Tools', 'Priority Support', 'Update Fitur Terbaru'],
            popular: true,
            active: true
        },
        {
            id: 'pkg-90',
            name: 'Paket 90 Hari',
            duration: 90,
            price: 180000,
            discountPrice: 150000,
            features: ['Akses semua AI Tools', 'Priority Support 24/7', 'Early Access Fitur Baru', 'Bonus Tools Eksklusif'],
            active: true
        }
    ],
    popupTitle: 'Berlangganan Premium',
    popupDescription: 'Pilih paket yang sesuai untuk akses penuh semua AI Tools premium.',
    buttonText: 'Beli Sekarang',
    enableAutoActivation: false,
    enableManualPayment: true,
    enableQRIS: false
};

// Get subscription settings
export const getSubscriptionSettings = async (): Promise<SubscriptionSettings> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SUBSCRIPTION_DOC);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { ...DEFAULT_SETTINGS, ...docSnap.data() } as SubscriptionSettings;
        }
        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error('Error getting subscription settings:', error);
        return DEFAULT_SETTINGS;
    }
};

// Subscribe to settings changes (real-time)
export const subscribeToSettings = (callback: (settings: SubscriptionSettings) => void) => {
    const docRef = doc(db, SETTINGS_COLLECTION, SUBSCRIPTION_DOC);

    let stopped = false;

    const fetchOnce = async () => {
        if (stopped) return;
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                callback({ ...DEFAULT_SETTINGS, ...docSnap.data() } as SubscriptionSettings);
            } else {
                callback(DEFAULT_SETTINGS);
            }
        } catch (error) {
            console.error('Error subscribing to settings:', error);
            callback(DEFAULT_SETTINGS);
        }
    };

    void fetchOnce();
    const intervalId = setInterval(fetchOnce, 10000);
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

// Save subscription settings
export const saveSubscriptionSettings = async (
    settings: Partial<SubscriptionSettings>,
    updatedBy?: string
): Promise<boolean> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SUBSCRIPTION_DOC);
        await setDoc(docRef, {
            ...settings,
            updatedAt: new Date().toISOString(),
            updatedBy: updatedBy || 'admin'
        }, { merge: true });
        return true;
    } catch (error) {
        console.error('Error saving subscription settings:', error);
        return false;
    }
};

// Add new package
export const addPackage = async (pkg: SubscriptionPackage): Promise<boolean> => {
    try {
        const current = await getSubscriptionSettings();
        const packages = [...current.packages, pkg];
        return saveSubscriptionSettings({ packages });
    } catch (error) {
        console.error('Error adding package:', error);
        return false;
    }
};

// Update package
export const updatePackage = async (packageId: string, updates: Partial<SubscriptionPackage>): Promise<boolean> => {
    try {
        const current = await getSubscriptionSettings();
        const packages = current.packages.map(pkg =>
            pkg.id === packageId ? { ...pkg, ...updates } : pkg
        );
        return saveSubscriptionSettings({ packages });
    } catch (error) {
        console.error('Error updating package:', error);
        return false;
    }
};

// Delete package
export const deletePackage = async (packageId: string): Promise<boolean> => {
    try {
        const current = await getSubscriptionSettings();
        const packages = current.packages.filter(pkg => pkg.id !== packageId);
        return saveSubscriptionSettings({ packages });
    } catch (error) {
        console.error('Error deleting package:', error);
        return false;
    }
};

// Format price to IDR
export const formatIDR = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
};

// Generate unique package ID
export const generatePackageId = (): string => {
    return `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export type RevenueShareRole = 'OWNER' | 'ADMIN' | 'KARYAWAN';

export interface RevenueSharePerson {
    id: string;
    name: string;
    role: RevenueShareRole;
    percent: number;
}

export interface RevenueShareSettings {
    people: RevenueSharePerson[];
    updatedAt?: string;
    updatedBy?: string;
}

export const DEFAULT_REVENUE_SHARE: RevenueShareSettings = {
    people: [
        { id: 'owner-1', name: 'Owner', role: 'OWNER', percent: 50 },
        { id: 'admin-1', name: 'Admin', role: 'ADMIN', percent: 30 },
        { id: 'karyawan-1', name: 'Karyawan', role: 'KARYAWAN', percent: 20 }
    ]
};

export const getRevenueShareSettings = async (): Promise<RevenueShareSettings> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, REVENUE_SHARE_DOC);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { ...DEFAULT_REVENUE_SHARE, ...docSnap.data() } as RevenueShareSettings;
        }
        return DEFAULT_REVENUE_SHARE;
    } catch (error) {
        console.error('Error getting revenue share settings:', error);
        return DEFAULT_REVENUE_SHARE;
    }
};

export const subscribeToRevenueShareSettings = (callback: (settings: RevenueShareSettings) => void) => {
    const docRef = doc(db, SETTINGS_COLLECTION, REVENUE_SHARE_DOC);

    let stopped = false;

    const fetchOnce = async () => {
        if (stopped) return;
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                callback({ ...DEFAULT_REVENUE_SHARE, ...docSnap.data() } as RevenueShareSettings);
            } else {
                callback(DEFAULT_REVENUE_SHARE);
            }
        } catch (error) {
            console.error('Error subscribing to revenue share settings:', error);
            callback(DEFAULT_REVENUE_SHARE);
        }
    };

    void fetchOnce();
    const intervalId = setInterval(fetchOnce, 10000);
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

export const saveRevenueShareSettings = async (
    settings: Partial<RevenueShareSettings>,
    updatedBy?: string
): Promise<boolean> => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, REVENUE_SHARE_DOC);
        await setDoc(docRef, {
            ...settings,
            updatedAt: new Date().toISOString(),
            updatedBy: updatedBy || 'admin'
        }, { merge: true });
        return true;
    } catch (error) {
        console.error('Error saving revenue share settings:', error);
        return false;
    }
};
