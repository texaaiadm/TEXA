// Catalog Service - Kelola AI Tools di Firestore
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore/lite';
import { db, COLLECTIONS } from './firebase';
import { AITool } from '../types';

// Collection name - use from centralized config
const CATALOG_COLLECTION = COLLECTIONS.CATALOG;

// Extended interface for Firestore document
export interface CatalogItem extends AITool {
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    order?: number;
}

// Default categories (fallback jika Firestore kosong)
export const DEFAULT_CATEGORIES = [
    'Menulis & Riset',
    'Desain & Art',
    'Desain Grafis',
    'Marketing',
    'Coding & Teks',
    'Produktivitas'
];

// Category Interface
export interface Category {
    id: string;
    name: string;
    order: number;
    createdAt?: string;
    updatedAt?: string;
}

// Categories Collection
const CATEGORIES_COLLECTION = COLLECTIONS.CATEGORIES;

// Subscribe to categories (real-time)
export const subscribeToCategories = (callback: (categories: Category[]) => void) => {
    const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('order', 'asc'));
    let stopped = false;

    const fetchCategories = async () => {
        if (stopped) return;
        try {
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                // If no categories exist, seed defaults and return them
                await seedDefaultCategories();
                const newSnapshot = await getDocs(q);
                const categories: Category[] = newSnapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                    createdAt: (docSnap.data() as any)?.createdAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.createdAt,
                    updatedAt: (docSnap.data() as any)?.updatedAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.updatedAt
                } as Category));
                callback(categories);
            } else {
                const categories: Category[] = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                    createdAt: (docSnap.data() as any)?.createdAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.createdAt,
                    updatedAt: (docSnap.data() as any)?.updatedAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.updatedAt
                } as Category));
                callback(categories);
            }
        } catch (error) {
            console.error('Error subscribing to categories:', error);
            // Fallback to default categories
            callback(DEFAULT_CATEGORIES.map((name, index) => ({
                id: `default-${index}`,
                name,
                order: index
            })));
        }
    };

    void fetchCategories();
    const intervalId = setInterval(fetchCategories, 10000); // Refresh every 10s
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

// Seed default categories if empty
export const seedDefaultCategories = async (): Promise<boolean> => {
    try {
        const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
        if (!snapshot.empty) return false;

        for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
            await addDoc(collection(db, CATEGORIES_COLLECTION), {
                name: DEFAULT_CATEGORIES[i],
                order: i,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        console.log('Default categories seeded successfully');
        return true;
    } catch (error) {
        console.error('Error seeding default categories:', error);
        return false;
    }
};

// Add new category
export const addCategory = async (name: string): Promise<string | null> => {
    try {
        // Get current max order
        const snapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
        const maxOrder = snapshot.docs.reduce((max, doc) => {
            const order = (doc.data() as any).order || 0;
            return order > max ? order : max;
        }, -1);

        const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), {
            name: name.trim(),
            order: maxOrder + 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding category:', error);
        return null;
    }
};

// Update category
export const updateCategory = async (id: string, name: string): Promise<boolean> => {
    try {
        const docRef = doc(db, CATEGORIES_COLLECTION, id);
        await updateDoc(docRef, {
            name: name.trim(),
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error updating category:', error);
        return false;
    }
};

// Delete category
export const deleteCategory = async (id: string): Promise<boolean> => {
    try {
        await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
        return true;
    } catch (error) {
        console.error('Error deleting category:', error);
        return false;
    }
};

// Get all categories (one-time fetch)
export const getCategories = async (): Promise<Category[]> => {
    try {
        const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return DEFAULT_CATEGORIES.map((name, index) => ({
                id: `default-${index}`,
                name,
                order: index
            }));
        }
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Category));
    } catch (error) {
        console.error('Error getting categories:', error);
        return DEFAULT_CATEGORIES.map((name, index) => ({
            id: `default-${index}`,
            name,
            order: index
        }));
    }
};

// Subscribe to catalog changes (real-time)
export const subscribeToCatalog = (callback: (items: CatalogItem[]) => void) => {
    const q = query(collection(db, CATALOG_COLLECTION), orderBy('order', 'asc'));

    let stopped = false;

    const fetchOnce = async () => {
        if (stopped) return;
        try {
            const snapshot = await getDocs(q);
            const items: CatalogItem[] = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data(),
                createdAt: (docSnap.data() as any)?.createdAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.createdAt,
                updatedAt: (docSnap.data() as any)?.updatedAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.updatedAt
            } as CatalogItem));
            callback(items);
        } catch (error) {
            console.error('Error subscribing to catalog:', error);
            callback([]);
        }
    };

    void fetchOnce();
    const intervalId = setInterval(fetchOnce, 7000);
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

// Get all catalog items
export const getCatalog = async (): Promise<CatalogItem[]> => {
    try {
        const q = query(collection(db, CATALOG_COLLECTION), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt
        } as CatalogItem));
    } catch (error) {
        console.error('Error getting catalog:', error);
        return [];
    }
};

// Get single catalog item
export const getCatalogItem = async (id: string): Promise<CatalogItem | null> => {
    try {
        const docRef = doc(db, CATALOG_COLLECTION, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return {
                id: docSnap.id,
                ...docSnap.data()
            } as CatalogItem;
        }
        return null;
    } catch (error) {
        console.error('Error getting catalog item:', error);
        return null;
    }
};

// Add new catalog item
export const addCatalogItem = async (
    item: Omit<CatalogItem, 'id' | 'createdAt' | 'updatedAt'>,
    createdBy?: string
): Promise<string | null> => {
    try {
        // Get current count for order
        const catalog = await getCatalog();
        const order = catalog.length;

        const docRef = await addDoc(collection(db, CATALOG_COLLECTION), {
            ...item,
            order,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: createdBy || 'admin'
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding catalog item:', error);
        return null;
    }
};

// Update catalog item
export const updateCatalogItem = async (
    id: string,
    updates: Partial<Omit<CatalogItem, 'id' | 'createdAt'>>
): Promise<boolean> => {
    try {
        const docRef = doc(db, CATALOG_COLLECTION, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error updating catalog item:', error);
        return false;
    }
};

// Delete catalog item
export const deleteCatalogItem = async (id: string): Promise<boolean> => {
    try {
        await deleteDoc(doc(db, CATALOG_COLLECTION, id));
        return true;
    } catch (error) {
        console.error('Error deleting catalog item:', error);
        return false;
    }
};

// Toggle item status
export const toggleCatalogStatus = async (id: string, currentStatus: 'active' | 'inactive'): Promise<boolean> => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    return updateCatalogItem(id, { status: newStatus });
};

// Reorder catalog items
export const reorderCatalogItems = async (items: CatalogItem[]): Promise<boolean> => {
    try {
        const updates = items.map((item, index) =>
            updateCatalogItem(item.id, { order: index })
        );
        await Promise.all(updates);
        return true;
    } catch (error) {
        console.error('Error reordering catalog:', error);
        return false;
    }
};

// Format price to Rupiah
export const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(price);
};

// Seed initial data (run once if catalog is empty)
export const seedCatalogData = async (): Promise<boolean> => {
    try {
        const existing = await getCatalog();
        if (existing.length > 0) {
            console.log('Catalog already has data, skipping seed');
            return false;
        }

        const initialData: Omit<CatalogItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
            {
                name: 'ChatGPT Plus (Shared)',
                description: 'Akses penuh ke GPT-4o, DALL·E 3, dan fitur analisis data tercanggih.',
                category: 'Menulis & Riset',
                imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=400',
                targetUrl: 'https://chat.openai.com',
                status: 'active',
                priceMonthly: 45000,
                order: 0
            },
            {
                name: 'Midjourney Pro',
                description: 'Generate gambar AI kualitas tinggi tanpa batas dengan mode cepat.',
                category: 'Desain & Art',
                imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=400',
                targetUrl: 'https://midjourney.com',
                status: 'active',
                priceMonthly: 75000,
                order: 1
            },
            {
                name: 'Canva Pro Teams',
                description: 'Buka jutaan aset premium dan hapus background otomatis.',
                category: 'Desain Grafis',
                imageUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=400',
                targetUrl: 'https://canva.com',
                status: 'active',
                priceMonthly: 15000,
                order: 2
            },
            {
                name: 'Jasper AI Business',
                description: 'Bikin konten sosmed dan iklan 10x lebih cepat dengan AI.',
                category: 'Marketing',
                imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400',
                targetUrl: 'https://jasper.ai',
                status: 'active',
                priceMonthly: 99000,
                order: 3
            },
            {
                name: 'Claude 3.5 Sonnet',
                description: 'AI cerdas untuk coding dan penulisan kreatif dengan konteks luas.',
                category: 'Coding & Teks',
                imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=400',
                targetUrl: 'https://claude.ai',
                status: 'active',
                priceMonthly: 55000,
                order: 4
            },
            {
                name: 'Grammarly Premium',
                description: 'Cek tata bahasa Inggris otomatis dan kirim email tanpa typo.',
                category: 'Produktivitas',
                imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=400',
                targetUrl: 'https://grammarly.com',
                status: 'active',
                priceMonthly: 25000,
                order: 5
            }
        ];

        for (const item of initialData) {
            await addDoc(collection(db, CATALOG_COLLECTION), {
                ...item,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: 'system'
            });
        }

        console.log('Catalog seeded successfully!');
        return true;
    } catch (error) {
        console.error('Error seeding catalog:', error);
        return false;
    }
};
