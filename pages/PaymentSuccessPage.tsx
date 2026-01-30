// Payment Success Page - Show success notification after Tokopay payment
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatIDR } from '../services/tokopayService';

interface PendingPayment {
    refId: string;
    type: 'subscription' | 'individual';
    itemId: string;
    itemName: string;
    duration: number;
    amount: number;
    payUrl: string;
    createdAt: string;
}

const PaymentSuccessPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [paymentInfo, setPaymentInfo] = useState<PendingPayment | null>(null);
    const [status, setStatus] = useState<'checking' | 'success' | 'pending' | 'error'>('checking');
    const [countdown, setCountdown] = useState(5);

    // Dev mode detection
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiBaseUrl = isDev ? 'http://127.0.0.1:8787' : '';

    // Load pending payment from localStorage or URL params
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const refIdFromUrl = searchParams.get('ref_id') || searchParams.get('refId');

        // Try to load from localStorage first
        const pendingStr = localStorage.getItem('pendingPayment');
        if (pendingStr) {
            try {
                const pending = JSON.parse(pendingStr) as PendingPayment;
                setPaymentInfo(pending);
                return;
            } catch (e) {
                console.error('Failed to parse pending payment:', e);
            }
        }

        // If no localStorage data but has refId in URL, create minimal info
        if (refIdFromUrl) {
            setPaymentInfo({
                refId: refIdFromUrl,
                type: 'subscription',
                itemId: '',
                itemName: 'Pembelian',
                duration: 30,
                amount: 0,
                payUrl: '',
                createdAt: new Date().toISOString()
            });
        }
    }, [location.search]);

    // Check payment status
    useEffect(() => {
        if (!paymentInfo?.refId) return;

        const checkStatus = async () => {
            try {
                const resp = await fetch(`${apiBaseUrl}/api/tokopay/check-status?refId=${paymentInfo.refId}`);
                const data = await resp.json();

                if (data.status === 'paid') {
                    setStatus('success');
                    // Clear localStorage after successful payment
                    localStorage.removeItem('pendingPayment');
                } else {
                    setStatus('pending');
                }
            } catch (error) {
                console.error('Error checking payment status:', error);
                setStatus('error');
            }
        };

        // Initial check
        checkStatus();

        // Poll every 3 seconds if still pending
        const interval = setInterval(() => {
            if (status === 'checking' || status === 'pending') {
                checkStatus();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [paymentInfo?.refId, apiBaseUrl, status]);

    // Countdown timer for redirect
    useEffect(() => {
        if (status !== 'success') return;

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Redirect to dashboard with tool info
                    if (paymentInfo?.type === 'individual' && paymentInfo.itemId) {
                        navigate(`/?openTool=${paymentInfo.itemId}`);
                    } else {
                        navigate('/');
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [status, paymentInfo, navigate]);

    // Handle manual redirect
    const handleGoToDashboard = () => {
        localStorage.removeItem('pendingPayment');
        if (paymentInfo?.type === 'individual' && paymentInfo.itemId) {
            navigate(`/?openTool=${paymentInfo.itemId}`);
        } else {
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-8">

                    {/* Checking Status */}
                    {status === 'checking' && (
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <h1 className="text-2xl font-black text-white mb-2">Memeriksa Pembayaran...</h1>
                            <p className="text-slate-400">Mohon tunggu sebentar</p>
                        </div>
                    )}

                    {/* Payment Success */}
                    {status === 'success' && (
                        <div className="text-center">
                            <div className="text-8xl mb-6 animate-bounce">🎉</div>
                            <h1 className="text-3xl font-black text-emerald-400 mb-2">Pembayaran Berhasil!</h1>
                            <p className="text-white font-bold text-lg mb-1">{paymentInfo?.itemName}</p>
                            {paymentInfo?.amount && paymentInfo.amount > 0 && (
                                <p className="text-emerald-400 font-bold mb-4">{formatIDR(paymentInfo.amount)}</p>
                            )}
                            <p className="text-slate-400 mb-6">
                                {paymentInfo?.type === 'subscription'
                                    ? `Paket aktif selama ${paymentInfo?.duration} hari`
                                    : `Akses tool aktif selama ${paymentInfo?.duration} hari`
                                }
                            </p>

                            <div className="bg-white/5 rounded-2xl p-4 mb-6">
                                <p className="text-slate-400 text-sm">Mengalihkan ke dashboard dalam</p>
                                <p className="text-4xl font-black text-white">{countdown}</p>
                            </div>

                            <button
                                onClick={handleGoToDashboard}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-lg transition-all shadow-lg"
                            >
                                🚀 Buka Dashboard Sekarang
                            </button>
                        </div>
                    )}

                    {/* Payment Pending */}
                    {status === 'pending' && (
                        <div className="text-center">
                            <div className="text-8xl mb-6">⏳</div>
                            <h1 className="text-2xl font-black text-amber-400 mb-2">Menunggu Pembayaran</h1>
                            <p className="text-white font-bold mb-1">{paymentInfo?.itemName}</p>
                            <p className="text-slate-400 mb-6">Silakan selesaikan pembayaran Anda</p>

                            <div className="flex items-center justify-center gap-2 text-amber-400 text-sm mb-6">
                                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                                Menunggu konfirmasi dari Tokopay...
                            </div>

                            {paymentInfo?.payUrl && (
                                <a
                                    href={paymentInfo.payUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-lg transition-all shadow-lg mb-4"
                                >
                                    🔗 Buka Halaman Pembayaran
                                </a>
                            )}

                            <button
                                onClick={() => navigate('/')}
                                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
                            >
                                ← Kembali ke Dashboard
                            </button>
                        </div>
                    )}

                    {/* Error State */}
                    {status === 'error' && (
                        <div className="text-center">
                            <div className="text-8xl mb-6">❌</div>
                            <h1 className="text-2xl font-black text-red-400 mb-2">Terjadi Kesalahan</h1>
                            <p className="text-slate-400 mb-6">Gagal memeriksa status pembayaran</p>

                            <button
                                onClick={() => setStatus('checking')}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-lg transition-all shadow-lg mb-4"
                            >
                                🔄 Coba Lagi
                            </button>

                            <button
                                onClick={() => navigate('/')}
                                className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
                            >
                                ← Kembali ke Dashboard
                            </button>
                        </div>
                    )}

                    {/* Security Badge */}
                    <p className="text-center text-slate-500 text-xs mt-6">
                        🔒 Pembayaran diproses secara aman oleh TokoPay
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccessPage;
