
import React, { useState, useEffect } from 'react';
import { AITool } from '../types';
import { auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { isUrlIframeAllowed } from '../utils/iframePolicy';
import {
  subscribeToSettings,
  SubscriptionSettings,
  SubscriptionPackage,
  formatIDR,
  DEFAULT_SETTINGS
} from '../services/subscriptionService';
import { checkExtensionInstalled } from '../services/extensionService';
import { usePopupState } from '../services/popupContext';
import ExtensionWarningPopup from './ExtensionWarningPopup';

interface ToolCardProps {
  tool: AITool;
  hasAccess: boolean;
  onBuyClick?: () => void;
}

// Parse various YouTube URL formats and convert to embed URL
const parseYouTubeUrl = (url: string): string | null => {
  if (!url) return null;

  try {
    let videoId: string | null = null;

    // Pattern 1: youtube.com/shorts/VIDEO_ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      videoId = shortsMatch[1];
    }

    // Pattern 2: youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
    if (watchMatch) {
      videoId = watchMatch[1];
    }

    // Pattern 3: youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (shortMatch) {
      videoId = shortMatch[1];
    }

    // Pattern 4: youtube.com/embed/VIDEO_ID (already embed)
    const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    if (embedMatch) {
      videoId = embedMatch[1];
    }

    // Pattern 5: youtube.com/v/VIDEO_ID
    const vMatch = url.match(/youtube\.com\/v\/([a-zA-Z0-9_-]+)/);
    if (vMatch) {
      videoId = vMatch[1];
    }

    if (videoId) {
      // Remove any query params from video ID
      videoId = videoId.split('?')[0].split('&')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }

    return null;
  } catch {
    return null;
  }
};

const ToolCard: React.FC<ToolCardProps> = ({ tool, hasAccess, onBuyClick }) => {
  const navigate = useNavigate();
  const [injecting, setInjecting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showSubscribePopup, setShowSubscribePopup] = useState(false);
  const [showVideoPopup, setShowVideoPopup] = useState(false);
  const [showExtensionWarning, setShowExtensionWarning] = useState(false);
  const [settings, setSettings] = useState<SubscriptionSettings>(DEFAULT_SETTINGS);
  const [selectedPackage, setSelectedPackage] = useState<SubscriptionPackage | null>(null);

  // Get embed URL from video URL
  const embedUrl = parseYouTubeUrl(tool.embedVideoUrl || '');

  // Register popup states to hide/show header/footer
  usePopupState(showSubscribePopup || showVideoPopup || showExtensionWarning);

  // Subscribe to settings
  useEffect(() => {
    const unsubscribe = subscribeToSettings((fetchedSettings) => {
      setSettings(fetchedSettings);
      // Auto-select popular package
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
        console.error('Extension open tool failed:', error);
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
      window.postMessage(
        {
          type: 'TEXA_OPEN_TOOL',
          requestId,
          toolId: tool.id,
          idToken,
          targetUrl: tool.targetUrl,
          // Kirim cookiesData langsung dari tool jika ada
          cookiesData: tool.cookiesData || null,
          // Kirim apiUrl untuk fetch cookies dinamis
          apiUrl: tool.apiUrl || null
        },
        window.location.origin
      );
    });
  };

  const handleOpenTool = async () => {
    if (!hasAccess) {
      setShowSubscribePopup(true);
      return;
    }

    const canIframe = tool.openMode === 'iframe' && isUrlIframeAllowed(tool.targetUrl);

    if (canIframe) {
      navigate(`/tool/${tool.id}`);
      return;
    }

    // Check if extension is installed first
    setInjecting(true);
    setStatus("Memeriksa Extension...");

    const isExtensionInstalled = await checkExtensionInstalled();

    if (!isExtensionInstalled) {
      // Extension not installed, show warning popup
      setInjecting(false);
      setStatus(null);
      setShowExtensionWarning(true);
      return;
    }

    // Extension is installed, proceed with opening tool
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

    // Build payment URL with query params
    let paymentUrl = settings.paymentUrl;

    if (paymentUrl) {
      const separator = paymentUrl.includes('?') ? '&' : '?';
      paymentUrl += `${separator}package=${selectedPackage.id}&amount=${selectedPackage.discountPrice || selectedPackage.price}&duration=${selectedPackage.duration}`;

      // Redirect to payment
      window.open(paymentUrl, '_blank');
    } else if (settings.whatsappNumber) {
      // Fallback to WhatsApp
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
      <div className="glass-card group rounded-[24px] md:rounded-[32px] overflow-hidden hover:border-indigo-500/40 transition-all duration-500 flex flex-col h-full relative smooth-animate">
        <div className="relative h-48 md:h-56 overflow-hidden">
          <img
            src={tool.imageUrl}
            alt={tool.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            loading="lazy"
          />
          <div className="absolute top-3 left-3 md:top-4 md:left-4 px-3 py-1 bg-black/60 backdrop-blur-xl rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest text-indigo-300 border border-white/10">
            {tool.category}
          </div>

          {/* Play Button - Minimal & Transparent (only visible on hover) */}
          {embedUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowVideoPopup(true);
              }}
              className="absolute inset-0 flex items-center justify-center group/play cursor-pointer"
            >
              {/* Very Subtle Overlay - only visible on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover/play:bg-black/30 transition-all duration-300" />

              {/* Play Button - Very Small & Transparent by default, visible on hover */}
              <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/10 border border-white/10 flex items-center justify-center transition-all duration-300 opacity-40 group-hover/play:opacity-100 group-hover/play:scale-110 group-hover/play:bg-black/50 group-hover/play:border-white/40 group-hover/play:shadow-xl">
                {/* Play Icon - Subtle */}
                <svg
                  className="w-4 h-4 md:w-5 md:h-5 text-white/80 ml-0.5 group-hover/play:text-white transition-all"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>

              {/* Small Video Badge at corner instead of pulse animation */}
              <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-md text-[9px] font-bold text-white/70 flex items-center gap-1 opacity-60 group-hover/play:opacity-100 transition-all">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Video
              </div>
            </button>
          )}

          {/* Video Badge - Only show if no play button */}
          {tool.embedVideoUrl && !embedUrl && (
            <div className="absolute top-3 right-3 md:top-4 md:right-4 px-2 py-1 bg-purple-600/80 backdrop-blur-xl rounded-full text-[8px] font-bold text-white flex items-center gap-1">
              🎬 Video
            </div>
          )}
        </div>

        <div className="p-5 md:p-7 flex-grow flex flex-col relative">
          <h3 className="text-xl md:text-2xl font-black mb-2 md:mb-3 group-hover:text-indigo-400 transition-colors tracking-tight text-theme-primary">{tool.name}</h3>
          <p className="text-theme-secondary text-xs md:text-sm mb-6 line-clamp-2 font-medium leading-relaxed">
            {tool.description}
          </p>

          <div className="mt-auto pt-4 md:pt-6 border-t border-[var(--glass-border)] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[10px] text-theme-muted uppercase font-black tracking-widest">Mulai</span>
              <span className="text-sm md:text-lg font-black text-theme-primary leading-none">{formatIDR(tool.priceMonthly)}</span>
            </div>

            <button
              disabled={injecting}
              onClick={handleOpenTool}
              className={`px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-sm transition-all flex items-center gap-2 active:scale-95 smooth-animate ${injecting
                ? 'bg-amber-500/20 text-amber-400'
                : hasAccess
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/40'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-900/40'
                }`}
            >
              {injecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                  Proses...
                </>
              ) : hasAccess ? (
                <>🚀 Open Tools</>
              ) : (
                <>🛒 Beli</>
              )}
            </button>
          </div>
        </div>

        {status && (
          <div className="absolute inset-0 flex items-center justify-center glass backdrop-blur-2xl z-20 transition-opacity duration-300">
            <div className="text-center p-6">
              <div className="w-16 h-16 premium-gradient rounded-2xl mx-auto mb-4 flex items-center justify-center animate-bounce">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-white text-lg font-black tracking-tight">{status}</p>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Popup */}
      {showSubscribePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="glass rounded-[32px] p-8 max-w-2xl w-full border border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto relative">
            {/* Close button */}
            <button
              onClick={() => setShowSubscribePopup(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full glass border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 premium-gradient rounded-3xl mx-auto mb-4 flex items-center justify-center">
                <span className="text-4xl">💎</span>
              </div>
              <h2 className="text-3xl font-black text-white mb-2">
                {settings.popupTitle || 'Berlangganan Premium'}
              </h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                {settings.popupDescription || 'Pilih paket yang sesuai untuk akses penuh semua AI Tools premium.'}
              </p>
            </div>

            {/* Tool Preview */}
            <div className="glass rounded-2xl p-4 mb-6 border border-white/10 flex items-center gap-4">
              <img src={tool.imageUrl} alt={tool.name} className="w-16 h-16 rounded-xl object-cover" />
              <div>
                <h3 className="font-bold text-white">{tool.name}</h3>
                <p className="text-xs text-slate-400">{tool.category}</p>
              </div>
            </div>

            {/* Packages */}
            <div className="space-y-3 mb-6">
              {settings.packages.filter(p => p.active).map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-5 rounded-2xl cursor-pointer transition-all border-2 ${selectedPackage?.id === pkg.id
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-white/10 bg-black/30 hover:border-white/30'
                    } ${pkg.popular ? 'ring-2 ring-indigo-500/50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPackage?.id === pkg.id ? 'border-indigo-500 bg-indigo-500' : 'border-white/30'
                        }`}>
                        {selectedPackage?.id === pkg.id && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{pkg.name}</span>
                          {pkg.popular && (
                            <span className="px-2 py-0.5 bg-indigo-600 rounded-full text-[9px] font-bold text-white">
                              POPULER
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{pkg.duration} Hari Akses</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {pkg.discountPrice ? (
                        <>
                          <span className="text-xs text-slate-500 line-through">{formatIDR(pkg.price)}</span>
                          <p className="text-lg font-black text-emerald-400">{formatIDR(pkg.discountPrice)}</p>
                        </>
                      ) : (
                        <p className="text-lg font-black text-white">{formatIDR(pkg.price)}</p>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  {pkg.features.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                      {pkg.features.map((f, i) => (
                        <span key={i} className="text-[10px] text-emerald-400 flex items-center gap-1">
                          ✓ {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleBuyPackage}
                disabled={!selectedPackage}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-lg transition-all shadow-xl shadow-indigo-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                🛒 {settings.buttonText || 'Beli Sekarang'}
                {selectedPackage && (
                  <span className="text-indigo-200">
                    - {formatIDR(selectedPackage.discountPrice || selectedPackage.price)}
                  </span>
                )}
              </button>

              {settings.whatsappNumber && (
                <a
                  href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent('Halo, saya ingin bertanya tentang langganan TEXA-Ai')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-2xl glass border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 hover:border-emerald-500/50 transition-all"
                >
                  💬 Tanya via WhatsApp
                </a>
              )}
            </div>

            {/* Security Badge */}
            <div className="mt-6 text-center">
              <p className="text-[10px] text-slate-500 flex items-center justify-center gap-2">
                🔒 Pembayaran aman & terenkripsi
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Video Popup Modal */}
      {showVideoPopup && embedUrl && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setShowVideoPopup(false)}
        >
          <div
            className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowVideoPopup(false)}
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all z-10"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Video Title */}
            <div className="absolute -top-12 left-0 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden">
                <img src={tool.imageUrl} alt={tool.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">{tool.name}</h3>
                <p className="text-slate-400 text-xs">Preview Video</p>
              </div>
            </div>

            {/* YouTube iframe */}
            <iframe
              src={embedUrl}
              title={`${tool.name} - Preview Video`}
              className="w-full h-full bg-black"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
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

export default ToolCard;
