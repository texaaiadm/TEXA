import React, { useState, useEffect } from 'react';
import {
    ExtensionSettings,
    DEFAULT_EXTENSION_SETTINGS,
    subscribeToExtensionSettings,
    parseYouTubeToEmbed
} from '../services/extensionService';

interface ExtensionWarningPopupProps {
    isOpen: boolean;
    onClose: () => void;
    toolName?: string;
}

const ExtensionWarningPopup: React.FC<ExtensionWarningPopupProps> = ({
    isOpen,
    onClose,
    toolName
}) => {
    const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_EXTENSION_SETTINGS);

    // Subscribe to extension settings
    useEffect(() => {
        const unsubscribe = subscribeToExtensionSettings((fetchedSettings) => {
            setSettings(fetchedSettings);
        });
        return () => unsubscribe();
    }, []);

    if (!isOpen) return null;

    // Get embed URL from tutorial video
    const embedUrl = parseYouTubeToEmbed(settings.tutorialVideoUrl);

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-2 bg-black/90 backdrop-blur-md"
            onClick={onClose}
        >
            <div
                className="glass rounded-2xl w-full max-w-[420px] border border-white/20 shadow-2xl animate-popup overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Compact Header with gradient */}
                <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-3">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/30 backdrop-blur-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-black/50 transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Icon & Title - Compact */}
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center text-2xl shrink-0">
                            {settings.popupIcon || '🧩'}
                        </div>
                        <div className="min-w-0 pr-6">
                            <h2 className="text-base font-black text-white tracking-tight leading-tight">
                                {settings.popupTitle || 'Extension Belum Terpasang'}
                            </h2>
                            {toolName && (
                                <p className="text-white/70 text-[11px] mt-0.5 truncate">
                                    Untuk mengakses <span className="font-bold text-white">{toolName}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Compact Content */}
                <div className="p-4">
                    {/* Description - Shorter */}
                    <p className="text-slate-300 text-xs leading-relaxed mb-3">
                        {settings.popupDescription || 'Install extension TEXA-Ai untuk menggunakan fitur ini.'}
                    </p>

                    {/* Video Tutorial - Smaller aspect ratio */}
                    {settings.showTutorialVideo && embedUrl && (
                        <div className="mb-3">
                            <h3 className="text-[11px] font-bold text-white mb-2 flex items-center gap-1.5">
                                <span className="text-sm">🎬</span> Video Tutorial Instalasi
                            </h3>
                            <div className="relative w-full rounded-lg overflow-hidden bg-black/50 border border-white/10 shadow-lg" style={{ aspectRatio: '16/8' }}>
                                <iframe
                                    src={embedUrl}
                                    title="Tutorial Install Extension"
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                />
                            </div>
                        </div>
                    )}

                    {/* Compact Steps */}
                    <div className="mb-3 glass rounded-lg p-3 border border-white/10">
                        <h4 className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-2">
                            Langkah Instalasi
                        </h4>
                        <ol className="space-y-1.5 text-[11px] text-slate-300">
                            <li className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">1</span>
                                <span>Klik tombol <strong className="text-white">Download Extension</strong> di bawah</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">2</span>
                                <span>Ekstrak file ZIP dan buka <strong className="text-white">chrome://extensions/</strong></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">3</span>
                                <span>Aktifkan <strong className="text-white">Developer Mode</strong> lalu Drag & Drop zip ke dalam <strong className="text-white">Extension Manager</strong></span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">4</span>
                                <span>Pilih folder extension yang sudah diekstrak</span>
                            </li>
                        </ol>
                    </div>

                    {/* Compact Action Buttons */}
                    <div className="space-y-2">
                        {/* Download Button */}
                        {settings.downloadUrl && (
                            <a
                                href={settings.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm transition-all shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                {settings.downloadButtonText || '📦 Download Extension'}
                            </a>
                        )}

                        {/* Tutorial Article Link - optional */}
                        {settings.tutorialArticleUrl && (
                            <a
                                href={settings.tutorialArticleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2 rounded-lg glass border border-white/10 hover:border-indigo-500/50 text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
                            >
                                📖 Baca Artikel Tutorial
                            </a>
                        )}

                        {/* Close/Later Button - Inline with help text */}
                        <div className="flex items-center justify-between pt-1">
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                💬 Butuh bantuan? <span className="text-indigo-400">Hubungi admin</span>
                            </p>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-white font-medium text-xs transition-all px-3 py-1 hover:bg-white/5 rounded"
                            >
                                Nanti Saja
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom animation */}
            <style>{`
        @keyframes popupIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-popup {
          animation: popupIn 0.25s ease-out forwards;
        }
      `}</style>
        </div>
    );
};

export default ExtensionWarningPopup;
