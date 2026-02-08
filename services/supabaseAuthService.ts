// Supabase Auth Service - Complete authentication with Supabase
import { supabase } from './supabaseService';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

// User type matching existing TexaUser structure
export interface TexaUser {
    id: string;
    email: string;
    name?: string;
    photoURL?: string;
    role: 'ADMIN' | 'MEMBER';
    isActive: boolean;
    subscriptionEnd?: string;
    createdAt?: string;
    lastLogin?: string;
}

// Auth state callback type
type AuthCallback = (user: TexaUser | null) => void;

// Admin email list - users with these emails get ADMIN role automatically
// NOTE: Users can also be promoted to ADMIN via the dashboard
// Those promotions are preserved in database and not overwritten
const ADMIN_EMAILS = [
    'teknoaiglobal.adm@gmail.com',
    'teknoaiglobal@gmail.com',
    'texa.ai.adm@gmail.com'  // Added as admin
];

// Check if email is admin
const checkIfAdmin = (email: string): boolean => {
    const normalizedEmail = (email || '').toLowerCase().trim();
    if (!normalizedEmail) return false;
    return ADMIN_EMAILS.some((adminEmail) => normalizedEmail === adminEmail.toLowerCase());
};

// In-memory cache for user profile to avoid hitting DB on every auth event
let cachedProfile: { id: string; data: TexaUser } | null = null;

// Convert Supabase user to TexaUser (with cache)
const mapSupabaseUser = async (user: User | null): Promise<TexaUser | null> => {
    if (!user) return null;

    // Return cached profile if same user (avoids DB hit on TOKEN_REFRESHED etc.)
    if (cachedProfile && cachedProfile.id === user.id) {
        return cachedProfile.data;
    }

    try {
        // Get user profile from users table
        const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error || !profile) {
            const userEmail = user.email || '';
            const result: TexaUser = {
                id: user.id,
                email: userEmail,
                name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
                photoURL: user.user_metadata?.avatar_url || '',
                role: checkIfAdmin(userEmail) ? 'ADMIN' : 'MEMBER',
                isActive: true,
                createdAt: user.created_at,
                lastLogin: new Date().toISOString()
            };
            cachedProfile = { id: user.id, data: result };
            return result;
        }

        const userEmail = profile.email || user.email || '';
        const role = checkIfAdmin(userEmail) ? 'ADMIN' : (profile.role || 'MEMBER');

        const result: TexaUser = {
            id: profile.id,
            email: userEmail,
            name: profile.name || user.user_metadata?.full_name || '',
            photoURL: profile.photo_url || user.user_metadata?.avatar_url || '',
            role: role,
            isActive: profile.is_active ?? true,
            subscriptionEnd: profile.subscription_end,
            createdAt: profile.created_at,
            lastLogin: profile.last_login || new Date().toISOString()
        };
        cachedProfile = { id: user.id, data: result };
        return result;
    } catch (error) {
        console.error('Error mapping Supabase user:', error);
        const userEmail = user.email || '';
        const result: TexaUser = {
            id: user.id,
            email: userEmail,
            name: user.user_metadata?.full_name || '',
            photoURL: user.user_metadata?.avatar_url || '',
            role: checkIfAdmin(userEmail) ? 'ADMIN' : 'MEMBER',
            isActive: true
        };
        cachedProfile = { id: user.id, data: result };
        return result;
    }
};

// Sign up with email and password
export const signUp = async (email: string, password: string, name?: string): Promise<{ user: TexaUser | null; error: string | null }> => {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name || email.split('@')[0]
                }
            }
        });

        if (error) {
            return { user: null, error: error.message };
        }

        if (data.user) {
            // Create user profile in users table
            const userEmail = data.user.email || email;
            await supabase.from('users').upsert({
                id: data.user.id,
                email: userEmail,
                name: name || email.split('@')[0],
                role: checkIfAdmin(userEmail) ? 'ADMIN' : 'MEMBER',
                is_active: true,
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString()
            });

            const texaUser = await mapSupabaseUser(data.user);
            return { user: texaUser, error: null };
        }

        return { user: null, error: 'Sign up failed' };
    } catch (error: any) {
        return { user: null, error: error.message || 'Sign up failed' };
    }
};

// Sign in with email and password
export const signIn = async (email: string, password: string): Promise<{ user: TexaUser | null; error: string | null }> => {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return { user: null, error: error.message };
        }

        if (data.user) {
            // Update last login
            await supabase.from('users').update({
                last_login: new Date().toISOString()
            }).eq('id', data.user.id);

            const texaUser = await mapSupabaseUser(data.user);
            return { user: texaUser, error: null };
        }

        return { user: null, error: 'Sign in failed' };
    } catch (error: any) {
        return { user: null, error: error.message || 'Sign in failed' };
    }
};

// Sign in with Google OAuth — redirect-based for production, popup for localhost
export const signInWithGoogle = async (): Promise<{ user: TexaUser | null; error: string | null }> => {
    try {
        const redirectUrl = window.location.origin;
        const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        console.log('🔐 TEXA Auth: Starting Google OAuth, redirectTo:', redirectUrl, 'isLocalDev:', isLocalDev);

        if (!isLocalDev) {
            // ── PRODUCTION: Use redirect flow (no popup) ──
            // This avoids COOP issues on custom domains like www.texa.studio
            // After Google auth, browser redirects back to our origin
            // onAuthChange in App.tsx will automatically pick up the session
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl
                    // skipBrowserRedirect is NOT set — we WANT the redirect
                }
            });

            if (error) {
                console.error('❌ TEXA Auth: OAuth redirect error:', error.message);
                return { user: null, error: error.message };
            }

            // The browser will navigate away now — this code won't execute
            // But we return a "pending" result just in case
            return { user: null, error: null };
        }

        // ── LOCALHOST: Use popup flow (COOP is not an issue on localhost) ──
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true
            }
        });

        if (error) {
            console.error('❌ TEXA Auth: OAuth URL error:', error.message);
            return { user: null, error: error.message };
        }

        if (!data.url) {
            return { user: null, error: 'Failed to get OAuth URL' };
        }

        console.log('🔐 TEXA Auth: Opening popup for Google OAuth (localhost)');

        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            data.url,
            'Google Sign In',
            `width=${width},height=${height},left=${left},top=${top},popup=true,toolbar=no,menubar=no,location=no,status=no`
        );

        if (!popup) {
            return { user: null, error: 'Popup blocked. Please allow popups for this site.' };
        }

        return new Promise((resolve) => {
            let resolved = false;
            let checkPopupInterval: ReturnType<typeof setInterval> | null = null;

            const cleanup = () => {
                if (checkPopupInterval) {
                    clearInterval(checkPopupInterval);
                    checkPopupInterval = null;
                }
            };

            const closePopupAndFocus = () => {
                try { if (popup && !popup.closed) popup.close(); } catch (e) { /* ignore */ }
                try { window.focus(); } catch (e) { /* ignore */ }
            };

            const finishLogin = async (session: Session) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                closePopupAndFocus();

                console.log('✅ TEXA Auth: Google login success:', session.user.email);
                const texaUser = await mapSupabaseUser(session.user);

                // Upsert user profile
                try {
                    const { data: existingUser } = await supabase
                        .from('users')
                        .select('role')
                        .eq('id', session.user.id)
                        .single();

                    const roleToUse = existingUser?.role ||
                        (checkIfAdmin(session.user.email || '') ? 'ADMIN' : 'MEMBER');

                    await supabase.from('users').upsert({
                        id: session.user.id,
                        email: session.user.email,
                        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
                        photo_url: session.user.user_metadata?.avatar_url,
                        role: roleToUse,
                        last_login: new Date().toISOString()
                    }, { onConflict: 'id' });
                } catch (e) {
                    console.warn('⚠️ TEXA Auth: Failed to upsert user profile:', e);
                }

                resolve({ user: texaUser, error: null });
            };

            // Listen for auth state change
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('🔐 TEXA Auth popup listener:', event);
                if (resolved) return;
                if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
                    subscription.unsubscribe();
                    await finishLogin(session);
                }
            });

            // Poll for popup closed
            checkPopupInterval = setInterval(async () => {
                try {
                    if (resolved) { cleanup(); return; }
                    if (popup.closed) {
                        if (!resolved) {
                            resolved = true;
                            subscription.unsubscribe();
                            cleanup();
                            window.focus();
                            resolve({ user: null, error: 'Login dibatalkan' });
                        }
                        return;
                    }

                    // Try reading popup URL for hash tokens
                    try {
                        const popupUrl = popup.location.href;
                        if (popupUrl && popupUrl.includes('access_token=')) {
                            console.log('🔐 TEXA Auth: Found tokens in popup URL');
                            const hashParams = new URLSearchParams(popupUrl.split('#')[1] || '');
                            const access_token = hashParams.get('access_token');
                            const refresh_token = hashParams.get('refresh_token');

                            if (access_token && refresh_token) {
                                // Mark resolved BEFORE async calls to prevent race
                                if (resolved) return;
                                resolved = true;

                                subscription.unsubscribe();
                                cleanup();
                                closePopupAndFocus();

                                console.log('🔐 TEXA Auth: Setting session with tokens...');
                                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                                    access_token,
                                    refresh_token
                                });

                                if (sessionError || !sessionData.session) {
                                    console.error('❌ TEXA Auth: setSession failed:', sessionError?.message);
                                    resolve({ user: null, error: sessionError?.message || 'Failed to set session' });
                                    return;
                                }

                                console.log('🔐 TEXA Auth: Session set, finishing login...');
                                try {
                                    await finishLogin(sessionData.session);
                                } catch (finishError: any) {
                                    console.error('❌ TEXA Auth: finishLogin failed:', finishError);
                                    resolve({ user: null, error: finishError.message || 'Failed to complete login' });
                                }
                            }
                        }
                    } catch (e: any) {
                        // Expected: Cross-origin prevents reading popup.location.href
                        // Silently ignore unless it's NOT a cross-origin error
                        if (e.message && !e.message.includes('cross-origin')) {
                            console.warn('⚠️ TEXA Auth: Popup URL check error:', e.message);
                        }
                    }
                } catch (e: any) {
                    // Expected: COOP may block popup.closed check
                    // Log only unexpected errors
                    if (e.message && !e.message.includes('COOP') && !e.message.includes('Cross-Origin-Opener-Policy')) {
                        console.warn('⚠️ TEXA Auth: Polling error:', e.message);
                    }
                }
            }, 500);

            // Timeout after 2 minutes
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    subscription.unsubscribe();
                    cleanup();
                    closePopupAndFocus();
                    resolve({ user: null, error: 'Login timeout. Silakan coba lagi.' });
                }
            }, 120000);
        });
    } catch (error: any) {
        console.error('❌ TEXA Auth: Google sign in error:', error);
        return { user: null, error: error.message || 'Google sign in failed' };
    }
};

// Sign out — use global scope to clear all sessions (tabs, popup, etc.)
export const signOut = async (): Promise<{ error: string | null }> => {
    try {
        console.log('🔐 TEXA Auth: Signing out (global scope)...');
        cachedProfile = null; // Clear profile cache
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) {
            console.error('❌ TEXA Auth: Sign out error:', error.message);
            // Still try local signout as fallback
            await supabase.auth.signOut({ scope: 'local' }).catch(() => { });
            return { error: error.message };
        }
        console.log('✅ TEXA Auth: Signed out successfully');
        return { error: null };
    } catch (error: any) {
        console.error('❌ TEXA Auth: Sign out exception:', error);
        // Fallback: force local signout
        await supabase.auth.signOut({ scope: 'local' }).catch(() => { });
        return { error: error.message || 'Sign out failed' };
    }
};

// Get current session
export const getSession = async (): Promise<Session | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    } catch (error) {
        console.error('Error getting session:', error);
        return null;
    }
};

// Get current user
export const getCurrentUser = async (): Promise<TexaUser | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return await mapSupabaseUser(user);
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
};

// Listen to auth state changes
// Fixed: removed hasCalledBack race condition, use lastUserId for de-duplication
export const onAuthChange = (callback: AuthCallback): (() => void) => {
    let lastUserId: string | null = null;
    let initialSessionHandled = false;

    // Subscribe to auth changes — this is the SINGLE source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, session: Session | null) => {
            console.log('🔐 TEXA Auth state change:', event, session?.user?.email || 'no user');

            try {
                if (event === 'INITIAL_SESSION') {
                    initialSessionHandled = true;
                    if (session?.user) {
                        lastUserId = session.user.id;
                        const user = await mapSupabaseUser(session.user);
                        // Upsert profile in background (don't block callback)
                        upsertUserProfile(session.user).catch(() => { });
                        callback(user);
                    } else {
                        // No stored session — user is not logged in
                        lastUserId = null;
                        callback(null);
                    }
                } else if (event === 'SIGNED_IN') {
                    if (session?.user) {
                        // Only fire callback if user actually changed (avoid duplicate fires)
                        const isNewUser = lastUserId !== session.user.id;
                        lastUserId = session.user.id;

                        const user = await mapSupabaseUser(session.user);
                        upsertUserProfile(session.user).catch(() => { });
                        callback(user);

                        if (isNewUser) {
                            console.log('✅ TEXA Auth: New login:', session.user.email);
                        }
                    }
                } else if (event === 'TOKEN_REFRESHED') {
                    if (session?.user) {
                        lastUserId = session.user.id;
                        const user = await mapSupabaseUser(session.user);
                        callback(user);
                        console.log('🔄 TEXA Auth: Token refreshed for:', session.user.email);
                    }
                } else if (event === 'SIGNED_OUT') {
                    console.log('🔐 TEXA Auth: User signed out');
                    lastUserId = null;
                    callback(null);
                }
            } catch (error) {
                console.error('❌ TEXA Auth state change error:', error);
                // Don't leave app in broken state — still fire callback
                if (event === 'SIGNED_OUT' || !session?.user) {
                    callback(null);
                }
            }
        }
    );

    // Fallback: if INITIAL_SESSION doesn't fire within 3s, try getSession
    const fallbackTimeout = setTimeout(async () => {
        if (!initialSessionHandled) {
            console.warn('⚠️ TEXA Auth: INITIAL_SESSION not received, using getSession fallback');
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    lastUserId = session.user.id;
                    const user = await mapSupabaseUser(session.user);
                    callback(user);
                } else {
                    callback(null);
                }
            } catch (e) {
                console.error('❌ TEXA Auth fallback getSession error:', e);
                callback(null);
            }
            initialSessionHandled = true;
        }
    }, 3000);

    return () => {
        clearTimeout(fallbackTimeout);
        subscription.unsubscribe();
    };
};

// Helper: upsert user profile to database (non-blocking)
async function upsertUserProfile(user: User): Promise<void> {
    try {
        await supabase.from('users').upsert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0],
            photo_url: user.user_metadata?.avatar_url,
            last_login: new Date().toISOString()
        }, { onConflict: 'id' });
    } catch (error) {
        console.warn('⚠️ TEXA Auth: Failed to upsert user profile:', error);
    }
}

// Update user profile
export const updateUserProfile = async (userId: string, updates: Partial<TexaUser>): Promise<boolean> => {
    try {
        const updateData: any = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.photoURL !== undefined) updateData.photo_url = updates.photoURL;
        if (updates.role !== undefined) updateData.role = updates.role;
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
        if (updates.subscriptionEnd !== undefined) updateData.subscription_end = updates.subscriptionEnd;

        const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);

        if (error) {
            console.error('Error updating user profile:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error updating user profile:', error);
        return false;
    }
};

// Check if user is admin
export const isAdmin = async (userId: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();

        if (error || !data) return false;
        return data.role === 'ADMIN';
    } catch (error) {
        return false;
    }
};

// Get user by ID
export const getUserById = async (userId: string): Promise<TexaUser | null> => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            email: data.email,
            name: data.name,
            photoURL: data.photo_url,
            role: data.role || 'MEMBER',
            isActive: data.is_active ?? true,
            subscriptionEnd: data.subscription_end,
            createdAt: data.created_at,
            lastLogin: data.last_login
        };
    } catch (error) {
        console.error('Error getting user by ID:', error);
        return null;
    }
};

// Export for compatibility
export { supabase };
