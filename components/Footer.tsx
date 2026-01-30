// Footer Component - Customizable footer with social media, contact, and maps
import { useEffect, useState } from 'react';
import { subscribeToFooterSettings, FooterSettings, SocialMediaLink, DEFAULT_FOOTER_SETTINGS } from '../services/supabaseFooterService';

export default function Footer() {
    // Use DEFAULT_FOOTER_SETTINGS as initial state so footer is always visible
    const [settings, setSettings] = useState<FooterSettings>(DEFAULT_FOOTER_SETTINGS);
    const [currentUser, setCurrentUser] = useState<{ name: string; role: string } | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeToFooterSettings((newSettings) => {
            if (newSettings) {
                setSettings(newSettings);
            }
        });

        // Get current user from localStorage (set by App.tsx)
        const userStr = localStorage.getItem('texa_current_user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                setCurrentUser({ name: user.name || user.email, role: user.role });
            } catch {
                setCurrentUser(null);
            }
        }

        return () => unsubscribe();
    }, []);

    const activeSocialMedia = settings.socialMedia.filter(sm => sm.isActive && sm.url);

    return (
        <footer className="glass border-t border-white/10 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Column - Company Info */}
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-xl font-black text-white flex items-center gap-2">
                                <span className="text-2xl">🔥</span>
                                {settings.companyName}
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">{settings.companyTagline}</p>
                        </div>

                        <div className="text-xs text-slate-500 space-y-1">
                            <p>{settings.copyrightText}</p>
                            {currentUser && (
                                <p className="text-slate-400">
                                    Logged in as: <span className="text-white font-bold">{currentUser.name}</span>
                                    {currentUser.role === 'ADMIN' && (
                                        <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold">
                                            ADMIN
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Middle Column - Contact & Address */}
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                📞 Contact Person
                            </h4>
                            <div className="space-y-2 text-sm">
                                {settings.whatsappUrl && (
                                    <a
                                        href={settings.whatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                                    >
                                        <span>💬</span>
                                        <span>CS WhatsApp</span>
                                    </a>
                                )}
                                {settings.email && (
                                    <a
                                        href={`mailto:${settings.email}`}
                                        className="flex items-center gap-2 text-sky-400 hover:text-sky-300 transition-colors"
                                    >
                                        <span>📧</span>
                                        <span>{settings.email}</span>
                                    </a>
                                )}
                                {settings.phone && (
                                    <a
                                        href={`tel:${settings.phone}`}
                                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <span>📱</span>
                                        <span>{settings.phone}</span>
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Address */}
                        <div>
                            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                📍 Address
                            </h4>
                            <div className="text-sm text-slate-400 space-y-0.5">
                                <p>{settings.addressLine1}</p>
                                {settings.addressLine2 && <p>{settings.addressLine2}</p>}
                                <p>{settings.city}, {settings.country}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Social Media & Map */}
                    <div className="space-y-4">
                        {/* Social Media */}
                        {activeSocialMedia.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-white mb-3">Follow Us</h4>
                                <div className="grid grid-cols-3 gap-2">
                                    {activeSocialMedia.map((social, index) => (
                                        <a
                                            key={index}
                                            href={social.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex flex-col items-center gap-1 p-2 rounded-lg glass border border-white/10 hover:border-indigo-500/50 transition-all group"
                                            title={social.label}
                                        >
                                            <span className="text-2xl group-hover:scale-110 transition-transform">{social.icon}</span>
                                            <span className="text-[10px] text-slate-400 group-hover:text-white font-semibold">{social.platform}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Google Maps */}
                        {settings.mapsEmbedUrl && (
                            <div>
                                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                    🗺️ Location
                                </h4>
                                <div className="rounded-xl overflow-hidden border border-white/10">
                                    <iframe
                                        src={settings.mapsEmbedUrl}
                                        width="100%"
                                        height="200"
                                        style={{ border: 0 }}
                                        allowFullScreen
                                        loading="lazy"
                                        referrerPolicy="no-referrer-when-downgrade"
                                        title="Google Maps Location"
                                        className="w-full"
                                    />
                                </div>
                                {settings.mapsUrl && (
                                    <a
                                        href={settings.mapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-indigo-400 hover:text-indigo-300 mt-2 inline-block"
                                    >
                                        View on Google Maps →
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </footer>
    );
}
