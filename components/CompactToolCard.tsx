
import React, { useState, useEffect } from 'react';
import { AITool } from '../types';
import { formatIDR, subscribeToSettings, SubscriptionSettings, SubscriptionPackage, DEFAULT_SETTINGS } from '../services/subscriptionService';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { isUrlIframeAllowed } from '../utils/iframePolicy';
import { checkExtensionInstalled } from '../services/extensionService';
import { usePopupState } from '../services/popupContext';
import ExtensionWarningPopup from './ExtensionWarningPopup';

interface CompactToolCardProps {
    tool: AITool;
    hasAccess: boolean;
}

const CompactToolCard: React.FC<CompactToolCardProps> = ({ tool, hasAccess }) => {
    const navigate = useNavigate();
    const [injecting, setInjecting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [showSubscribePopup, setShowSubscribePopup] = useState(false);
    const [showExtensionWarning, setShowExtensionWarning] = useState(false);
    const [settings, setSettings] = useState<SubscriptionSettings>(DEFAULT_SETTINGS);
    const [selectedPackage, setSelectedPackage] = useState<SubscriptionPackage | null>(null);

    // Register popup states
    usePopupState(showSubscribePopup || showExtensionWarning);

    // Subscribe to settings
    useEffect(() => {
        const unsubscribe = subscribeToSettings((fetchedSettings) => {
            setSettings(fetchedSettings);
            const popular = fetchedSettings.packages.find(p => p.popular && p.active);
            if (popular) setSelectedPackage(popular);
        });
        return () => unsubscribe();
    }, []);

    const tryOpenViaExtension = async (): Promise<boolean> => {
        if (window.TEXAExtension && window.TEXAExtension.ready) {
            try {
                window.TEXAExtension.openTool(tool.id, tool.targetUrl, tool.apiUrl);
                return true;
            } catch (error) {
                return false;
            }
        }

        const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;

        return await new Promise<boolean>((resolve) => {
            const timeoutId = window.setTimeout(() => {
                window.removeEventListener('message', onAck);
                resolve(false);
            }, 800);

            const onAck = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return;
                const data = (event.data || {}) as any;
                if (data.type !== 'TEXA_OPEN_TOOL_ACK') return;
                if (data.requestId !== requestId) return;
                window.clearTimeout(timeoutId);
                window.removeEventListener('message', onAck);
                resolve(Boolean(data.ok));
            };

            window.addEventListener('message', onAck);
            window.postMessage({
                type: 'TEXA_OPEN_TOOL',
                requestId,
                toolId: tool.id,
                idToken,
                targetUrl: tool.targetUrl,
                cookiesData: tool.cookiesData || null,
                apiUrl: tool.apiUrl || null
            }, window.location.origin);
        });
    };

    const handleClick = async () => {
        if (!hasAccess) {
            setShowSubscribePopup(true);
            return;
        }

        const canIframe = tool.openMode === 'iframe' && isUrlIframeAllowed(tool.targetUrl);
        if (canIframe) {
            navigate(`/tool/${tool.id}`);
            return;
        }

        setInjecting(true);
        setStatus("Memeriksa Extension...");

        const isExtensionInstalled = await checkExtensionInstalled();
        if (!isExtensionInstalled) {
            setInjecting(false);
            setStatus(null);
            setShowExtensionWarning(true);
            return;
        }

        setStatus("Syncing Sesi...");
        setTimeout(() => {
            setStatus("Menyiapkan Akses...");
            setTimeout(async () => {
                setInjecting(false);
                setStatus("Berhasil!");
                const openedByExtension = await tryOpenViaExtension();
                if (!openedByExtension) window.open(tool.targetUrl, '_blank');
                setTimeout(() => setStatus(null), 2000);
            }, 1000);
        }, 800);
    };

    const handleBuyPackage = () => {
        if (!selectedPackage) return;

        let paymentUrl = settings.paymentUrl;
        if (paymentUrl) {
            const separator = paymentUrl.includes('?') ? '&' : '?';
            paymentUrl += `${separator}package=${selectedPackage.id}&amount=${selectedPackage.discountPrice || selectedPackage.price}&duration=${selectedPackage.duration}`;
            window.open(paymentUrl, '_blank');
        } else if (settings.whatsappNumber) {
            const message = encodeURIComponent(
                `Halo, saya ingin berlangganan TEXA-Ai:\n\n` +
                `📦 Paket: ${selectedPackage.name}\n` +
                `💰 Harga: ${formatIDR(selectedPackage.discountPrice || selectedPackage.price)}\n` +
                `⏰ Durasi: ${selectedPackage.duration} hari\n\n` +
                `Mohon info cara pembayarannya. Terima kasih!`
            );
            window.open(`https://wa.me/${settings.whatsappNumber}?text=${message}`, '_blank');
        } else {
            alert('Silakan hubungi admin untuk berlangganan.');
        }
        setShowSubscribePopup(false);
    };

    return (
        <>
            {/* Card - Silver Doff Metal Plate (both themes) */}
            <div
                onClick={handleClick}
                className="group rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer flex flex-col h-full relative bg-gradient-to-br from-slate-300 via-gray-200 to-zinc-300 dark:from-slate-400 dark:via-gray-300 dark:to-zinc-400 border border-slate-400/50 dark:border-slate-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_12px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_12px_rgba(0,0,0,0.2)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(0,0,0,0.2)] dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(0,0,0,0.3)] hover:border-indigo-500/60 dark:hover:border-indigo-400/60"
            >
                {/* Image Container */}
                <div className="relative h-28 sm:h-32 overflow-hidden bg-slate-400 dark:bg-slate-500">
                    <img
                        src={tool.imageUrl}
                        alt={tool.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />

                    {/* Category Badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600/95 dark:bg-indigo-700/95 backdrop-blur-sm rounded-md text-[8px] md:text-[9px] font-bold text-white uppercase tracking-wide shadow-lg">
                        {tool.category}
                    </div>

                    {/* Status Badge */}
                    {hasAccess && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-500/95 backdrop-blur-sm rounded-md text-[8px] font-bold text-white shadow-lg">
                            ✓ Aktif
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-3 sm:p-4 flex-grow flex flex-col">
                    {/* Title - Dark text on silver doff */}
                    <h3 className="text-sm sm:text-base font-bold text-zinc-800 dark:text-zinc-900 mb-1 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-700 transition-colors">
                        {tool.name}
                    </h3>

                    <p className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-700 line-clamp-2 mb-3 leading-relaxed">
                        {tool.description}
                    </p>

                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-400/40 dark:border-zinc-500/30">
                        <div>
                            <span className="text-[8px] text-zinc-500 dark:text-zinc-600 uppercase tracking-widest font-medium">Mulai</span>
                            <p className="text-sm sm:text-base font-bold text-zinc-800 dark:text-zinc-900">
                                {formatIDR(tool.priceMonthly)}
                            </p>
                        </div>

                        <button
                            disabled={injecting}
                            className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all active:scale-95 ${injecting
                                ? 'bg-amber-500/20 text-amber-400'
                                : hasAccess
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                    : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                }`}
                        >
                            {injecting ? '⏳' : hasAccess ? '🚀 Buka' : '🛒 Beli'}
                        </button>
                    </div>
                </div>

                {/* Loading Overlay */}
                {status && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-300/95 dark:bg-slate-400/95 backdrop-blur-sm z-10">
                        <div className="text-center">
                            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-zinc-800 dark:text-zinc-900 text-xs font-bold">{status}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Subscription Popup */}
            {showSubscribePopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowSubscribePopup(false)}>
                    <div className="glass rounded-[24px] p-6 max-w-lg w-full border border-white/20 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowSubscribePopup(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full glass border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">✕</button>

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 premium-gradient rounded-2xl mx-auto mb-3 flex items-center justify-center">
                                <span className="text-3xl">💎</span>
                            </div>
                            <h2 className="text-2xl font-black text-white mb-1">{settings.popupTitle || 'Berlangganan Premium'}</h2>
                            <p className="text-slate-400 text-sm">{settings.popupDescription || 'Pilih paket untuk akses penuh semua AI Tools.'}</p>
                        </div>

                        <div className="glass rounded-xl p-3 mb-4 border border-white/10 flex items-center gap-3">
                            <img src={tool.imageUrl} alt={tool.name} className="w-12 h-12 rounded-lg object-cover" />
                            <div>
                                <h3 className="font-bold text-white text-sm">{tool.name}</h3>
                                <p className="text-xs text-slate-400">{tool.category}</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4">
                            {settings.packages.filter(p => p.active).map((pkg) => (
                                <div
                                    key={pkg.id}
                                    onClick={() => setSelectedPackage(pkg)}
                                    className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${selectedPackage?.id === pkg.id
                                        ? 'border-indigo-500 bg-indigo-500/10'
                                        : 'border-white/10 bg-black/30 hover:border-white/30'
                                        } ${pkg.popular ? 'ring-2 ring-indigo-500/50' : ''}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPackage?.id === pkg.id ? 'border-indigo-500 bg-indigo-500' : 'border-white/30'
                                                }`}>
                                                {selectedPackage?.id === pkg.id && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white text-sm">{pkg.name}</span>
                                                    {pkg.popular && <span className="px-1.5 py-0.5 bg-indigo-600 rounded-full text-[8px] font-bold text-white">POPULER</span>}
                                                </div>
                                                <span className="text-[10px] text-slate-400">{pkg.duration} Hari Akses</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {pkg.discountPrice ? (
                                                <>
                                                    <span className="text-[10px] text-slate-500 line-through">{formatIDR(pkg.price)}</span>
                                                    <p className="text-base font-black text-emerald-400">{formatIDR(pkg.discountPrice)}</p>
                                                </>
                                            ) : (
                                                <p className="text-base font-black text-white">{formatIDR(pkg.price)}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleBuyPackage}
                            disabled={!selectedPackage}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            🛒 {settings.buttonText || 'Beli Sekarang'}
                            {selectedPackage && <span className="text-indigo-200">- {formatIDR(selectedPackage.discountPrice || selectedPackage.price)}</span>}
                        </button>

                        {settings.whatsappNumber && (
                            <a
                                href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent('Halo, saya ingin bertanya tentang langganan TEXA-Ai')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full mt-2 py-2 rounded-xl glass border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-2 hover:border-emerald-500/50 transition-all"
                            >
                                💬 Tanya via WhatsApp
                            </a>
                        )}

                        <p className="text-center text-[9px] text-slate-500 mt-3">🔒 Pembayaran aman & terenkripsi</p>
                    </div>
                </div>
            )}

            {/* Extension Warning Popup */}
            <ExtensionWarningPopup
                isOpen={showExtensionWarning}
                onClose={() => setShowExtensionWarning(false)}
                toolName={tool.name}
            />
        </>
    );
};

export default CompactToolCard;

