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

// Convert Supabase user to TexaUser
const mapSupabaseUser = async (user: User | null): Promise<TexaUser | null> => {
    if (!user) return null;

    try {
        // Get user profile from users table
        const { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error || !profile) {
            // Create default profile if not exists
            const userEmail = user.email || '';
            return {
                id: user.id,
                email: userEmail,
                name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
                photoURL: user.user_metadata?.avatar_url || '',
                role: checkIfAdmin(userEmail) ? 'ADMIN' : 'MEMBER',
                isActive: true,
                createdAt: user.created_at,
                lastLogin: new Date().toISOString()
            };
        }

        const userEmail = profile.email || user.email || '';
        // Auto-assign ADMIN role if email matches admin list
        const role = checkIfAdmin(userEmail) ? 'ADMIN' : (profile.role || 'MEMBER');

        return {
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
    } catch (error) {
        console.error('Error mapping Supabase user:', error);
        const userEmail = user.email || '';
        return {
            id: user.id,
            email: userEmail,
            name: user.user_metadata?.full_name || '',
            photoURL: user.user_metadata?.avatar_url || '',
            role: checkIfAdmin(userEmail) ? 'ADMIN' : 'MEMBER',
            isActive: true
        };
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

// Sign in with Google OAuth using popup
export const signInWithGoogle = async (): Promise<{ user: TexaUser | null; error: string | null }> => {
    try {
        // IMPORTANT: Open popup FIRST (synchronously from user click) to avoid
        // browser popup blockers. Browsers block window.open() if called after an await.
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        // Open blank popup immediately — this is synchronous from the click handler
        const popup = window.open(
            'about:blank',
            'Google Sign In',
            `width=${width},height=${height},left=${left},top=${top},popup=true,toolbar=no,menubar=no,location=no,status=no`
        );

        if (!popup) {
            return { user: null, error: 'Popup diblokir browser. Izinkan popup untuk situs ini.' };
        }

        // Show a loading message in the popup while we get the OAuth URL
        popup.document.write('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:white;font-family:sans-serif"><div style="text-align:center"><p style="font-size:18px">Menghubungkan ke Google...</p><p style="font-size:14px;opacity:0.6">Mohon tunggu</p></div></body></html>');

        // Build the redirect URL — Supabase will redirect here after Google auth
        const redirectUrl = window.location.origin;
        console.log('🔐 TEXA Auth: Starting Google OAuth, redirectTo:', redirectUrl);

        // Get OAuth URL without redirecting (popup is already open)
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true  // Don't redirect main window
            }
        });

        if (error) {
            console.error('❌ TEXA Auth: OAuth URL error:', error.message);
            popup.close();
            return { user: null, error: error.message };
        }

        if (!data.url) {
            popup.close();
            return { user: null, error: 'Failed to get OAuth URL' };
        }

        console.log('🔐 TEXA Auth: Navigating popup to Google OAuth');

        // Navigate the already-open popup to the OAuth URL
        popup.location.href = data.url;

        return new Promise((resolve) => {
            let resolved = false;
            let checkPopupInterval: ReturnType<typeof setInterval> | null = null;

            const cleanup = () => {
                if (checkPopupInterval) {
                    clearInterval(checkPopupInterval);
                    checkPopupInterval = null;
                }
            };

            // Helper function to close popup and focus main window
            const closePopupAndFocus = () => {
                const tryClose = () => {
                    try {
                        if (popup && !popup.closed) popup.close();
                    } catch (e) { /* ignore COOP errors */ }
                };
                tryClose();
                setTimeout(tryClose, 200);
                setTimeout(tryClose, 800);
                try { window.focus(); } catch (e) { /* ignore */ }
            };

            const finishLogin = async (session: Session) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                closePopupAndFocus();

                console.log('✅ TEXA Auth: Google login success:', session.user.email);

                const texaUser = await mapSupabaseUser(session.user);

                // Upsert user profile — PRESERVE existing role from database!
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

            // Method 1: Listen for auth state change (primary method)
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('🔐 TEXA Auth popup listener:', event);
                if (resolved) return;

                if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
                    subscription.unsubscribe();
                    await finishLogin(session);
                }
            });

            // Method 2: Poll popup URL for hash fragments (backup for COOP-blocked scenarios)
            checkPopupInterval = setInterval(async () => {
                try {
                    if (resolved) {
                        cleanup();
                        return;
                    }

                    // Check if popup was closed by user (cancelled)
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

                    // Try to read popup URL for hash fragments with tokens
                    // This works when popup redirects back to our origin
                    try {
                        const popupUrl = popup.location.href;
                        if (popupUrl && popupUrl.includes('access_token=')) {
                            console.log('🔐 TEXA Auth: Found tokens in popup URL');
                            // Extract tokens and set session
                            const hashParams = new URLSearchParams(
                                popupUrl.split('#')[1] || ''
                            );
                            const access_token = hashParams.get('access_token');
                            const refresh_token = hashParams.get('refresh_token');

                            if (access_token && refresh_token) {
                                subscription.unsubscribe();
                                cleanup();
                                closePopupAndFocus();

                                // Set session from tokens
                                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                                    access_token,
                                    refresh_token
                                });

                                if (sessionError || !sessionData.session) {
                                    if (!resolved) {
                                        resolved = true;
                                        resolve({ user: null, error: sessionError?.message || 'Failed to set session' });
                                    }
                                    return;
                                }

                                await finishLogin(sessionData.session);
                            }
                        }
                    } catch (e) {
                        // Cross-origin — can't read popup URL, rely on auth state change
                    }
                } catch (e) {
                    // COOP may block popup.closed check, just continue
                }
            }, 500);

            // Timeout after 2 minutes (reduced from 5 min — if it takes that long, something is wrong)
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
