// DockManager Component - Admin UI untuk mengelola Floating Dock
import React, { useState, useEffect } from 'react';
import {
    subscribeToDockItems,
    getAllDockItems,
    addDockItem,
    updateDockItem,
    deleteDockItem,
    DockItem
} from '../services/supabaseDockService';

interface DockManagerProps {
    showToast: (message: string, type: 'success' | 'error') => void;
}

// Common emoji icons for quick selection
const COMMON_ICONS = [
    '🏠', '🛒', '⚙️', '📚', '💬', '🔔', '🎯', '📊',
    '👤', '⭐', '❤️', '📝', '🎨', '🚀', '🔥', '💡',
    '📱', '💻', '🎮', '🎵', '🎬', '📷', '🍕', '☕'
];

const DockManager: React.FC<DockManagerProps> = ({ showToast }) => {
    const [items, setItems] = useState<DockItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'add' | 'edit' | 'delete'>('add');
    const [selectedItem, setSelectedItem] = useState<DockItem | null>(null);
    const [showIconPicker, setShowIconPicker] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        icon: '🏠',
        label: '',
        actionType: 'route' as 'url' | 'route',
        actionValue: '',
        isActive: true
    });

    // Subscribe to dock items
    useEffect(() => {
        const fetchItems = async () => {
            const allItems = await getAllDockItems();
            setItems(allItems);
            setLoading(false);
        };
        void fetchItems();

        const unsubscribe = subscribeToDockItems(() => {
            void fetchItems();
        });
        return () => unsubscribe();
    }, []);

    // Reset form
    const resetForm = () => {
        setFormData({
            icon: '🏠',
            label: '',
            actionType: 'route',
            actionValue: '',
            isActive: true
        });
        setSelectedItem(null);
        setShowIconPicker(false);
    };

    // Open modal
    const openModal = (type: 'add' | 'edit' | 'delete', item?: DockItem) => {
        setModalType(type);
        if (item) {
            setSelectedItem(item);
            if (type === 'edit') {
                setFormData({
                    icon: item.icon,
                    label: item.label,
                    actionType: item.actionType,
                    actionValue: item.actionValue,
                    isActive: item.isActive
                });
            }
        } else {
            resetForm();
        }
        setShowModal(true);
    };

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);

        try {
            if (modalType === 'add') {
                const id = await addDockItem(formData);
                if (id) {
                    showToast('Item dock berhasil ditambahkan! 🎉', 'success');
                    setShowModal(false);
                    resetForm();
                } else {
                    showToast('Gagal menambahkan item dock', 'error');
                }
            } else if (modalType === 'edit' && selectedItem) {
                const success = await updateDockItem(selectedItem.id, formData);
                if (success) {
                    showToast('Item dock berhasil diupdate! ✅', 'success');
                    setShowModal(false);
                    resetForm();
                } else {
                    showToast('Gagal mengupdate item dock', 'error');
                }
            }
        } catch (error) {
            showToast('Terjadi kesalahan', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!selectedItem) return;
        setActionLoading(true);

        try {
            const success = await deleteDockItem(selectedItem.id);
            if (success) {
                showToast('Item dock berhasil dihapus! 🗑️', 'success');
                setShowModal(false);
                resetForm();
            } else {
                showToast('Gagal menghapus item dock', 'error');
            }
        } catch (error) {
            showToast('Terjadi kesalahan', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle toggle status
    const handleToggleStatus = async (item: DockItem) => {
        const success = await updateDockItem(item.id, { isActive: !item.isActive });
        if (success) {
            showToast(`Item "${item.label}" ${item.isActive ? 'dinonaktifkan' : 'diaktifkan'}`, 'success');
        } else {
            showToast('Gagal mengubah status', 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-400">Memuat dock...</p>
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
                        <span className="text-2xl">🎯</span> Kelola Dock
                    </h2>
                    <p className="text-slate-400 mt-1">Atur shortcut floating dock di bottom screen</p>
                </div>
                <button
                    onClick={() => openModal('add')}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                >
                    <span className="text-lg">+</span> Tambah Item
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="glass rounded-2xl p-5 border border-white/10">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total Items</p>
                    <p className="text-3xl font-black text-white">{items.length}</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest mb-1">Aktif</p>
                    <p className="text-3xl font-black text-emerald-400">{items.filter(i => i.isActive).length}</p>
                </div>
                <div className="glass rounded-2xl p-5 border border-red-500/20 bg-red-500/5">
                    <p className="text-[10px] text-red-400 uppercase font-black tracking-widest mb-1">Nonaktif</p>
                    <p className="text-3xl font-black text-red-400">{items.filter(i => !i.isActive).length}</p>
                </div>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.length === 0 ? (
                    <div className="col-span-full text-center py-16">
                        <div className="text-6xl mb-4">🎯</div>
                        <p className="text-slate-400 text-lg">Belum ada item dock</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <div
                            key={item.id}
                            className={`glass rounded-2xl border p-5 transition-all hover:scale-[1.02] ${item.isActive ? 'border-white/10' : 'border-red-500/30 opacity-60'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="text-4xl">{item.icon}</div>
                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${item.isActive
                                    ? 'bg-emerald-500/30 text-emerald-300'
                                    : 'bg-red-500/30 text-red-300'
                                    }`}>
                                    {item.isActive ? '✓ Aktif' : '✗ Nonaktif'}
                                </span>
                            </div>

                            <h3 className="font-bold text-white text-lg mb-2">{item.label}</h3>
                            <div className="space-y-1 mb-4">
                                <p className="text-xs text-slate-500">
                                    Type: <span className="text-indigo-400 font-medium">{item.actionType}</span>
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                    Action: <span className="text-purple-400 font-medium">{item.actionValue}</span>
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleToggleStatus(item)}
                                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${item.isActive
                                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                        }`}
                                >
                                    {item.isActive ? '🔒 Nonaktifkan' : '🔓 Aktifkan'}
                                </button>
                                <button
                                    onClick={() => openModal('edit', item)}
                                    className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-all"
                                    title="Edit"
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => openModal('delete', item)}
                                    className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                                    title="Hapus"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="glass rounded-3xl p-8 max-w-lg w-full border border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto">
                        {/* Add/Edit Form */}
                        {(modalType === 'add' || modalType === 'edit') && (
                            <form onSubmit={handleSubmit}>
                                <h3 className="text-2xl font-black mb-6 flex items-center gap-2">
                                    {modalType === 'add' ? '➕ Tambah Item Dock' : '✏️ Edit Item Dock'}
                                </h3>

                                <div className="space-y-4">
                                    {/* Icon Picker */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Icon *</label>
                                        <div className="flex gap-2">
                                            <div className="w-16 h-16 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center text-4xl">
                                                {formData.icon}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowIconPicker(!showIconPicker)}
                                                className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all"
                                            >
                                                {showIconPicker ? 'Tutup Picker' : 'Pilih Icon'}
                                            </button>
                                        </div>
                                        {showIconPicker && (
                                            <div className="mt-3 grid grid-cols-8 gap-2 p-4 rounded-xl bg-black/30 border border-white/10">
                                                {COMMON_ICONS.map((icon) => (
                                                    <button
                                                        key={icon}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, icon });
                                                            setShowIconPicker(false);
                                                        }}
                                                        className="text-2xl hover:bg-white/10 rounded-lg p-2 transition-all"
                                                    >
                                                        {icon}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <input
                                            type="text"
                                            value={formData.icon}
                                            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                            placeholder="Atau ketik emoji"
                                            className="w-full px-4 py-2 mt-2 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 text-sm"
                                        />
                                    </div>

                                    {/* Label */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Label *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.label}
                                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                            placeholder="Contoh: Home"
                                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    {/* Action Type */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Tipe Aksi *</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, actionType: 'route' })}
                                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${formData.actionType === 'route'
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'glass border border-white/10 text-slate-400'
                                                    }`}
                                            >
                                                🔗 Route (Internal)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, actionType: 'url' })}
                                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${formData.actionType === 'url'
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'glass border border-white/10 text-slate-400'
                                                    }`}
                                            >
                                                🌐 URL (External)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Value */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                                            {formData.actionType === 'route' ? 'Route Path' : 'URL'} *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.actionValue}
                                            onChange={(e) => setFormData({ ...formData, actionValue: e.target.value })}
                                            placeholder={formData.actionType === 'route' ? '/#/admin' : 'https://example.com'}
                                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    {/* Status */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Status</label>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, isActive: true })}
                                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${formData.isActive
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'glass border border-white/10 text-slate-400'
                                                    }`}
                                            >
                                                ✓ Aktif
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, isActive: false })}
                                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!formData.isActive
                                                    ? 'bg-red-600 text-white'
                                                    : 'glass border border-white/10 text-slate-400'
                                                    }`}
                                            >
                                                ✗ Nonaktif
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => { setShowModal(false); resetForm(); }}
                                        className="flex-1 py-3 rounded-xl glass border border-white/10 text-slate-400 font-bold hover:text-white transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:from-indigo-500 hover:to-purple-500 transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Menyimpan...' : modalType === 'add' ? 'Tambahkan' : 'Simpan Perubahan'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Delete Confirmation */}
                        {modalType === 'delete' && selectedItem && (
                            <>
                                <h3 className="text-2xl font-black mb-2 text-red-400">⚠️ Hapus Item Dock</h3>
                                <p className="text-slate-400 text-sm mb-4">
                                    Apakah Anda yakin ingin menghapus <strong className="text-white">{selectedItem.label}</strong>?
                                    Tindakan ini tidak dapat dibatalkan.
                                </p>

                                <div className="glass rounded-xl p-4 mb-6 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="text-4xl">{selectedItem.icon}</div>
                                        <div>
                                            <p className="font-bold text-white">{selectedItem.label}</p>
                                            <p className="text-xs text-slate-400">{selectedItem.actionType}: {selectedItem.actionValue}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setShowModal(false); resetForm(); }}
                                        className="flex-1 py-3 rounded-xl glass border border-white/10 text-slate-400 font-bold hover:text-white transition-colors"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={actionLoading}
                                        className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors disabled:opacity-50"
                                    >
                                        {actionLoading ? 'Menghapus...' : '🗑️ Hapus Permanen'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DockManager;
