// Firebase Configuration for TEXA-Ai
// ============================================
// PANDUAN: Untuk menggunakan Firebase project yang berbeda:
// 1. Buat project baru di https://console.firebase.google.com
// 2. Enable Authentication (Google & Email/Password)
// 3. Buat Firestore Database
// 4. Buat Realtime Database (opsional)
// 5. Copy konfigurasi ke file ini atau gunakan environment variables
// ============================================

import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
  Auth
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  deleteDoc,
  getDocs,
  setDoc,
  getDoc,
  query,
  where,
  limit,
  Firestore
} from "firebase/firestore/lite";
import { getDatabase, ref, set, update, Database } from "firebase/database";

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

const getAuthErrorMessage = (error: any, fallbackMessage: string): string => {
  const code = error?.code as string | undefined;

  if (code === 'auth/invalid-credential') return 'Email atau password salah';
  if (code === 'auth/user-not-found') return 'Email tidak terdaftar';
  if (code === 'auth/wrong-password') return 'Password salah';
  if (code === 'auth/invalid-email') return 'Format email tidak valid';
  if (code === 'auth/too-many-requests') return 'Terlalu banyak percobaan. Coba lagi nanti.';
  if (code === 'auth/popup-closed-by-user') return 'Popup login ditutup sebelum selesai';
  if (code === 'auth/cancelled-popup-request') return 'Permintaan login dibatalkan';
  if (code === 'auth/account-exists-with-different-credential') return 'Akun ini sudah terdaftar dengan metode login lain';
  if (code === 'auth/operation-not-allowed') return 'Metode login ini belum diaktifkan di Firebase';
  if (code === 'auth/unauthorized-domain') return 'Domain ini belum diizinkan di Firebase Auth';

  return fallbackMessage;
};

// ============================================
// FIREBASE CONFIGURATION
// ============================================
// TEXA-Ai menggunakan project: texa-ai (PRIMARY)
// ============================================

// Primary Config - NEW MAIN DATABASE (texa-ai)
const PRIMARY_CONFIG = {
  apiKey: "AIzaSyAUSD1JPLIM3JstfC5vG_jdnek0FrcNdHA",
  authDomain: "texa-ai.firebaseapp.com",
  databaseURL: "https://texa-ai-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "texa-ai",
  storageBucket: "texa-ai.firebasestorage.app",
  messagingSenderId: "727237042267",
  appId: "1:727237042267:web:244ccca7363b20377f9f7e"
};

// Backup Config 1 - texa-ai
const BACKUP_CONFIG_1 = {
  apiKey: "AIzaSyAUSD1JPLIM3JstfC5vG_jdnek0FrcNdHA",
  authDomain: "texa-ai.firebaseapp.com",
  projectId: "texa-ai",
  storageBucket: "texa-ai.firebasestorage.app",
  messagingSenderId: "727237042267",
  appId: "1:727237042267:web:244ccca7363b20377f9f7e"
};

// Backup Config 2 - texa-ai
const BACKUP_CONFIG_2 = {
  apiKey: "AIzaSyAUSD1JPLIM3JstfC5vG_jdnek0FrcNdHA",
  authDomain: "texa-ai.firebaseapp.com",
  databaseURL: "https://texa-ai-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "texa-ai",
  storageBucket: "texa-ai.firebasestorage.app",
  messagingSenderId: "727237042267",
  appId: "1:727237042267:web:244ccca7363b20377f9f7e"
};

// For backward compatibility
const BACKUP_CONFIG = BACKUP_CONFIG_2;

// ============================================
// 🔥 ACTIVE FIREBASE CONFIG
// ============================================
// Menggunakan PRIMARY_CONFIG (texa-ai) untuk TEXA-Ai
// ============================================

const TEXA_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || PRIMARY_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || PRIMARY_CONFIG.authDomain,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || PRIMARY_CONFIG.databaseURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || PRIMARY_CONFIG.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || PRIMARY_CONFIG.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || PRIMARY_CONFIG.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || PRIMARY_CONFIG.appId
};

// ============================================
// COLLECTION NAMES (dengan prefix untuk isolasi)
// ============================================
export const COLLECTIONS = {
  USERS: 'texa_users',           // User profiles dan subscription
  CATALOG: 'texa_catalog',       // AI Tools catalog
  CATEGORIES: 'texa_categories', // Tool categories (custom/dynamic)
  DOCK_ITEMS: 'texa_dock_items', // Floating dock shortcuts
  FOOTER_SETTINGS: 'texa_footer_settings', // Footer customization
  SETTINGS: 'texa_settings',     // Subscription settings
  TRANSACTIONS: 'texa_transactions',  // Payment transactions
  LOGS: 'texa_activity_logs'     // Activity logs
} as const;

// RTDB Paths
export const RTDB_PATHS = {
  USERS: 'texa_users',
  SESSIONS: 'texa_sessions',
  ONLINE: 'texa_online',
  TOKENS: 'texa_tokens'
} as const;

// ============================================
// INITIALIZE FIREBASE - PRIMARY (texa-ai)
// ============================================
const app: FirebaseApp = initializeApp(TEXA_FIREBASE_CONFIG);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const rtdb: Database = getDatabase(app, TEXA_FIREBASE_CONFIG.databaseURL);

// ============================================
// INITIALIZE FIREBASE - BACKUP 1 (texa-ai)
// ============================================
const backupApp1: FirebaseApp = initializeApp(BACKUP_CONFIG_1, 'backup1');
export const backupDb1: Firestore = getFirestore(backupApp1);

// ============================================
// INITIALIZE FIREBASE - BACKUP 2 (texa-ai)
// ============================================
const backupApp2: FirebaseApp = initializeApp(BACKUP_CONFIG_2, 'backup2');
export const backupDb: Firestore = getFirestore(backupApp2);
export const backupRtdb: Database = getDatabase(backupApp2, BACKUP_CONFIG_2.databaseURL);

// Log active projects (development only)
if (import.meta.env.DEV) {
  console.log('🔥 Firebase Primary:', TEXA_FIREBASE_CONFIG.projectId);
  console.log('🔥 Firebase Backup 1:', BACKUP_CONFIG_1.projectId);
  console.log('🔥 Firebase Backup 2:', BACKUP_CONFIG_2.projectId);
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// User Role Type
export type UserRole = 'ADMIN' | 'MEMBER';

// User Interface
export interface TexaUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  subscriptionEnd: string | null;
  isActive: boolean;
  photoURL?: string;
  createdAt?: string;
  lastLogin?: string;
}

const ADMIN_EMAILS = [
  'teknoaiglobal.adm@gmail.com'
];

const normalizeEmail = (email: string) => (email || '').toLowerCase().trim();

// Check if user is admin
const checkIfAdmin = (email: string): boolean => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;

  return ADMIN_EMAILS.some((adminEmail) => normalizedEmail === adminEmail.toLowerCase());
};

// Create or Update User in Firestore
const saveUserToDatabase = async (firebaseUser: FirebaseUser, additionalData?: Partial<TexaUser>): Promise<TexaUser> => {
  const userRef = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
  const userSnap = await withTimeout(getDoc(userRef), 8000);

  const normalizedEmail = normalizeEmail(firebaseUser.email || '');
  const isAdmin = checkIfAdmin(normalizedEmail);

  let preCreatedDoc: { id: string; data: Partial<TexaUser> } | null = null;
  if (normalizedEmail) {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('email', '==', normalizedEmail), limit(5));
    const snap = await withTimeout(getDocs(q), 8000);
    for (const d of snap.docs) {
      if (d.id !== firebaseUser.uid) {
        preCreatedDoc = { id: d.id, data: d.data() as Partial<TexaUser> };
        break;
      }
    }
  }

  const userData: TexaUser = {
    id: firebaseUser.uid,
    email: normalizedEmail || firebaseUser.email || '',
    name: firebaseUser.displayName || additionalData?.name || preCreatedDoc?.data?.name || 'Pengguna Baru',
    role: isAdmin ? 'ADMIN' : 'MEMBER',
    subscriptionEnd: null,
    isActive: true,
    lastLogin: new Date().toISOString(),
    ...additionalData
  };

  if (preCreatedDoc?.data) {
    if (preCreatedDoc.data.subscriptionEnd) userData.subscriptionEnd = preCreatedDoc.data.subscriptionEnd;
    if (typeof preCreatedDoc.data.isActive === 'boolean') userData.isActive = preCreatedDoc.data.isActive;
    if (preCreatedDoc.data.createdAt) userData.createdAt = preCreatedDoc.data.createdAt;
  }

  // Only add photoURL if it exists
  if (firebaseUser.photoURL) {
    userData.photoURL = firebaseUser.photoURL;
  }

  if (!userSnap.exists()) {
    // New user - create document
    userData.createdAt = userData.createdAt || new Date().toISOString();
    const cleanData = Object.fromEntries(
      Object.entries(userData).filter(([_, v]) => v !== undefined)
    );
    await withTimeout(setDoc(userRef, cleanData), 8000);

    // Also save to Realtime Database (Primary) - with safety check
    if (rtdb) {
      void withTimeout(set(ref(rtdb, `${RTDB_PATHS.USERS}/${firebaseUser.uid}`), {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        isActive: userData.isActive,
        lastLogin: userData.lastLogin
      }), 8000).catch(() => { });
    }

    // Also save to Backup RTDB (tekno-335f8) - with safety check
    if (backupRtdb) {
      void withTimeout(set(ref(backupRtdb, `texa_users/${firebaseUser.uid}`), {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        isActive: userData.isActive,
        lastLogin: userData.lastLogin,
        createdAt: userData.createdAt
      }), 8000).catch(() => { });
    }
  } else {
    // Existing user - update last login
    await withTimeout(setDoc(userRef, {
      email: userData.email,
      role: userData.role,
      lastLogin: userData.lastLogin,
      ...(preCreatedDoc?.data?.subscriptionEnd ? { subscriptionEnd: preCreatedDoc.data.subscriptionEnd } : {}),
      ...(typeof preCreatedDoc?.data?.isActive === 'boolean' ? { isActive: preCreatedDoc.data.isActive } : {}),
      ...(preCreatedDoc?.data?.createdAt ? { createdAt: preCreatedDoc.data.createdAt } : {})
    }, { merge: true }), 8000);

    // Update RTDB (Primary) - with safety check
    if (rtdb) {
      void withTimeout(set(ref(rtdb, `${RTDB_PATHS.USERS}/${firebaseUser.uid}/lastLogin`), userData.lastLogin), 8000).catch(() => { });
    }

    // Update Backup RTDB - with safety check
    if (backupRtdb) {
      void withTimeout(set(ref(backupRtdb, `texa_users/${firebaseUser.uid}/lastLogin`), userData.lastLogin), 8000).catch(() => { });
    }
  }

  if (preCreatedDoc?.id) {
    try {
      await withTimeout(deleteDoc(doc(db, COLLECTIONS.USERS, preCreatedDoc.id)), 8000);
    } catch {
    }
  }

  const updatedSnap = await withTimeout(getDoc(userRef), 8000);
  return updatedSnap.data() as TexaUser;
};

// Google Sign In
export const signInWithGoogle = async (): Promise<TexaUser> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    void saveUserToDatabase(user).catch(() => { });
    const existing = await getCurrentUserData(user.uid);
    if (existing) return existing;
    return {
      id: user.uid,
      email: (user.email || '').trim().toLowerCase(),
      name: user.displayName || 'Pengguna',
      role: checkIfAdmin(user.email || '') ? 'ADMIN' : 'MEMBER',
      subscriptionEnd: null,
      isActive: true,
      photoURL: user.photoURL || undefined,
      lastLogin: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    throw new Error(getAuthErrorMessage(error, 'Gagal login dengan Google'));
  }
};

// Email/Password Sign In
export const signInWithEmail = async (email: string, password: string): Promise<TexaUser> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    void saveUserToDatabase(user).catch(() => { });
    const existing = await getCurrentUserData(user.uid);
    if (existing) return existing;
    return {
      id: user.uid,
      email: (user.email || '').trim().toLowerCase(),
      name: user.displayName || 'Pengguna',
      role: checkIfAdmin(user.email || '') ? 'ADMIN' : 'MEMBER',
      subscriptionEnd: null,
      isActive: true,
      photoURL: user.photoURL || undefined,
      lastLogin: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Email Sign In Error:', error);
    throw new Error(getAuthErrorMessage(error, 'Gagal login'));
  }
};

// Email/Password Sign Up
export const signUpWithEmail = async (email: string, password: string, name: string): Promise<TexaUser> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    await updateProfile(user, { displayName: name });
    void saveUserToDatabase(user, { name }).catch(() => { });
    return {
      id: user.uid,
      email: (user.email || '').trim().toLowerCase(),
      name,
      role: checkIfAdmin(user.email || '') ? 'ADMIN' : 'MEMBER',
      subscriptionEnd: null,
      isActive: true,
      photoURL: user.photoURL || undefined,
      lastLogin: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Email Sign Up Error:', error);
    const code = error?.code as string | undefined;
    if (code === 'auth/email-already-in-use') throw new Error('Email sudah terdaftar');
    if (code === 'auth/weak-password') throw new Error('Password minimal 6 karakter');

    throw new Error(getAuthErrorMessage(error, 'Gagal mendaftar'));
  }
};

// Sign Out
export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign Out Error:', error);
    throw new Error(getAuthErrorMessage(error, 'Gagal logout'));
  }
};

export const sendResetPassword = async (email: string): Promise<void> => {
  try {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) throw new Error('Email tidak valid');
    await sendPasswordResetEmail(auth, normalizedEmail);
  } catch (error: any) {
    console.error('Reset Password Error:', error);
    throw new Error(getAuthErrorMessage(error, 'Gagal mengirim email reset password'));
  }
};

// Get Current User Data from Firestore
export const getCurrentUserData = async (uid: string): Promise<TexaUser | null> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const userSnap = await withTimeout(getDoc(userRef), 8000);

    if (userSnap.exists()) {
      return userSnap.data() as TexaUser;
    }
    return null;
  } catch (error) {
    console.error('Get User Data Error:', error);
    return null;
  }
};

// Auth State Observer
export const onAuthChange = (callback: (user: TexaUser | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const texaUser = await getCurrentUserData(firebaseUser.uid);
        if (texaUser) {
          const email = normalizeEmail(texaUser.email || firebaseUser.email || '');
          const role: UserRole = checkIfAdmin(email) ? 'ADMIN' : 'MEMBER';
          const safeUser: TexaUser = {
            ...texaUser,
            email: email || texaUser.email,
            role
          };
          callback(safeUser);
          void saveUserToDatabase(firebaseUser).catch(() => { });
        } else {
          try {
            const newUser = await withTimeout(saveUserToDatabase(firebaseUser), 10000);
            callback(newUser);
          } catch (saveError) {
            console.warn('Could not save user to Firestore:', saveError);
            const fallbackUser: TexaUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'Pengguna',
              role: checkIfAdmin(firebaseUser.email || '') ? 'ADMIN' : 'MEMBER',
              subscriptionEnd: null,
              isActive: true,
              photoURL: firebaseUser.photoURL || undefined,
              lastLogin: new Date().toISOString()
            };
            callback(fallbackUser);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        const fallbackUser: TexaUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Pengguna',
          role: checkIfAdmin(firebaseUser.email || '') ? 'ADMIN' : 'MEMBER',
          subscriptionEnd: null,
          isActive: true,
          photoURL: firebaseUser.photoURL || undefined,
          lastLogin: new Date().toISOString()
        };
        callback(fallbackUser);
      }
    } else {
      callback(null);
    }
  });
};

// Export config info for debugging
export const getFirebaseInfo = () => ({
  primary: {
    projectId: TEXA_FIREBASE_CONFIG.projectId,
    collections: COLLECTIONS,
    rtdbPaths: RTDB_PATHS
  },
  backup: {
    projectId: BACKUP_CONFIG.projectId,
    databaseURL: BACKUP_CONFIG.databaseURL
  }
});

// ============================================
// DUAL DATABASE HELPERS
// ============================================

// Save to backup RTDB
export const saveToBackupRtdb = async (path: string, data: any): Promise<void> => {
  try {
    const dbRef = ref(backupRtdb, path);
    await set(dbRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
    console.log('📦 Saved to backup RTDB:', path);
  } catch (error) {
    console.error('Backup RTDB save error:', error);
    throw error;
  }
};

// Update backup RTDB
export const updateBackupRtdb = async (path: string, data: any): Promise<void> => {
  try {
    const dbRef = ref(backupRtdb, path);
    await update(dbRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Backup RTDB update error:', error);
    throw error;
  }
};

// Sync user to backup
export const syncUserToBackup = async (user: TexaUser): Promise<void> => {
  try {
    await saveToBackupRtdb(`texa_users/${user.id}`, user);
  } catch (error) {
    console.warn('Failed to sync user to backup:', error);
  }
};

export default app;
