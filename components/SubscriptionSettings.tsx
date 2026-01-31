// Subscription Settings Component - Admin UI untuk konfigurasi pembayaran
import React, { useState, useEffect } from 'react';
import {
    subscribeToSettings,
    saveSubscriptionSettings,
    formatIDR,
    generatePackageId,
    SubscriptionSettings,
    SubscriptionPackage,
    DEFAULT_SETTINGS
} from '../services/supabaseSubscriptionService';
import { supabase } from '../services/supabaseService';

// Interface for catalog tool
interface CatalogTool {
    id: string;
    name: string;
    category?: string;
    image_url?: string;
    is_active?: boolean;
}

interface SubscriptionSettingsProps {
    showToast: (message: string, type: 'success' | 'error') => void;
}

const SubscriptionSettingsManager: React.FC<SubscriptionSettingsProps> = ({ showToast }) => {
    const [settings, setSettings] = useState<SubscriptionSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<'urls' | 'packages' | 'ui' | 'features' | 'tokopay'>('urls');
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [editingPackage, setEditingPackage] = useState<SubscriptionPackage | null>(null);
    const [showPackageModal, setShowPackageModal] = useState(false);

    // Catalog tools for selection
    const [catalogTools, setCatalogTools] = useState<CatalogTool[]>([]);
    const [showToolDropdown, setShowToolDropdown] = useState(false);

    // Package form state - now features can store tool IDs or text
    const [packageForm, setPackageForm] = useState<SubscriptionPackage>({
        id: '',
        name: '',
        duration: 30,
        price: 0,
        features: [],
        includedToolIds: [], // New field for selected tool IDs
        active: true
    });
    const [newFeature, setNewFeature] = useState('');

    // Subscribe to settings
    useEffect(() => {
        const unsubscribe = subscribeToSettings((fetchedSettings) => {
            setSettings(fetchedSettings);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Fetch catalog tools for selection
    useEffect(() => {
        const fetchTools = async () => {
            try {
                const { data, error } = await supabase
                    .from('tools')
                    .select('id, name, category, image_url, is_active')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (!error && data) {
                    setCatalogTools(data);
                }
            } catch (err) {
                console.error('Failed to fetch tools:', err);
            }
        };
        fetchTools();
    }, []);

    // Save settings
    const handleSave = async () => {
        setSaving(true);
        const success = await saveSubscriptionSettings(settings);
        if (success) {
            showToast('Pengaturan berhasil disimpan! ✅', 'success');
        } else {
            showToast('Gagal menyimpan pengaturan', 'error');
        }
        setSaving(false);
    };

    // Package handlers
    const openPackageModal = (pkg?: SubscriptionPackage) => {
        if (pkg) {
            setEditingPackage(pkg);
            setPackageForm({
                ...pkg,
                includedToolIds: pkg.includedToolIds || []
            });
        } else {
            setEditingPackage(null);
            setPackageForm({
                id: generatePackageId(),
                name: '',
                duration: 30,
                price: 0,
                features: [],
                includedToolIds: [],
                active: true
            });
        }
        setShowToolDropdown(false);
        setShowPackageModal(true);
    };

    // Add tool to package
    const addToolToPackage = (toolId: string) => {
        if (!packageForm.includedToolIds?.includes(toolId)) {
            setPackageForm({
                ...packageForm,
                includedToolIds: [...(packageForm.includedToolIds || []), toolId]
            });
        }
        setShowToolDropdown(false);
    };

    // Remove tool from package
    const removeToolFromPackage = (toolId: string) => {
        setPackageForm({
            ...packageForm,
            includedToolIds: (packageForm.includedToolIds || []).filter(id => id !== toolId)
        });
    };

    // Get tool name by ID
    const getToolName = (toolId: string): string => {
        const tool = catalogTools.find(t => t.id === toolId);
        return tool?.name || toolId;
    };

    const savePackage = async () => {
        if (!packageForm.name || packageForm.price <= 0) {
            showToast('Isi nama dan harga paket', 'error');
            return;
        }

        let packages: SubscriptionPackage[];
        if (editingPackage) {
            packages = settings.packages.map(pkg =>
                pkg.id === editingPackage.id ? packageForm : pkg
            );
        } else {
            packages = [...settings.packages, packageForm];
        }

        const newSettings = { ...settings, packages };
        setSettings(newSettings);
        setShowPackageModal(false);

        // Auto-save to database
        const success = await saveSubscriptionSettings(newSettings);
        if (success) {
            showToast(editingPackage ? 'Paket berhasil diperbarui! ✅' : 'Paket berhasil ditambahkan! ✅', 'success');
        } else {
            showToast('Gagal menyimpan paket ke database', 'error');
        }
    };

    const deletePackage = async (pkgId: string) => {
        const packages = settings.packages.filter(pkg => pkg.id !== pkgId);
        const newSettings = { ...settings, packages };
        setSettings(newSettings);

        // Auto-save to database
        const success = await saveSubscriptionSettings(newSettings);
        if (success) {
            showToast('Paket berhasil dihapus! ✅', 'success');
        } else {
            showToast('Gagal menghapus paket dari database', 'error');
        }
    };

    const addFeature = () => {
        if (newFeature.trim()) {
            setPackageForm({
                ...packageForm,
                features: [...packageForm.features, newFeature.trim()]
            });
            setNewFeature('');
        }
    };

    const removeFeature = (index: number) => {
        setPackageForm({
            ...packageForm,
            features: packageForm.features.filter((_, i) => i !== index)
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Memuat pengaturan...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <span className="text-2xl">💳</span> Pengaturan Subscription
                    </h2>
                    <p className="text-slate-400 mt-1">Konfigurasi pembayaran, paket, dan webhook</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                    {saving ? '⏳ Menyimpan...' : '💾 Simpan Semua Pengaturan'}
                </button>
            </div>

            {/* Section Tabs */}
            <div className="flex gap-2 p-1.5 glass rounded-2xl border border-white/10 overflow-x-auto">
                {[
                    { id: 'tokopay', label: '💳 Tokopay', icon: '💳' },
                    { id: 'urls', label: '🔗 URL & Webhook', icon: '🔗' },
                    { id: 'packages', label: '📦 Paket Harga', icon: '📦' },
                    { id: 'ui', label: '🎨 Tampilan', icon: '🎨' },
                    { id: 'features', label: '⚙️ Fitur', icon: '⚙️' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id as any)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${activeSection === tab.id
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tokopay Configuration Section */}
            {activeSection === 'tokopay' && (
                <div className="glass rounded-2xl p-6 border border-white/10 space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        💳 Konfigurasi Tokopay
                    </h3>

                    {/* Connection Status */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-white">Status Koneksi</p>
                                <p className="text-xs text-slate-400">Test koneksi ke Tokopay API</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {connectionStatus === 'success' && (
                                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">✓ Terhubung</span>
                                )}
                                {connectionStatus === 'error' && (
                                    <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">✗ Gagal</span>
                                )}
                                <button
                                    onClick={async () => {
                                        setTestingConnection(true);
                                        setConnectionStatus('idle');
                                        try {
                                            const resp = await fetch('http://127.0.0.1:8787/health');
                                            const data = await resp.json();
                                            if (data.ok && data.tokopayReady) {
                                                setConnectionStatus('success');
                                                showToast('Koneksi Tokopay berhasil! ✅', 'success');
                                            } else {
                                                setConnectionStatus('error');
                                                showToast('Tokopay tidak siap', 'error');
                                            }
                                        } catch {
                                            setConnectionStatus('error');
                                            showToast('Gagal terhubung ke server', 'error');
                                        }
                                        setTestingConnection(false);
                                    }}
                                    disabled={testingConnection}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all disabled:opacity-50"
                                >
                                    {testingConnection ? '⏳ Testing...' : '🔌 Test Koneksi'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Merchant Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                                Merchant ID
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={settings.tokopayMerchantId || 'M250828KEAYY483'}
                                    readOnly
                                    className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white/70 cursor-not-allowed"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(settings.tokopayMerchantId || 'M250828KEAYY483');
                                        showToast('Merchant ID disalin! 📋', 'success');
                                    }}
                                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
                                    title="Copy"
                                >
                                    📋
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">ID Merchant dari akun Tokopay</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                                Secret Key
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value="••••••••••••••••••••••••"
                                    readOnly
                                    className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white/70 cursor-not-allowed"
                                />
                                <a
                                    href="https://dash.tokopay.id/pengaturan/secret-key"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 transition-all text-sm font-bold flex items-center gap-1"
                                >
                                    🔑 Lihat
                                </a>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Dikonfigurasi di file .env (TOKOPAY_SECRET_KEY)</p>
                        </div>
                    </div>

                    {/* Webhook URL */}
                    <div className="border-t border-white/10 pt-4">
                        <h4 className="text-sm font-bold text-white mb-4">🪝 Webhook URL</h4>
                        <div>
                            <label className="block text-xs font-bold text-purple-400 mb-2 uppercase">
                                URL Callback Pembayaran
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    value={settings.tokopayWebhookUrl || 'https://digistore.texa.ai/api/callback/tokopay'}
                                    readOnly
                                    className="flex-1 px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white/70"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(settings.tokopayWebhookUrl || 'https://digistore.texa.ai/api/callback/tokopay');
                                        showToast('Webhook URL disalin! 📋', 'success');
                                    }}
                                    className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-all font-bold text-sm"
                                >
                                    📋 Copy
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Paste URL ini di dashboard Tokopay → Pengaturan → Webhook</p>
                        </div>
                    </div>

                    {/* Payment Methods */}
                    <div className="border-t border-white/10 pt-4">
                        <h4 className="text-sm font-bold text-white mb-4">💰 Metode Pembayaran Aktif</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* QRIS */}
                            <div className="p-4 rounded-xl bg-black/30 border border-white/10">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">📱</span>
                                    <div>
                                        <p className="font-bold text-white">QRIS</p>
                                        <p className="text-[10px] text-slate-400">Semua Bank & E-Wallet</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-emerald-400">Realtime</span>
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${settings.tokopayEnabledMethods?.qris !== false
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {settings.tokopayEnabledMethods?.qris !== false ? '✓ Aktif' : '✗ Nonaktif'}
                                    </span>
                                </div>
                            </div>

                            {/* E-Wallet */}
                            <div className="p-4 rounded-xl bg-black/30 border border-white/10">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">💳</span>
                                    <div>
                                        <p className="font-bold text-white">E-Wallet</p>
                                        <p className="text-[10px] text-slate-400">DANA, OVO, ShopeePay, GoPay</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-emerald-400">{settings.tokopayEnabledMethods?.ewallet?.length || 4} channel</span>
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${(settings.tokopayEnabledMethods?.ewallet?.length || 0) > 0
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {(settings.tokopayEnabledMethods?.ewallet?.length || 0) > 0 ? '✓ Aktif' : '✗ Nonaktif'}
                                    </span>
                                </div>
                            </div>

                            {/* Virtual Account */}
                            <div className="p-4 rounded-xl bg-black/30 border border-white/10">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-2xl">🏦</span>
                                    <div>
                                        <p className="font-bold text-white">Virtual Account</p>
                                        <p className="text-[10px] text-slate-400">BCA, BNI, BRI, Mandiri, dll</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-emerald-400">{settings.tokopayEnabledMethods?.bank?.length || 6} bank</span>
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${(settings.tokopayEnabledMethods?.bank?.length || 0) > 0
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {(settings.tokopayEnabledMethods?.bank?.length || 0) > 0 ? '✓ Aktif' : '✗ Nonaktif'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dashboard Link */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-white">🌐 Dashboard Tokopay</p>
                                <p className="text-xs text-slate-400">Kelola saldo, transaksi, dan pengaturan lainnya</p>
                            </div>
                            <a
                                href="https://dash.tokopay.id/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all flex items-center gap-2"
                            >
                                Buka Dashboard →
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* URLs & Webhook Section */}
            {activeSection === 'urls' && (
                <div className="glass rounded-2xl p-6 border border-white/10 space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        🔗 Konfigurasi URL & Webhook
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Payment URL */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                                URL Halaman Pembayaran *
                            </label>
                            <input
                                type="url"
                                value={settings.paymentUrl}
                                onChange={(e) => setSettings({ ...settings, paymentUrl: e.target.value })}
                                placeholder="https://tripay.co.id/checkout/xxx"
                                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">URL checkout payment gateway (Tripay, Midtrans, dll)</p>
                        </div>

                        {/* Payment API URL */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                                API Endpoint Pembayaran
                            </label>
                            <input
                                type="url"
                                value={settings.paymentApiUrl || ''}
                                onChange={(e) => setSettings({ ...settings, paymentApiUrl: e.target.value })}
                                placeholder="https://api.tripay.co.id/v1/transaction"
                                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Optional - untuk create transaction via API</p>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                        <h4 className="text-sm font-bold text-white mb-4">🔄 Redirect URLs</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-emerald-400 mb-2 uppercase">
                                    ✓ Success Redirect
                                </label>
                                <input
                                    type="url"
                                    value={settings.successRedirectUrl}
                                    onChange={(e) => setSettings({ ...settings, successRedirectUrl: e.target.value })}
                                    placeholder="https://texa.tools/success"
                                    className="w-full px-4 py-3 bg-black/30 border border-emerald-500/30 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-red-400 mb-2 uppercase">
                                    ✗ Failed Redirect
                                </label>
                                <input
                                    type="url"
                                    value={settings.failedRedirectUrl}
                                    onChange={(e) => setSettings({ ...settings, failedRedirectUrl: e.target.value })}
                                    placeholder="https://texa.tools/failed"
                                    className="w-full px-4 py-3 bg-black/30 border border-red-500/30 rounded-xl text-white focus:outline-none focus:border-red-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-amber-400 mb-2 uppercase">
                                    ⏳ Pending Redirect
                                </label>
                                <input
                                    type="url"
                                    value={settings.pendingRedirectUrl || ''}
                                    onChange={(e) => setSettings({ ...settings, pendingRedirectUrl: e.target.value })}
                                    placeholder="https://texa.tools/pending"
                                    className="w-full px-4 py-3 bg-black/30 border border-amber-500/30 rounded-xl text-white focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                        <h4 className="text-sm font-bold text-white mb-4">🪝 Webhook Configuration</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-purple-400 mb-2 uppercase">
                                    Webhook URL
                                </label>
                                <input
                                    type="url"
                                    value={settings.webhookUrl || ''}
                                    onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                                    placeholder="https://api.texa.tools/webhook/payment"
                                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">URL untuk terima notifikasi pembayaran</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-purple-400 mb-2 uppercase">
                                    Webhook Secret Key
                                </label>
                                <input
                                    type="password"
                                    value={settings.webhookSecret || ''}
                                    onChange={(e) => setSettings({ ...settings, webhookSecret: e.target.value })}
                                    placeholder="••••••••••••"
                                    className="w-full px-4 py-3 bg-black/30 border border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Secret untuk validasi signature webhook</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Packages Section */}
            {activeSection === 'packages' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            📦 Paket Subscription
                        </h3>
                        <button
                            onClick={() => openPackageModal()}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all flex items-center gap-2"
                        >
                            + Tambah Paket
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {settings.packages.map((pkg) => (
                            <div
                                key={pkg.id}
                                className={`glass rounded-2xl p-5 border relative overflow-hidden ${pkg.popular ? 'border-indigo-500/50' : 'border-white/10'
                                    } ${!pkg.active && 'opacity-50'}`}
                            >
                                {pkg.popular && (
                                    <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 text-[10px] font-bold text-white rounded-bl-xl">
                                        POPULER
                                    </div>
                                )}

                                <h4 className="text-lg font-bold text-white mb-1">{pkg.name}</h4>
                                <p className="text-xs text-slate-400 mb-3">{pkg.duration} Hari</p>

                                <div className="mb-4">
                                    {pkg.discountPrice ? (
                                        <>
                                            <span className="text-xs text-slate-500 line-through">{formatIDR(pkg.price)}</span>
                                            <p className="text-2xl font-black text-emerald-400">{formatIDR(pkg.discountPrice)}</p>
                                        </>
                                    ) : (
                                        <p className="text-2xl font-black text-white">{formatIDR(pkg.price)}</p>
                                    )}
                                </div>

                                <ul className="space-y-1 mb-4">
                                    {pkg.features.map((feature, i) => (
                                        <li key={i} className="text-xs text-slate-400 flex items-center gap-2">
                                            <span className="text-emerald-400">✓</span> {feature}
                                        </li>
                                    ))}
                                </ul>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openPackageModal(pkg)}
                                        className="flex-1 py-2 rounded-xl bg-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/30 transition-all"
                                    >
                                        ✏️ Edit
                                    </button>
                                    <button
                                        onClick={() => deletePackage(pkg.id)}
                                        className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* UI Settings Section */}
            {activeSection === 'ui' && (
                <div className="glass rounded-2xl p-6 border border-white/10 space-y-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        🎨 Pengaturan Tampilan Popup
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                                Judul Popup
                            </label>
                            <input
                                type="text"
                                value={settings.popupTitle || ''}
                                onChange={(e) => setSettings({ ...settings, popupTitle: e.target.value })}
                                placeholder="Berlangganan Premium"
                                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                                Teks Tombol Beli
                            </label>
                            <input
                                type="text"
                                value={settings.buttonText || ''}
                                onChange={(e) => setSettings({ ...settings, buttonText: e.target.value })}
                                placeholder="Beli Sekarang"
                                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                            Deskripsi Popup
                        </label>
                        <textarea
                            value={settings.popupDescription || ''}
                            onChange={(e) => setSettings({ ...settings, popupDescription: e.target.value })}
                            placeholder="Pilih paket yang sesuai untuk akses penuh..."
                            rows={3}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                            Nomor WhatsApp (Konfirmasi Manual)
                        </label>
                        <input
                            type="tel"
                            value={settings.whatsappNumber || ''}
                            onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                            placeholder="628123456789"
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Tanpa + atau spasi, contoh: 628123456789</p>
                    </div>
                </div>
            )}

            {/* Features Section */}
            {activeSection === 'features' && (
                <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        ⚙️ Fitur Pembayaran
                    </h3>

                    <div className="space-y-4">
                        {/* Auto Activation */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-black/30 border border-white/10">
                            <div>
                                <p className="font-bold text-white">⚡ Auto Aktivasi</p>
                                <p className="text-xs text-slate-400">Otomatis aktifkan subscription setelah pembayaran sukses</p>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, enableAutoActivation: !settings.enableAutoActivation })}
                                className={`w-14 h-8 rounded-full transition-all relative ${settings.enableAutoActivation ? 'bg-emerald-600' : 'bg-slate-700'
                                    }`}
                            >
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${settings.enableAutoActivation ? 'right-1' : 'left-1'
                                    }`}></div>
                            </button>
                        </div>

                        {/* Manual Payment */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-black/30 border border-white/10">
                            <div>
                                <p className="font-bold text-white">💵 Pembayaran Manual</p>
                                <p className="text-xs text-slate-400">Aktifkan opsi transfer bank manual</p>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, enableManualPayment: !settings.enableManualPayment })}
                                className={`w-14 h-8 rounded-full transition-all relative ${settings.enableManualPayment ? 'bg-emerald-600' : 'bg-slate-700'
                                    }`}
                            >
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${settings.enableManualPayment ? 'right-1' : 'left-1'
                                    }`}></div>
                            </button>
                        </div>

                        {/* QRIS */}
                        <div className="flex items-center justify-between p-4 rounded-xl bg-black/30 border border-white/10">
                            <div>
                                <p className="font-bold text-white">📱 QRIS</p>
                                <p className="text-xs text-slate-400">Aktifkan pembayaran via QRIS</p>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, enableQRIS: !settings.enableQRIS })}
                                className={`w-14 h-8 rounded-full transition-all relative ${settings.enableQRIS ? 'bg-emerald-600' : 'bg-slate-700'
                                    }`}
                            >
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${settings.enableQRIS ? 'right-1' : 'left-1'
                                    }`}></div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Package Modal */}
            {showPackageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="glass rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-2xl font-black mb-6">
                            {editingPackage ? '✏️ Edit Paket' : '➕ Tambah Paket'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Nama Paket *</label>
                                <input
                                    type="text"
                                    value={packageForm.name}
                                    onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                                    placeholder="Paket 30 Hari"
                                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Durasi (Hari) *</label>
                                    <input
                                        type="number"
                                        value={packageForm.duration}
                                        onChange={(e) => setPackageForm({ ...packageForm, duration: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Harga (IDR) *</label>
                                    <input
                                        type="number"
                                        value={packageForm.price}
                                        onChange={(e) => setPackageForm({ ...packageForm, price: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Harga Diskon (Optional)</label>
                                <input
                                    type="number"
                                    value={packageForm.discountPrice || ''}
                                    onChange={(e) => setPackageForm({ ...packageForm, discountPrice: parseInt(e.target.value) || undefined })}
                                    placeholder="Kosongkan jika tidak ada diskon"
                                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white"
                                />
                            </div>

                            {/* Tools Included - Select from catalog */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">🛠️ Tools Termasuk (Pilih dari Katalog)</label>
                                <div className="relative mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowToolDropdown(!showToolDropdown)}
                                        className="w-full px-4 py-3 bg-black/30 border border-indigo-500/30 rounded-xl text-white text-sm text-left flex items-center justify-between hover:border-indigo-500/50 transition-all"
                                    >
                                        <span className="text-slate-400">+ Pilih Tools dari Katalog...</span>
                                        <span className="text-indigo-400">{showToolDropdown ? '▲' : '▼'}</span>
                                    </button>

                                    {showToolDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-white/20 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                                            {catalogTools.filter(tool => !packageForm.includedToolIds?.includes(tool.id)).map(tool => (
                                                <button
                                                    key={tool.id}
                                                    type="button"
                                                    onClick={() => addToolToPackage(tool.id)}
                                                    className="w-full px-4 py-3 text-left hover:bg-indigo-500/20 transition-all flex items-center gap-3 border-b border-white/5 last:border-b-0"
                                                >
                                                    {tool.image_url && (
                                                        <img src={tool.image_url} alt={tool.name} className="w-8 h-8 rounded-lg object-cover" />
                                                    )}
                                                    <div>
                                                        <p className="text-sm text-white font-medium">{tool.name}</p>
                                                        {tool.category && <p className="text-[10px] text-slate-400">{tool.category}</p>}
                                                    </div>
                                                </button>
                                            ))}
                                            {catalogTools.filter(tool => !packageForm.includedToolIds?.includes(tool.id)).length === 0 && (
                                                <p className="px-4 py-3 text-sm text-slate-400 text-center">Semua tools sudah ditambahkan</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Selected Tools */}
                                <div className="space-y-1">
                                    {(packageForm.includedToolIds || []).map((toolId) => {
                                        const tool = catalogTools.find(t => t.id === toolId);
                                        return (
                                            <div key={toolId} className="flex items-center justify-between px-3 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    {tool?.image_url && (
                                                        <img src={tool.image_url} alt={tool?.name} className="w-6 h-6 rounded object-cover" />
                                                    )}
                                                    <span className="text-sm text-white">🛠️ {tool?.name || toolId}</span>
                                                </div>
                                                <button onClick={() => removeToolFromPackage(toolId)} className="text-red-400 text-xs hover:text-red-300">✗</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Additional Features - Text */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">📝 Fitur Tambahan (Teks)</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={newFeature}
                                        onChange={(e) => setNewFeature(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addFeature()}
                                        placeholder="Tambah fitur lain... (Support 24/7, dll)"
                                        className="flex-1 px-4 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={addFeature}
                                        className="px-4 py-2 bg-indigo-600 rounded-xl text-white font-bold text-sm"
                                    >
                                        +
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {packageForm.features.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-black/30 rounded-lg">
                                            <span className="text-sm text-white">✓ {f}</span>
                                            <button onClick={() => removeFeature(i)} className="text-red-400 text-xs">✗</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={packageForm.popular || false}
                                        onChange={(e) => setPackageForm({ ...packageForm, popular: e.target.checked })}
                                        className="w-4 h-4 rounded"
                                    />
                                    <span className="text-sm text-white">Tandai Populer</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={packageForm.active}
                                        onChange={(e) => setPackageForm({ ...packageForm, active: e.target.checked })}
                                        className="w-4 h-4 rounded"
                                    />
                                    <span className="text-sm text-white">Aktif</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowPackageModal(false)}
                                className="flex-1 py-3 rounded-xl glass border border-white/10 text-slate-400 font-bold"
                            >
                                Batal
                            </button>
                            <button
                                onClick={savePackage}
                                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold"
                            >
                                Simpan Paket
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubscriptionSettingsManager;
