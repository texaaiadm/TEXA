// Dock Service - Manage floating dock shortcuts in Firestore
import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore/lite';
import { db, COLLECTIONS } from './firebase';

// Dock Item Interface
export interface DockItem {
    id: string;
    icon: string;           // Emoji or icon identifier
    label: string;          // Display name
    actionType: 'url' | 'route';
    actionValue: string;    // URL or route path
    order: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

const DOCK_COLLECTION = COLLECTIONS.DOCK_ITEMS;

// Default dock items
const DEFAULT_DOCK_ITEMS: Omit<DockItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
        icon: '🏠',
        label: 'Home',
        actionType: 'route',
        actionValue: '/',
        order: 0,
        isActive: true
    },
    {
        icon: '🛒',
        label: 'Marketplace',
        actionType: 'route',
        actionValue: '/#/',
        order: 1,
        isActive: true
    },
    {
        icon: '⚙️',
        label: 'Admin',
        actionType: 'route',
        actionValue: '/#/admin',
        order: 2,
        isActive: true
    },
    {
        icon: '📚',
        label: 'Docs',
        actionType: 'url',
        actionValue: 'https://docs.texa.ai',
        order: 3,
        isActive: true
    }
];

// Subscribe to dock items (real-time)
export const subscribeToDockItems = (callback: (items: DockItem[]) => void) => {
    const q = query(collection(db, DOCK_COLLECTION), orderBy('order', 'asc'));
    let stopped = false;

    const fetchDockItems = async () => {
        if (stopped) return;
        try {
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                // Seed default items if empty
                await seedDefaultDockItems();
                const newSnapshot = await getDocs(q);
                const items: DockItem[] = newSnapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                    createdAt: (docSnap.data() as any)?.createdAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.createdAt,
                    updatedAt: (docSnap.data() as any)?.updatedAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.updatedAt
                } as DockItem));
                callback(items.filter(item => item.isActive));
            } else {
                const items: DockItem[] = snapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                    createdAt: (docSnap.data() as any)?.createdAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.createdAt,
                    updatedAt: (docSnap.data() as any)?.updatedAt?.toDate?.()?.toISOString?.() || (docSnap.data() as any)?.updatedAt
                } as DockItem));
                // Only return active items for display
                callback(items.filter(item => item.isActive));
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
        const q = query(collection(db, DOCK_COLLECTION), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as DockItem));
    } catch (error) {
        console.error('Error getting all dock items:', error);
        return [];
    }
};

// Seed default dock items
export const seedDefaultDockItems = async (): Promise<boolean> => {
    try {
        const snapshot = await getDocs(collection(db, DOCK_COLLECTION));
        if (!snapshot.empty) return false;

        for (const item of DEFAULT_DOCK_ITEMS) {
            await addDoc(collection(db, DOCK_COLLECTION), {
                ...item,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
        console.log('Default dock items seeded successfully');
        return true;
    } catch (error) {
        console.error('Error seeding default dock items:', error);
        return false;
    }
};

// Add new dock item
export const addDockItem = async (item: Omit<DockItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
    try {
        const snapshot = await getDocs(collection(db, DOCK_COLLECTION));
        const maxOrder = snapshot.docs.reduce((max, doc) => {
            const order = (doc.data() as any).order || 0;
            return order > max ? order : max;
        }, -1);

        const docRef = await addDoc(collection(db, DOCK_COLLECTION), {
            ...item,
            order: maxOrder + 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding dock item:', error);
        return null;
    }
};

// Update dock item
export const updateDockItem = async (id: string, updates: Partial<Omit<DockItem, 'id' | 'createdAt'>>): Promise<boolean> => {
    try {
        const docRef = doc(db, DOCK_COLLECTION, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error updating dock item:', error);
        return false;
    }
};

// Delete dock item
export const deleteDockItem = async (id: string): Promise<boolean> => {
    try {
        await deleteDoc(doc(db, DOCK_COLLECTION, id));
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
            updateDockItem(item.id, { order: index })
        );
        await Promise.all(updates);
        return true;
    } catch (error) {
        console.error('Error reordering dock items:', error);
        return false;
    }
};
