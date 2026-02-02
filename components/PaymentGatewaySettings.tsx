// Payment Gateway Settings Component
// Admin UI for configuring multiple payment gateways

import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseService';

interface PaymentGateway {
    id: string;
    name: string;
    type: 'tokopay' | 'midtrans' | 'xendit';
    is_active: boolean;
    is_default: boolean;
    config: Record<string, any>;
}

interface PaymentGatewaySettingsProps {
    showToast: (message: string, type: 'success' | 'error') => void;
}

const PaymentGatewaySettings: React.FC<PaymentGatewaySettingsProps> = ({ showToast }) => {
    const [gateways, setGateways] = useState<PaymentGateway[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        type: 'tokopay' as 'tokopay' | 'midtrans' | 'xendit',
        is_active: false,
        is_default: false,
        config: {} as Record<string, any>
    });

    // Fetch gateways directly from Supabase with comprehensive debugging
    const fetchGateways = async (retryCount = 0) => {
        try {
            console.log('[PaymentGateways] === START FETCH ===');
            console.log('[PaymentGateways] Retry count:', retryCount);

            // Check auth session FIRST
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            console.log('[PaymentGateways] Auth session:', {
                hasSession: !!sessionData.session,
                userId: sessionData.session?.user?.id,
                email: sessionData.session?.user?.email,
                sessionError: sessionError ? sessionError.message : null
            });

            if (!sessionData.session) {
                console.error('[PaymentGateways] No active auth session!');
                showToast('Authentication required. Please login again.', 'error');
                setGateways([]);
                setLoading(false);
                return;
            }

            console.log('[PaymentGateways] Starting Supabase query...');

            // Create an AbortController with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn('[PaymentGateways] Query timeout triggered (10s)');
                controller.abort();
            }, 10000);

            console.log('[PaymentGateways] Executing .from("payment_gateways").select("*")...');
            const { data, error } = await supabase
                .from('payment_gateways')
                .select('*')
                .order('created_at', { ascending: false })
                .abortSignal(controller.signal);

            clearTimeout(timeoutId);
            console.log('[PaymentGateways] Query completed');

            if (error) {
                console.error('[PaymentGateways] Supabase error:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                });
                showToast(error.message || 'Failed to fetch gateways', 'error');
                setGateways([]);
            } else {
                console.log('[PaymentGateways] Success! Data:', data);
                console.log('[PaymentGateways] Row count:', data?.length || 0);
                setGateways(data || []);

                if ((data || []).length === 0) {
                    console.warn('[PaymentGateways] No gateways found in database');
                }
            }
        } catch (error: any) {
            console.error('[PaymentGateways] Exception:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });

            // Retry once on AbortError
            if (retryCount < 1 && (error.name === 'AbortError' || error.message?.includes('abort'))) {
                console.log('[PaymentGateways] Retrying after AbortError (attempt ' + (retryCount + 2) + ')');
                setTimeout(() => fetchGateways(retryCount + 1), 1500);
                return;
            }

            showToast('Failed to fetch gateways: ' + (error.message || 'Unknown error'), 'error');
            setGateways([]);
        } finally {
            console.log('[PaymentGateways] === END FETCH ===');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGateways();
    }, []);

    // Open modal for create/edit
    const openModal = (gateway?: PaymentGateway) => {
        if (gateway) {
            setEditingGateway(gateway);
            setFormData({
                name: gateway.name,
                type: gateway.type,
                is_active: gateway.is_active,
                is_default: gateway.is_default,
                config: gateway.config
            });
        } else {
            setEditingGateway(null);
            setFormData({
                name: '',
                type: 'tokopay',
                is_active: false,
                is_default: false,
                config: {}
            });
        }
        setShowModal(true);
    };

    // Save gateway directly to Supabase
    const handleSave = async () => {
        try {
            setSaving(true);

            if (editingGateway) {
                // Update existing gateway
                const { error } = await supabase
                    .from('payment_gateways')
                    .update({
                        name: formData.name,
                        is_active: formData.is_active,
                        is_default: formData.is_default,
                        config: formData.config,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingGateway.id);

                if (error) {
                    showToast(error.message || 'Failed to update gateway', 'error');
                } else {
                    showToast('Gateway updated successfully', 'success');
                    setShowModal(false);
                    fetchGateways();
                }
            } else {
                // Create new gateway
                const { error } = await supabase
                    .from('payment_gateways')
                    .insert({
                        name: formData.name,
                        type: formData.type,
                        is_active: formData.is_active,
                        is_default: formData.is_default,
                        config: formData.config
                    });

                if (error) {
                    showToast(error.message || 'Failed to create gateway', 'error');
                } else {
                    showToast('Gateway created successfully', 'success');
                    setShowModal(false);
                    fetchGateways();
                }
            }
        } catch (error) {
            console.error('Error saving gateway:', error);
            showToast('Failed to save gateway', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Test connection
    const handleTestConnection = async (gatewayId: string) => {
        try {
            setTestingId(gatewayId);
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            if (!token) {
                showToast('Not authenticated', 'error');
                return;
            }

            const response = await fetch('/api/admin/payment-gateways/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ gatewayId })
            });

            const data = await response.json();
            if (data.success) {
                showToast(data.message || 'Connection successful', 'success');
            } else {
                showToast(data.message || 'Connection failed', 'error');
            }
        } catch (error) {
            console.error('Error testing connection:', error);
            showToast('Failed to test connection', 'error');
        } finally {
            setTestingId(null);
        }
    };

    // Delete gateway directly from Supabase
    const handleDelete = async (gatewayId: string) => {
        if (!confirm('Are you sure you want to delete this gateway?')) return;

        try {
            const { error } = await supabase
                .from('payment_gateways')
                .delete()
                .eq('id', gatewayId);

            if (error) {
                showToast(error.message || 'Failed to delete gateway', 'error');
            } else {
                showToast('Gateway deleted successfully', 'success');
                fetchGateways();
            }
        } catch (error) {
            console.error('Error deleting gateway:', error);
            showToast('Failed to delete gateway', 'error');
        }
    };

    // Render config fields based on gateway type
    const renderConfigFields = () => {
        switch (formData.type) {
            case 'tokopay':
                return (
                    <>
                        <div className="setting-item">
                            <label>Merchant ID *</label>
                            <input
                                type="text"
                                value={formData.config.merchantId || ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    config: { ...formData.config, merchantId: e.target.value }
                                })}
                                placeholder="M250828KEAYY483"
                            />
                        </div>
                        <div className="setting-item">
                            <label>Secret Key *</label>
                            <input
                                type="password"
                                value={formData.config.secretKey || ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    config: { ...formData.config, secretKey: e.target.value }
                                })}
                                placeholder="Your secret key"
                            />
                        </div>
                        <div className="setting-item">
                            <label>Webhook IP (Optional)</label>
                            <input
                                type="text"
                                value={formData.config.webhookIp || '178.128.104.179'}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    config: { ...formData.config, webhookIp: e.target.value }
                                })}
                                placeholder="178.128.104.179"
                            />
                        </div>
                    </>
                );
            case 'midtrans':
                return (
                    <>
                        <div className="setting-item">
                            <label>Server Key *</label>
                            <input
                                type="password"
                                value={formData.config.serverKey || ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    config: { ...formData.config, serverKey: e.target.value }
                                })}
                                placeholder="Your server key"
                            />
                        </div>
                        <div className="setting-item">
                            <label>Client Key *</label>
                            <input
                                type="text"
                                value={formData.config.clientKey || ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    config: { ...formData.config, clientKey: e.target.value }
                                })}
                                placeholder="Your client key"
                            />
                        </div>
                        <div className="setting-item">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.config.isProduction || false}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        config: { ...formData.config, isProduction: e.target.checked }
                                    })}
                                />
                                Production Mode
                            </label>
                        </div>
                    </>
                );
            case 'xendit':
                return (
                    <>
                        <div className="setting-item">
                            <label>API Key *</label>
                            <input
                                type="password"
                                value={formData.config.apiKey || ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    config: { ...formData.config, apiKey: e.target.value }
                                })}
                                placeholder="Your API key"
                            />
                        </div>
                        <div className="setting-item">
                            <label>Webhook Token</label>
                            <input
                                type="password"
                                value={formData.config.webhookToken || ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    config: { ...formData.config, webhookToken: e.target.value }
                                })}
                                placeholder="Your webhook verification token"
                            />
                        </div>
                    </>
                );
        }
    };

    // Copy to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard', 'success');
    };

    // Get webhook URL based on gateway type
    const getWebhookUrl = (type: string) => {
        const baseUrl = window.location.origin;
        switch (type) {
            case 'tokopay':
                return `${baseUrl}/api/tokopay/webhook`;
            case 'midtrans':
                return `${baseUrl}/api/midtrans/webhook`;
            case 'xendit':
                return `${baseUrl}/api/xendit/webhook`;
            default:
                return `${baseUrl}/api/${type}/webhook`;
        }
    };

    if (loading) {
        return <div className="settings-loading">Loading payment gateways...</div>;
    }

    return (
        <div className="payment-gateway-settings">
            <div className="settings-header">
                <h2>⚙️ Payment Gateway Settings</h2>
                <button onClick={() => openModal()} className="btn-primary">
                    + Add Gateway
                </button>
            </div>

            <div className="gateway-list">
                {gateways.length === 0 ? (
                    <div className="empty-state">
                        <p>No payment gateways configured yet.</p>
                        <button onClick={() => openModal()} className="btn-secondary">
                            Add Your First Gateway
                        </button>
                    </div>
                ) : (
                    gateways.map((gateway) => (
                        <div key={gateway.id} className="gateway-card">
                            <div className="gateway-header">
                                <div className="gateway-title">
                                    <h3>{gateway.name}</h3>
                                    {gateway.is_default && <span className="badge-default">Default</span>}
                                    {gateway.is_active ? (
                                        <span className="badge-active">Active</span>
                                    ) : (
                                        <span className="badge-inactive">Inactive</span>
                                    )}
                                </div>
                                <div className="gateway-actions">
                                    <button
                                        onClick={() => handleTestConnection(gateway.id)}
                                        disabled={testingId === gateway.id}
                                        className="btn-test"
                                    >
                                        {testingId === gateway.id ? 'Testing...' : 'Test Connection'}
                                    </button>
                                    <button onClick={() => openModal(gateway)} className="btn-edit">
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(gateway.id)} className="btn-delete">
                                        Delete
                                    </button>
                                </div>
                            </div>

                            <div className="gateway-details">
                                <div className="detail-item">
                                    <label>Type:</label>
                                    <span>{gateway.type}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Webhook URL:</label>
                                    <div className="url-copy">
                                        <code>{getWebhookUrl(gateway.type)}</code>
                                        <button onClick={() => copyToClipboard(getWebhookUrl(gateway.type))}>
                                            📋 Copy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingGateway ? 'Edit Gateway' : 'Add New Gateway'}</h3>
                            <button onClick={() => setShowModal(false)} className="modal-close">×</button>
                        </div>

                        <div className="modal-body">
                            <div className="setting-item">
                                <label>Gateway Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="TokoPay"
                                />
                            </div>

                            <div className="setting-item">
                                <label>Gateway Type *</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        type: e.target.value as 'tokopay' | 'midtrans' | 'xendit',
                                        config: {}
                                    })}
                                    disabled={!!editingGateway}
                                >
                                    <option value="tokopay">TokoPay</option>
                                    <option value="midtrans">Midtrans</option>
                                    <option value="xendit">Xendit</option>
                                </select>
                            </div>

                            {renderConfigFields()}

                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    Active
                                </label>
                            </div>

                            <div className="setting-item">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.is_default}
                                        onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                                    />
                                    Set as Default Gateway
                                </label>
                            </div>

                            {formData.type && (
                                <div className="webhook-info">
                                    <h4>📡 Webhook Configuration</h4>
                                    <p>Use this URL in your {formData.type} dashboard:</p>
                                    <div className="url-copy">
                                        <code>{getWebhookUrl(formData.type)}</code>
                                        <button onClick={() => copyToClipboard(getWebhookUrl(formData.type))}>
                                            📋 Copy
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button onClick={() => setShowModal(false)} className="btn-secondary">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving} className="btn-primary">
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .payment-gateway-settings {
                    padding: 24px;
                }

                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .settings-header h2 {
                    margin: 0;
                    font-size: 1.5rem;
                }

                .gateway-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .gateway-card {
                    background: var(--bg-secondary, #1a1a2e);
                    border: 1px solid var(--border-color, #2a2a3e);
                    border-radius: 8px;
                    padding: 20px;
                }

                .gateway-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .gateway-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .gateway-title h3 {
                    margin: 0;
                    font-size: 1.25rem;
                }

                .badge-default, .badge-active, .badge-inactive {
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }

                .badge-default {
                    background: #ffd700;
                    color: #000;
                }

                .badge-active {
                    background: #4caf50;
                    color: #fff;
                }

                .badge-inactive {
                    background: #888;
                    color: #fff;
                }

                .gateway-actions {
                    display: flex;
                    gap: 8px;
                }

                .gateway-details {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .detail-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .detail-item label {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--text-secondary, #888);
                }

                .url-copy {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }

                .url-copy code {
                    flex: 1;
                    background: var(--bg-tertiary, #0f0f1e);
                    padding: 8px 12px;
                    border-radius: 4px;
                    font-size: 0.875rem;
                    overflow-x: auto;
                }

                .empty-state {
                    text-align: center;
                    padding: 48px 24px;
                    background: var(--bg-secondary, #1a1a2e);
                    border: 1px dashed var(--border-color, #2a2a3e);
                    border-radius: 8px;
                }

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                }

                .modal-content {
                    background: var(--bg-primary, #0f0f1e);
                    border: 1px solid var(--border-color, #2a2a3e);
                    border-radius: 12px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--border-color, #2a2a3e);
                }

                .modal-header h3 {
                    margin: 0;
                    font-size: 1.25rem;
                }

                .modal-close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: var(--text-primary, #fff);
                    padding: 0;
                    width: 32px;
                    height: 32px;
                }

                .modal-body {
                    padding: 24px;
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 20px 24px;
                    border-top: 1px solid var(--border-color, #2a2a3e);
                }

                .setting-item {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .setting-item label {
                    font-size: 0.875rem;
                    font-weight: 600;
                }

                .setting-item input[type="text"],
                .setting-item input[type="password"],
                .setting-item select {
                    padding: 10px 12px;
                    border: 1px solid var(--border-color, #2a2a3e);
                    border-radius: 6px;
                    background: var(--bg-secondary, #1a1a2e);
                    color: var(--text-primary, #fff);
                    font-size: 0.875rem;
                }

                .setting-item input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }

                .webhook-info {
                    margin-top: 24px;
                    padding: 16px;
                    background: var(--bg-secondary, #1a1a2e);
                    border-radius: 8px;
                    border-left: 3px solid #4caf50;
                }

                .webhook-info h4 {
                    margin: 0 0 8px 0;
                    font-size: 1rem;
                }

                .webhook-info p {
                    margin: 0 0 12px 0;
                    font-size: 0.875rem;
                    color: var(--text-secondary, #888);
                }

                .btn-primary, .btn-secondary, .btn-test, .btn-edit, .btn-delete {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: #fff;
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }

                .btn-secondary {
                    background: var(--bg-secondary, #1a1a2e);
                    border: 1px solid var(--border-color, #2a2a3e);
                    color: var(--text-primary, #fff);
                }

                .btn-test {
                    background: #2196f3;
                    color: #fff;
                }

                .btn-edit {
                    background: #ff9800;
                    color: #fff;
                }

                .btn-delete {
                    background: #f44336;
                    color: #fff;
                }

                .btn-primary:disabled, .btn-test:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
};

export default PaymentGatewaySettings;
