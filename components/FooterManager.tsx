// FooterManager - Admin interface for managing footer settings
import { useEffect, useState } from 'react';
import {
    getFooterSettings,
    updateFooterSettings,
    updateSocialMediaLink,
    DEFAULT_FOOTER_SETTINGS,
    FooterSettings,
    SocialMediaLink
} from '../services/supabaseFooterService';

interface FooterManagerProps {
    showToast: (message: string, type: 'success' | 'error') => void;
}

export default function FooterManager({ showToast }: FooterManagerProps) {
    const [settings, setSettings] = useState<FooterSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [companyName, setCompanyName] = useState('');
    const [companyTagline, setCompanyTagline] = useState('');
    const [copyrightText, setCopyrightText] = useState('');
    const [whatsappUrl, setWhatsappUrl] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [city, setCity] = useState('');
    const [country, setCountry] = useState('');
    const [mapsUrl, setMapsUrl] = useState('');
    const [mapsEmbedUrl, setMapsEmbedUrl] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        setError(null);

        try {
            const timeoutPromise = new Promise<null>((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout - database may be unavailable')), 10000);
            });

            const data = await Promise.race([
                getFooterSettings(),
                timeoutPromise
            ]);

            if (data) {
                setSettings(data);
                // Populate form
                setCompanyName(data.companyName);
                setCompanyTagline(data.companyTagline);
                setCopyrightText(data.copyrightText);
                setWhatsappUrl(data.whatsappUrl);
                setEmail(data.email || '');
                setPhone(data.phone || '');
                setAddressLine1(data.addressLine1);
                setAddressLine2(data.addressLine2 || '');
                setCity(data.city);
                setCountry(data.country);
                setMapsUrl(data.mapsUrl);
                setMapsEmbedUrl(data.mapsEmbedUrl);
            } else {
                setSettings(DEFAULT_FOOTER_SETTINGS);
                setCompanyName(DEFAULT_FOOTER_SETTINGS.companyName);
                setCompanyTagline(DEFAULT_FOOTER_SETTINGS.companyTagline);
                setCopyrightText(DEFAULT_FOOTER_SETTINGS.copyrightText);
                setWhatsappUrl(DEFAULT_FOOTER_SETTINGS.whatsappUrl);
                setEmail(DEFAULT_FOOTER_SETTINGS.email || '');
                setPhone(DEFAULT_FOOTER_SETTINGS.phone || '');
                setAddressLine1(DEFAULT_FOOTER_SETTINGS.addressLine1);
                setAddressLine2(DEFAULT_FOOTER_SETTINGS.addressLine2 || '');
                setCity(DEFAULT_FOOTER_SETTINGS.city);
                setCountry(DEFAULT_FOOTER_SETTINGS.country);
                setMapsUrl(DEFAULT_FOOTER_SETTINGS.mapsUrl);
                setMapsEmbedUrl(DEFAULT_FOOTER_SETTINGS.mapsEmbedUrl);
                setError(null);
                showToast('⚠️ No data returned from database, using defaults', 'error');
            }
        } catch (err: any) {
            console.error('Error loading footer settings:', err);
            const errorMsg = err?.message || 'Failed to load settings';
            showToast('⚠️ ' + errorMsg, 'error');
            setSettings(DEFAULT_FOOTER_SETTINGS);
            setCompanyName(DEFAULT_FOOTER_SETTINGS.companyName);
            setCompanyTagline(DEFAULT_FOOTER_SETTINGS.companyTagline);
            setCopyrightText(DEFAULT_FOOTER_SETTINGS.copyrightText);
            setWhatsappUrl(DEFAULT_FOOTER_SETTINGS.whatsappUrl);
            setEmail(DEFAULT_FOOTER_SETTINGS.email || '');
            setPhone(DEFAULT_FOOTER_SETTINGS.phone || '');
            setAddressLine1(DEFAULT_FOOTER_SETTINGS.addressLine1);
            setAddressLine2(DEFAULT_FOOTER_SETTINGS.addressLine2 || '');
            setCity(DEFAULT_FOOTER_SETTINGS.city);
            setCountry(DEFAULT_FOOTER_SETTINGS.country);
            setMapsUrl(DEFAULT_FOOTER_SETTINGS.mapsUrl);
            setMapsEmbedUrl(DEFAULT_FOOTER_SETTINGS.mapsEmbedUrl);
            setError(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveBasicInfo = async () => {
        setSaving(true);
        try {
            const success = await updateFooterSettings({
                companyName,
                companyTagline,
                copyrightText
            });

            if (success) {
                showToast('✅ Company info updated!', 'success');
                await loadSettings();
            } else {
                showToast('❌ Failed to update', 'error');
            }
        } catch (err) {
            showToast('❌ Error updating company info', 'error');
        }
        setSaving(false);
    };

    const handleSaveContact = async () => {
        setSaving(true);
        try {
            const success = await updateFooterSettings({
                whatsappUrl,
                email,
                phone
            });

            if (success) {
                showToast('✅ Contact info updated!', 'success');
                await loadSettings();
            } else {
                showToast('❌ Failed to update', 'error');
            }
        } catch (err) {
            showToast('❌ Error updating contact info', 'error');
        }
        setSaving(false);
    };

    const handleSaveAddress = async () => {
        setSaving(true);
        try {
            const success = await updateFooterSettings({
                addressLine1,
                addressLine2,
                city,
                country
            });

            if (success) {
                showToast('✅ Address updated!', 'success');
                await loadSettings();
            } else {
                showToast('❌ Failed to update', 'error');
            }
        } catch (err) {
            showToast('❌ Error updating address', 'error');
        }
        setSaving(false);
    };

    const handleSaveMaps = async () => {
        setSaving(true);
        try {
            const success = await updateFooterSettings({
                mapsUrl,
                mapsEmbedUrl
            });

            if (success) {
                showToast('✅ Maps updated!', 'success');
                await loadSettings();
            } else {
                showToast('❌ Failed to update', 'error');
            }
        } catch (err) {
            showToast('❌ Error updating maps', 'error');
        }
        setSaving(false);
    };

    const handleUpdateSocialMedia = async (platform: string, field: keyof SocialMediaLink, value: any) => {
        if (!settings) return;

        const social = settings.socialMedia.find(s => s.platform === platform);
        if (!social) return;

        try {
            const success = await updateSocialMediaLink(platform, { [field]: value });
            if (success) {
                await loadSettings();
            }
        } catch (err) {
            showToast('❌ Error updating social media', 'error');
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent" />
                <p className="text-slate-400 text-sm">Loading footer settings...</p>
                <p className="text-slate-500 text-xs">This may take a few seconds</p>
            </div>
        );
    }

    // Error state with retry
    if (error || !settings) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="text-6xl">⚠️</div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-white">Failed to Load Footer Settings</h3>
                    <p className="text-slate-400 max-w-md">
                        {error || 'Could not connect to database'}
                    </p>
                    <div className="glass rounded-xl p-4 mt-4 max-w-lg">
                        <p className="text-sm text-slate-300 mb-2">⚠️ <strong>Possible Issues:</strong></p>
                        <ul className="text-xs text-slate-400 text-left space-y-1">
                            <li>• Database quota exceeded (check Supabase project)</li>
                            <li>• Network connection issues</li>
                            <li>• Database not configured correctly</li>
                            <li>• Access rules blocking requests</li>
                        </ul>
                    </div>
                </div>
                <button
                    onClick={() => loadSettings()}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors"
                >
                    🔄 Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <span>📄</span>
                    Kelola Footer
                </h2>
                <p className="text-slate-400 mt-1">Customize footer information, contact details, and social media links</p>
            </div>

            {/* Company Information */}
            <div className="glass rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    🏢 Company Information
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Company Name</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="TEXA-Ai"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Tagline</label>
                        <textarea
                            value={companyTagline}
                            onChange={(e) => setCompanyTagline(e.target.value)}
                            rows={2}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Premium AI Tools Marketplace & Digital Creator"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Copyright Text</label>
                        <input
                            type="text"
                            value={copyrightText}
                            onChange={(e) => setCopyrightText(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="© 2025 Texa Group. All rights reserved."
                        />
                    </div>
                    <button
                        onClick={handleSaveBasicInfo}
                        disabled={saving}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Company Info'}
                    </button>
                </div>
            </div>

            {/* Contact Information */}
            <div className="glass rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    📞 Contact Information
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">WhatsApp URL</label>
                        <input
                            type="url"
                            value={whatsappUrl}
                            onChange={(e) => setWhatsappUrl(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="https://wa.link/xxxxx"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Email (Optional)</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="contact@texa.ai"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Phone (Optional)</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="+62 xxx xxxx xxxx"
                        />
                    </div>
                    <button
                        onClick={handleSaveContact}
                        disabled={saving}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Contact Info'}
                    </button>
                </div>
            </div>

            {/* Address */}
            <div className="glass rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    📍 Address
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Address Line 1</label>
                        <input
                            type="text"
                            value={addressLine1}
                            onChange={(e) => setAddressLine1(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Jl. Example Street No. 123"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Address Line 2 (Optional)</label>
                        <input
                            type="text"
                            value={addressLine2}
                            onChange={(e) => setAddressLine2(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Gedung TEXA Lt. 5"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">City</label>
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Jakarta"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">Country</label>
                            <input
                                type="text"
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Indonesia"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSaveAddress}
                        disabled={saving}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Address'}
                    </button>
                </div>
            </div>

            {/* Google Maps */}
            <div className="glass rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    🗺️ Google Maps
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Maps Share URL
                            <span className="text-xs text-slate-500 ml-2">(dari Google Maps → Share → Copy link)</span>
                        </label>
                        <input
                            type="url"
                            value={mapsUrl}
                            onChange={(e) => setMapsUrl(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="https://maps.app.goo.gl/xxxxx"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Maps Embed URL
                            <span className="text-xs text-slate-500 ml-2">(dari Google Maps → Share → Embed a map → Copy HTML src)</span>
                        </label>
                        <input
                            type="url"
                            value={mapsEmbedUrl}
                            onChange={(e) => setMapsEmbedUrl(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="https://www.google.com/maps/embed?pb=..."
                        />
                    </div>

                    {/* Maps Preview */}
                    {mapsEmbedUrl && (
                        <div className="mt-4">
                            <label className="block text-sm font-semibold text-slate-300 mb-2">Preview</label>
                            <div className="rounded-xl overflow-hidden border border-white/10">
                                <iframe
                                    src={mapsEmbedUrl}
                                    width="100%"
                                    height="300"
                                    style={{ border: 0 }}
                                    allowFullScreen
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    title="Google Maps Preview"
                                />
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleSaveMaps}
                        disabled={saving}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Maps'}
                    </button>
                </div>
            </div>

            {/* Social Media */}
            <div className="glass rounded-2xl p-6 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    🌐 Social Media Links
                </h3>
                <div className="space-y-4">
                    {settings.socialMedia.map((social, index) => (
                        <div key={index} className="p-4 bg-slate-900/30 rounded-xl border border-white/5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{social.icon}</span>
                                    <div>
                                        <h4 className="font-bold text-white">{social.label}</h4>
                                        <p className="text-xs text-slate-500">{social.platform}</p>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={social.isActive}
                                        onChange={(e) => handleUpdateSocialMedia(social.platform, 'isActive', e.target.checked)}
                                        className="w-5 h-5 rounded border-white/20 bg-slate-900 checked:bg-indigo-600"
                                    />
                                    <span className="text-sm text-slate-400">Active</span>
                                </label>
                            </div>
                            <div className="space-y-2">
                                <input
                                    type="url"
                                    value={social.url}
                                    onChange={(e) => handleUpdateSocialMedia(social.platform, 'url', e.target.value)}
                                    className="w-full px-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder={`https://${social.platform}.com/yourusername`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
