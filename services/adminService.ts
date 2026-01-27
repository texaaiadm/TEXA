// Admin Service - Manage Users and Subscriptions
import {
    collection,
    getDocs,
    doc,
    deleteDoc,
    query,
    orderBy,
    where,
    addDoc,
    limit,
    setDoc
} from "firebase/firestore/lite";
import { ref, set, remove, onValue, get, update } from "firebase/database";
import { auth, db, rtdb, TexaUser, COLLECTIONS, RTDB_PATHS } from "./firebase";

// Collection names - use from centralized config
const USERS_COLLECTION = COLLECTIONS.USERS;
const SUBSCRIPTIONS_COLLECTION = COLLECTIONS.TRANSACTIONS;

// Subscription Plan Interface
export interface SubscriptionPlan {
    id: string;
    name: string;
    durationDays: number;
    price: number;
    features: string[];
}

// Subscription Record Interface
export interface SubscriptionRecord {
    id: string;
    userId: string;
    userEmail: string;
    planName: string;
    startDate: string;
    endDate: string;
    price: number;
    status: 'active' | 'expired' | 'cancelled' | 'paid' | 'pending';
    createdAt: string;
}

// Stats Interface
export interface AdminStats {
    totalUsers: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
    totalRevenue: number;
    newUsersToday: number;
    adminCount: number;
}

const withTimeout = async <T,>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    });
    try {
        return (await Promise.race([promise, timeoutPromise])) as T;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

// Get All Users (Realtime)
export const subscribeToUsers = (callback: (users: TexaUser[]) => void) => {
    let stopped = false;
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    const fetchOnce = async () => {
        if (stopped) return;
        try {
            const snapshot = await withTimeout(getDocs(q), 10000, 'Timeout: ambil data user terlalu lama');
            const users: TexaUser[] = [];
            snapshot.forEach((docSnap) => {
                users.push({ ...docSnap.data(), id: docSnap.id } as TexaUser);
            });
            callback(users);
        } catch (error) {
            console.error('Error fetching users:', error);
            callback([]);
        }
    };

    void fetchOnce();
    const intervalId = setInterval(fetchOnce, 5000);
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

// Get All Users (One-time)
export const getAllUsers = async (): Promise<TexaUser[]> => {
    try {
        const usersRef = collection(db, USERS_COLLECTION);
        const q = query(usersRef, orderBy('createdAt', 'desc'));
        const snapshot = await withTimeout(getDocs(q), 10000, 'Timeout: ambil data user terlalu lama');

        const users: TexaUser[] = [];
        snapshot.forEach((doc) => {
            users.push({ ...doc.data(), id: doc.id } as TexaUser);
        });

        return users;
    } catch (error) {
        console.error('Error getting users:', error);
        return [];
    }
};

export const createManualMember = async (input: {
    email: string;
    name?: string;
    role?: 'ADMIN' | 'MEMBER';
    isActive?: boolean;
    subscriptionDays?: number;
}): Promise<{ success: boolean; action?: 'updated' | 'created' }> => {
    const email = (input.email || '').trim().toLowerCase();
    const role = input.role ?? 'MEMBER';
    const isActive = input.isActive ?? true;
    const name = (input.name || '').trim();

    if (!email) throw new Error('Email tidak valid');

    const result = await callAdminApi<{ success: true; uid: string; action: 'created' | 'updated' }>(
        '/api/admin/create-user',
        {
            email,
            name,
            role,
            isActive,
            subscriptionDays: input.subscriptionDays
        }
    );

    return { success: true, action: result.action };
};

const ADMIN_API_BASE =
    (import.meta as any).env?.VITE_ADMIN_API_BASE || (import.meta.env.PROD ? '' : 'http://127.0.0.1:8787');

const callAdminApi = async <T>(path: string, body: any): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Anda harus login sebagai admin');

    let res: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
        res = await fetch(`${ADMIN_API_BASE}${path}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error('Timeout: server admin tidak merespons');
        }
        throw new Error('Server admin belum jalan');
    } finally {
        clearTimeout(timeoutId);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) throw new Error(data?.message || 'Permintaan gagal');
    return data as T;
};

export const createAuthMemberWithPassword = async (input: {
    email: string;
    password: string;
    name?: string;
    role?: 'ADMIN' | 'MEMBER';
    isActive?: boolean;
    subscriptionDays?: number;
}): Promise<{ success: true; uid: string; action: 'created' | 'updated' }> => {
    return callAdminApi('/api/admin/create-user', input);
};

export const setMemberPassword = async (input: {
    uid?: string;
    email?: string;
    password: string;
}): Promise<{ success: true }> => {
    return callAdminApi('/api/admin/set-password', input);
};

// Update User
export const updateUser = async (userId: string, data: Partial<TexaUser>): Promise<boolean> => {
    try {
        const userRef = doc(db, USERS_COLLECTION, userId);

        // Use setDoc with merge instead of updateDoc to handle cases where doc might be missing
        await withTimeout(setDoc(userRef, {
            ...data,
            updatedAt: new Date().toISOString()
        }, { merge: true }), 10000, 'Timeout: update user terlalu lama');

        // Also update RTDB (with safety check)
        if (rtdb && (data.role || data.isActive !== undefined || data.subscriptionEnd !== undefined)) {
            const updates: any = { updatedAt: new Date().toISOString() };
            if (data.role) updates.role = data.role;
            if (data.isActive !== undefined) updates.isActive = data.isActive;
            if (data.subscriptionEnd !== undefined) updates.subscriptionEnd = data.subscriptionEnd;

            void withTimeout(
                update(ref(rtdb, `${RTDB_PATHS.USERS}/${userId}`), updates),
                8000,
                'Timeout: update RTDB terlalu lama'
            ).catch(async () => {
                try {
                    const snapshot = await withTimeout(
                        get(ref(rtdb, `${RTDB_PATHS.USERS}/${userId}`)),
                        8000,
                        'Timeout: ambil RTDB terlalu lama'
                    );
                    const existing = snapshot.exists() ? snapshot.val() : {};
                    await withTimeout(set(ref(rtdb, `${RTDB_PATHS.USERS}/${userId}`), {
                        ...existing,
                        ...data,
                        updatedAt: new Date().toISOString()
                    }), 8000, 'Timeout: set RTDB terlalu lama');
                } catch {
                }
            });
        }

        return true;
    } catch (error) {
        return false;
    }
};

// Test Database Permissions
export const testDatabasePermissions = async (): Promise<{ firestore: string; rtdb: string }> => {
    const results = { firestore: 'Testing...', rtdb: 'Testing...' };

    // Test Firestore
    try {
        if (!auth.currentUser) {
            results.firestore = 'FAILED (not-authenticated): Anda belum login';
        } else {
            const testDocRef = doc(db, COLLECTIONS.SETTINGS, 'permission_test');
            await withTimeout(setDoc(testDocRef, {
                test: true,
                updatedAt: new Date().toISOString(),
                user: auth.currentUser?.email
            }), 10000, 'Timeout: test Firestore terlalu lama');
            results.firestore = 'OK';
        }
    } catch (e: any) {
        const code = e?.code ? String(e.code) : '';
        const message = e?.message ? String(e.message) : 'Unknown error';
        results.firestore = code ? `FAILED (${code}): ${message}` : `FAILED: ${message}`;
    }

    // Test RTDB - with improved error handling
    try {
        if (!auth.currentUser) {
            results.rtdb = 'FAILED (not-authenticated): Anda belum login';
        } else {
            // Check if RTDB is initialized
            if (!rtdb) {
                results.rtdb = 'FAILED: RTDB not initialized - Check Firebase config';
                return results;
            }

            const testPath = `test_connection/${Date.now()}`;
            const testRef = ref(rtdb, testPath);

            try {
                // Try WRITE test
                await withTimeout(
                    set(testRef, {
                        test: true,
                        timestamp: new Date().toISOString(),
                        user: auth.currentUser?.email
                    }),
                    8000,
                    'Write timeout'
                );

                // Cleanup
                await withTimeout(remove(testRef), 4000, 'Cleanup timeout').catch(() => { });

                results.rtdb = 'OK';
            } catch (writeError: any) {
                // If write fails, try READ test as fallback
                console.log('RTDB write failed, trying read test...', writeError.message);

                try {
                    const readRef = ref(rtdb, '/');
                    await withTimeout(
                        get(readRef),
                        8000,
                        'Read timeout'
                    );

                    // Read succeeded but write failed
                    results.rtdb = 'PARTIAL: Read OK, Write FAILED - Check RTDB Rules (write access)';
                } catch (readError: any) {
                    // Both read and write failed
                    if (writeError.message.includes('timeout') || writeError.message.includes('Timeout')) {
                        results.rtdb = 'FAILED: Connection timeout - RTDB belum aktif / URL salah / diblokir jaringan';
                    } else if (writeError.message.includes('permission') || writeError.code === 'PERMISSION_DENIED') {
                        results.rtdb = 'FAILED: Permission denied - Update RTDB Rules di Firebase Console';
                    } else {
                        results.rtdb = `FAILED: ${writeError.message}`;
                    }
                }
            }
        }
    } catch (e: any) {
        const code = e?.code ? String(e.code) : '';
        const message = e?.message ? String(e.message) : 'Unknown error';

        // Specific error messages
        if (code === 'PERMISSION_DENIED' || message.includes('permission')) {
            results.rtdb = 'FAILED: Permission denied - Update RTDB Rules';
        } else if (message.includes('timeout') || message.includes('Timeout')) {
            results.rtdb = 'FAILED: Timeout - RTDB belum dibuat / databaseURL salah / diblokir jaringan';
        } else {
            results.rtdb = code ? `FAILED (${code}): ${message}` : `FAILED: ${message}`;
        }
    }

    return results;
};

// Delete User
export const deleteUser = async (userId: string): Promise<boolean> => {
    try {
        // Delete from Firestore
        await withTimeout(deleteDoc(doc(db, USERS_COLLECTION, userId)), 10000, 'Timeout: hapus user terlalu lama');

        // Delete from RTDB
        void withTimeout(remove(ref(rtdb, `${RTDB_PATHS.USERS}/${userId}`)), 8000, 'Timeout: hapus RTDB terlalu lama').catch(() => { });

        return true;
    } catch (error) {
        return false;
    }
};

// Toggle User Active Status
export const toggleUserStatus = async (userId: string, isActive: boolean): Promise<boolean> => {
    return updateUser(userId, { isActive });
};

// Change User Role
export const changeUserRole = async (userId: string, role: 'ADMIN' | 'MEMBER'): Promise<boolean> => {
    return updateUser(userId, { role });
};

// Set User Subscription
export const setUserSubscription = async (
    userId: string,
    durationDays: number,
    planName: string = 'Premium',
    price: number = 0,
    userEmail?: string
): Promise<boolean> => {
    try {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + durationDays);

        // Update user's subscription end date
        const updated = await updateUser(userId, {
            subscriptionEnd: endDate.toISOString()
        });
        if (!updated) return false;

        // Create subscription record
        const subscriptionData: Omit<SubscriptionRecord, 'id'> = {
            userId,
            userEmail: (userEmail || '').trim().toLowerCase(),
            planName,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            price,
            status: 'paid',
            createdAt: new Date().toISOString()
        };

        await withTimeout(addDoc(collection(db, SUBSCRIPTIONS_COLLECTION), subscriptionData), 10000, 'Timeout: simpan transaksi terlalu lama');

        return true;
    } catch (error) {
        return false;
    }
};

export const subscribeToSubscriptionRecords = (callback: (records: SubscriptionRecord[]) => void) => {
    const refCol = collection(db, SUBSCRIPTIONS_COLLECTION);
    const q = query(refCol, orderBy('createdAt', 'desc'));

    let stopped = false;

    const fetchOnce = async () => {
        if (stopped) return;
        try {
            const snapshot = await withTimeout(getDocs(q), 10000, 'Timeout: ambil transaksi terlalu lama');
            const records: SubscriptionRecord[] = [];
            snapshot.forEach((docSnap) => {
                const data: any = docSnap.data();
                records.push({
                    ...data,
                    id: docSnap.id,
                    createdAt: data?.createdAt?.toDate?.()?.toISOString?.() || data?.createdAt
                } as SubscriptionRecord);
            });
            callback(records);
        } catch (error) {
            console.error('Error fetching transactions:', error);
            callback([]);
        }
    };

    void fetchOnce();
    const intervalId = setInterval(fetchOnce, 5000);
    return () => {
        stopped = true;
        clearInterval(intervalId);
    };
};

export const calculateTotalRevenue = (records: SubscriptionRecord[]): number => {
    return records
        .filter((r) => {
            const status = String((r as any).status || '').toLowerCase();
            const isPaidLike =
                status === '' ||
                status === 'paid' ||
                status === 'active' ||
                status === 'success' ||
                status === 'settlement' ||
                status === 'completed';
            return isPaidLike && typeof r.price === 'number' && r.price > 0;
        })
        .reduce((sum, r) => sum + r.price, 0);
};

// Remove User Subscription
export const removeUserSubscription = async (userId: string): Promise<boolean> => {
    try {
        const updated = await updateUser(userId, {
            subscriptionEnd: null
        });
        return updated;
    } catch (error) {
        return false;
    }
};

// Get Admin Stats
export const getAdminStats = (users: TexaUser[], totalRevenue: number = 0): AdminStats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const activeSubscriptions = users.filter(u =>
        u.subscriptionEnd && new Date(u.subscriptionEnd) > now
    ).length;

    const expiredSubscriptions = users.filter(u =>
        u.subscriptionEnd && new Date(u.subscriptionEnd) <= now
    ).length;

    const newUsersToday = users.filter(u =>
        u.createdAt && new Date(u.createdAt) >= today
    ).length;

    const adminCount = users.filter(u => u.role === 'ADMIN').length;

    return {
        totalUsers: users.length,
        activeSubscriptions,
        expiredSubscriptions,
        totalRevenue,
        newUsersToday,
        adminCount
    };
};

// Search Users
export const searchUsers = (users: TexaUser[], searchTerm: string): TexaUser[] => {
    if (!searchTerm.trim()) return users;

    const term = searchTerm.toLowerCase();
    return users.filter(user =>
        user.email.toLowerCase().includes(term) ||
        user.name.toLowerCase().includes(term) ||
        user.id.toLowerCase().includes(term)
    );
};

// Filter Users by Status
export const filterUsersByStatus = (
    users: TexaUser[],
    filter: 'all' | 'active' | 'expired' | 'admin' | 'member'
): TexaUser[] => {
    const now = new Date();

    switch (filter) {
        case 'active':
            return users.filter(u => u.subscriptionEnd && new Date(u.subscriptionEnd) > now);
        case 'expired':
            return users.filter(u => !u.subscriptionEnd || new Date(u.subscriptionEnd) <= now);
        case 'admin':
            return users.filter(u => u.role === 'ADMIN');
        case 'member':
            return users.filter(u => u.role === 'MEMBER');
        default:
            return users;
    }
};

// Format Date for Display
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Calculate Days Remaining
export const getDaysRemaining = (endDate: string | null): number | null => {
    if (!endDate) return null;
    const now = new Date();
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
};

// Get Status Badge
export const getSubscriptionStatus = (endDate: string | null): 'active' | 'expired' | 'none' => {
    if (!endDate) return 'none';
    const daysRemaining = getDaysRemaining(endDate);
    if (daysRemaining === null || daysRemaining <= 0) return 'expired';
    return 'active';
};
