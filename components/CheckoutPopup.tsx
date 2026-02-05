// CheckoutPopup Component - Popup untuk beli satuan atau langganan
import React, { useState, useEffect } from 'react';
import { AITool } from '../types';
import {
    SubscriptionSettings,
    PerToolDurationTier,
    subscribeToSettings,
    formatIDR,
    DEFAULT_SETTINGS
} from '../services/supabaseSubscriptionService';
import { getSession } from '../services/supabaseAuthService';
import { isUrlImageAllowed } from '../utils/iframePolicy';
import { supabase } from '../services/supabaseService';

// Interface for catalog tool
interface CatalogTool {
    id: string;
    name: string;
    category?: string;
    image_url?: string;
    is_active?: boolean;
}

interface CheckoutPopupProps {
    tool: AITool;
    isOpen: boolean;
    onClose: () => void;
}

const CheckoutPopup: React.FC<CheckoutPopupProps> = ({ tool, isOpen, onClose }) => {
    const [settings, setSettings] = useState<SubscriptionSettings>(DEFAULT_SETTINGS);
    const [selectedPackage, setSelectedPackage] = useState<string>('');
    const [selectedDuration, setSelectedDuration] = useState<7 | 14 | 30>(7);
    const [purchaseType, setPurchaseType] = useState<'individual' | 'subscription'>('individual');
    const [imageFailed, setImageFailed] = useState(false);

    // Catalog tools for displaying tool icons in subscription packages
    const [catalogTools, setCatalogTools] = useState<CatalogTool[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeToSettings((s) => setSettings(s));
        return () => unsubscribe();
    }, []);

    // Fetch catalog tools for displaying in subscription packages
    useEffect(() => {
        const fetchTools = async () => {
            try {
                // Try API first (bypasses RLS)
                const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? 'http://127.0.0.1:8787'
                    : '';

                const apiResponse = await fetch(`${apiBaseUrl}/api/public/tools`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (apiResponse.ok) {
                    const result = await apiResponse.json();
                    if (result.success && result.data) {
                        setCatalogTools(result.data.filter((t: any) => t.is_active !== false).map((t: any) => ({
                            id: t.id,
                            name: t.name,
                            category: t.category,
                            image_url: t.image_url,
                            is_active: t.is_active
                        })));
                        return;
                    }
                }

                // Fallback to direct Supabase
                const { data, error } = await supabase
                    .from('tools')
                    .select('id, name, category, image_url, is_active')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (!error && data) {
                    setCatalogTools(data);
                }
            } catch (err) {
                console.error('Failed to fetch tools for package display:', err);
            }
        };
        fetchTools();
    }, []);

    // Set default selected package to the popular one
    useEffect(() => {
        const popularPkg = settings.packages.find(p => p.popular && p.active);
        if (popularPkg) {
            setSelectedPackage(popularPkg.id);
        } else if (settings.packages.length > 0) {
            const activePkg = settings.packages.find(p => p.active);
            if (activePkg) setSelectedPackage(activePkg.id);
        }
    }, [settings.packages]);

    // Get included tools for the selected package
    const getSelectedPackageTools = (): CatalogTool[] => {
        const pkg = settings.packages.find(p => p.id === selectedPackage);
        if (!pkg?.includedToolIds || pkg.includedToolIds.length === 0) return [];
        return pkg.includedToolIds
            .map(toolId => catalogTools.find(t => t.id === toolId))
            .filter((t): t is CatalogTool => t !== undefined);
    };

    // Build per-tool pricing tiers from tool properties
    const toolPricingTiers = [
        { duration: 7 as const, name: '7 Hari', price: tool.price7Days || 0 },
        { duration: 14 as const, name: '14 Hari', price: tool.price14Days || 0 },
        { duration: 30 as const, name: '30 Hari', price: tool.price30Days || 0 }
    ].filter(t => t.price > 0);

    // Auto-select first available tier if current selection has no price
    useEffect(() => {
        if (toolPricingTiers.length > 0) {
            const currentTier = toolPricingTiers.find(t => t.duration === selectedDuration);
            if (!currentTier) {
                setSelectedDuration(toolPricingTiers[0].duration);
            }
        }
    }, [tool.price7Days, tool.price14Days, tool.price30Days]);

    if (!isOpen) return null;

    // Get active packages
    const activePackages = settings.packages.filter(p => p.active);

    // Get selected tier details
    const currentTier = toolPricingTiers.find(t => t.duration === selectedDuration);

    const handleIndividualPurchase = async () => {
        if (!currentTier) return;

        // Check if user is logged in
        const session = await getSession();
        if (!session?.user) {
            alert('Silakan login terlebih dahulu untuk melanjutkan pembelian');
            window.location.hash = '/?login=true';
            onClose();
            return;
        }

        // Redirect to internal payment page with TokoPay integration
        const params = new URLSearchParams({
            type: 'individual',
            itemId: tool.id,
            itemName: tool.name,
            amount: String(currentTier.price),
            duration: String(currentTier.duration),
            tierName: currentTier.name
        });

        window.location.hash = `/payment?${params.toString()}`;
        onClose();
    };

    const handleSubscriptionPurchase = async () => {
        const pkg = settings.packages.find(p => p.id === selectedPackage);
        if (!pkg) return;

        // Check if user is logged in
        const session = await getSession();
        if (!session?.user) {
            alert('Silakan login terlebih dahulu untuk melanjutkan pembelian');
            window.location.hash = '/?login=true';
            onClose();
            return;
        }

        // Redirect to internal payment page with TokoPay integration
        // Include includedToolIds in URL so PaymentPage has them immediately
        const toolIdsParam = (pkg.includedToolIds || []).join(',');
        const params = new URLSearchParams({
            type: 'subscription',
            itemId: pkg.id,
            itemName: pkg.name,
            amount: String(pkg.discountPrice || pkg.price),
            duration: String(pkg.duration),
            packageId: pkg.id,
            includedToolIds: toolIdsParam // NEW: Pass tool IDs directly
        });

        console.log('[CheckoutPopup] Passing includedToolIds:', pkg.includedToolIds);
        window.location.hash = `/payment?${params.toString()}`;
        onClose();
    };

    const safeToolImage = !imageFailed && isUrlImageAllowed(tool.imageUrl || '') ? tool.imageUrl : '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="relative p-6 pb-4 border-b border-white/10">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <span className="text-white text-lg">×</span>
                    </button>

                    <div className="flex items-center gap-4">
                        {safeToolImage ? (
                            <img
                                src={safeToolImage}
                                alt={tool.name}
                                className="w-14 h-14 rounded-xl object-cover border border-white/10"
                                onError={() => setImageFailed(true)}
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-xl bg-indigo-500/20 border border-white/10 flex items-center justify-center text-indigo-200 text-xs font-bold">
                                {tool.category?.slice(0, 2) || 'AI'}
                            </div>
                        )}
                        <div>
                            <h3 className="text-xl font-black text-white">{tool.name}</h3>
                            <p className="text-slate-400 text-sm">{tool.category}</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* Individual Purchase Option with Per-Tool Duration Tiers */}
                    {toolPricingTiers.length > 0 && (
                        <div
                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${purchaseType === 'individual'
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-white/10 hover:border-white/30 bg-white/5'
                                }`}
                            onClick={() => setPurchaseType('individual')}
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${purchaseType === 'individual' ? 'border-emerald-500 bg-emerald-500' : 'border-white/30'
                                    }`}>
                                    {purchaseType === 'individual' && <span className="text-white text-xs">✓</span>}
                                </div>
                                <span className="font-bold text-white">🛒 Beli Satuan</span>
                                <span className="text-slate-400 text-sm">- Hanya {tool.name}</span>
                            </div>

                            {/* Per-Tool Duration Tier Options */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {toolPricingTiers.map(tier => {
                                    const isSelected = selectedDuration === tier.duration && purchaseType === 'individual';
                                    return (
                                        <div
                                            key={tier.duration}
                                            className={`p-3 rounded-xl text-center transition-all cursor-pointer relative ${isSelected
                                                ? 'bg-emerald-500/30 border-2 border-emerald-500 shadow-lg shadow-emerald-500/20'
                                                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                                }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDuration(tier.duration);
                                                setPurchaseType('individual');
                                            }}
                                        >
                                            {tier.duration === 30 && (
                                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-500 text-white text-[8px] font-bold rounded-full shadow-lg">
                                                    BEST
                                                </span>
                                            )}
                                            <p className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                                {tier.name}
                                            </p>
                                            <p className="text-emerald-400 font-black text-lg mt-1">
                                                {formatIDR(tier.price)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>

                            {purchaseType === 'individual' && currentTier && (
                                <>
                                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                                        <span>⏱️</span>
                                        <span>Akses <strong className="text-emerald-400">{currentTier.duration} hari</strong> untuk {tool.name}</span>
                                    </div>
                                    <button
                                        onClick={handleIndividualPurchase}
                                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                                    >
                                        🛒 Beli Sekarang - {formatIDR(currentTier.price)}
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* No pricing message if no tiers set */}
                    {toolPricingTiers.length === 0 && (
                        <div className="p-4 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 text-center">
                            <p className="text-amber-400 font-bold">⚠️ Harga belum diatur untuk tool ini</p>
                            <p className="text-slate-400 text-sm mt-1">Silakan pilih paket langganan di bawah</p>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-slate-500 text-xs font-bold uppercase">atau</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Subscription Option */}
                    <div
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${purchaseType === 'subscription'
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-white/10 hover:border-white/30 bg-white/5'
                            }`}
                        onClick={() => setPurchaseType('subscription')}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${purchaseType === 'subscription' ? 'border-indigo-500 bg-indigo-500' : 'border-white/30'
                                }`}>
                                {purchaseType === 'subscription' && <span className="text-white text-xs">✓</span>}
                            </div>
                            <span className="font-bold text-white">💎 Paket Langganan</span>
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full">HEMAT</span>
                        </div>

                        <p className="text-slate-400 text-sm mb-3">Akses SEMUA tools dengan satu langganan</p>

                        {/* Package Options */}
                        <div className="space-y-2">
                            {activePackages.map(pkg => {
                                const finalPrice = pkg.discountPrice || pkg.price;
                                return (
                                    <div
                                        key={pkg.id}
                                        className={`p-3 rounded-xl flex items-center justify-between transition-all ${selectedPackage === pkg.id && purchaseType === 'subscription'
                                            ? 'bg-indigo-500/20 border border-indigo-500/50'
                                            : 'bg-white/5 border border-transparent hover:bg-white/10'
                                            }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPackage(pkg.id);
                                            setPurchaseType('subscription');
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-full border-2 ${selectedPackage === pkg.id && purchaseType === 'subscription'
                                                ? 'border-indigo-400 bg-indigo-400'
                                                : 'border-white/30'
                                                }`} />
                                            <div>
                                                <span className="font-bold text-white text-sm">{pkg.name}</span>
                                                {pkg.popular && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-indigo-500 text-white text-[8px] font-bold rounded">POPULER</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {pkg.discountPrice && (
                                                <span className="text-slate-500 line-through text-xs mr-1">
                                                    {formatIDR(pkg.price)}
                                                </span>
                                            )}
                                            <span className="text-indigo-400 font-bold">
                                                {formatIDR(finalPrice)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Included Tools Display - Show when package is selected */}
                        {purchaseType === 'subscription' && getSelectedPackageTools().length > 0 && (
                            <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                                <p className="text-xs font-bold text-indigo-300 mb-2 flex items-center gap-1">
                                    <span>🛠️</span> Tools Termasuk dalam Paket:
                                </p>
                                <div className="grid grid-cols-1 gap-2">
                                    {getSelectedPackageTools().map(tool => (
                                        <div
                                            key={tool.id}
                                            className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
                                        >
                                            {tool.image_url && isUrlImageAllowed(tool.image_url) ? (
                                                <img
                                                    src={tool.image_url}
                                                    alt={tool.name}
                                                    className="w-8 h-8 rounded-lg object-cover border border-white/10"
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center">
                                                    <span className="text-indigo-300 text-xs">🛠️</span>
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-medium truncate">{tool.name}</p>
                                                {tool.category && (
                                                    <p className="text-slate-400 text-[10px] truncate">{tool.category}</p>
                                                )}
                                            </div>
                                            <span className="text-emerald-400 text-xs">✓</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {purchaseType === 'subscription' && (
                            <button
                                onClick={handleSubscriptionPurchase}
                                className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/30"
                            >
                                💎 Langganan Sekarang
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 bg-white/5">
                    <p className="text-slate-500 text-xs text-center">
                        🔒 Pembayaran aman & terenkripsi
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPopup;
