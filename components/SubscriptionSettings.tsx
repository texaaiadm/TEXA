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
} from '../services/subscriptionService';

interface SubscriptionSettingsProps {
    showToast: (message: string, type: 'success' | 'error') => void;
}

const SubscriptionSettingsManager: React.FC<SubscriptionSettingsProps> = ({ showToast }) => {
    const [settings, setSettings] = useState<SubscriptionSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<'urls' | 'packages' | 'ui' | 'features'>('urls');
    const [editingPackage, setEditingPackage] = useState<SubscriptionPackage | null>(null);
    const [showPackageModal, setShowPackageModal] = useState(false);

    // Package form state
    const [packageForm, setPackageForm] = useState<SubscriptionPackage>({
        id: '',
        name: '',
        duration: 30,
        price: 0,
        features: [],
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
            setPackageForm(pkg);
        } else {
            setEditingPackage(null);
            setPackageForm({
                id: generatePackageId(),
                name: '',
                duration: 30,
                price: 0,
                features: [],
                active: true
            });
        }
        setShowPackageModal(true);
    };

    const savePackage = () => {
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

        setSettings({ ...settings, packages });
        setShowPackageModal(false);
        showToast(editingPackage ? 'Paket diperbarui!' : 'Paket ditambahkan!', 'success');
    };

    const deletePackage = (pkgId: string) => {
        const packages = settings.packages.filter(pkg => pkg.id !== pkgId);
        setSettings({ ...settings, packages });
        showToast('Paket dihapus!', 'success');
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

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Fitur Termasuk</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={newFeature}
                                        onChange={(e) => setNewFeature(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addFeature()}
                                        placeholder="Tambah fitur..."
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
