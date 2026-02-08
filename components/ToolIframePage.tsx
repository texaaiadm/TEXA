import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { TexaUser } from '../services/supabaseAuthService';
import { getCatalogItem, CatalogItem } from '../services/supabaseCatalogService';
import { isUrlIframeAllowed } from '../utils/iframePolicy';
import { canAccessTool } from '../services/userToolsService';

const hasActiveSubscription = (user: TexaUser | null) => {
  if (!user?.subscriptionEnd) return false;
  return new Date(user.subscriptionEnd) > new Date();
};

const ToolIframePage: React.FC<{ user: TexaUser | null }> = ({ user }) => {
  const { toolId } = useParams();
  const [tool, setTool] = useState<CatalogItem | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [ready, setReady] = useState(false);       // Both access + tool fetched
  const [denied, setDenied] = useState(false);      // Access denied
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const hasSubscription = useMemo(() => hasActiveSubscription(user), [user]);

  // Single effect: fetch tool AND check access in PARALLEL
  useEffect(() => {
    let stopped = false;
    setReady(false);
    setDenied(false);
    setIframeLoaded(false);

    const init = async () => {
      if (!user || !toolId) {
        setDenied(true);
        return;
      }

      // Run tool fetch and access check concurrently
      const [toolResult, accessResult] = await Promise.all([
        getCatalogItem(toolId).catch(() => null),
        hasSubscription
          ? Promise.resolve(true)
          : canAccessTool(user, toolId).catch(() => false)
      ]);

      if (stopped) return;

      if (!accessResult) {
        setDenied(true);
        return;
      }

      setTool(toolResult);
      setHasAccess(true);
      setReady(true);
    };

    init();
    return () => { stopped = true; };
  }, [user, toolId, hasSubscription]);

  if (!user) return <Navigate to="/login" replace />;
  if (denied) return <Navigate to="/" replace />;

  // Compact loading state
  if (!ready) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
            <div className="w-32 h-5 rounded-lg bg-white/5 animate-pulse" />
          </div>
          <div className="w-24 h-8 rounded-xl bg-white/5 animate-pulse" />
        </div>
        <div className="w-full h-[86vh] rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-center">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Memuat tool...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <div className="glass rounded-2xl border border-white/10 p-8 text-center">
          <div className="text-5xl mb-3">📭</div>
          <h1 className="text-2xl font-black text-white mb-2">Tool tidak ditemukan</h1>
          <a href="#/" className="inline-flex mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
            Kembali
          </a>
        </div>
      </div>
    );
  }

  const iframeOk = tool.openMode === 'iframe' && isUrlIframeAllowed(tool.targetUrl);
  if (!iframeOk) return <Navigate to="/" replace />;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl premium-gradient flex items-center justify-center text-white font-black">
            T
          </div>
          <div>
            <div className="text-white font-black leading-tight">{tool.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="#/" className="px-4 py-2 rounded-xl text-xs font-black glass border border-white/10 text-white hover:border-indigo-500/50 transition-all">
            ← Kembali
          </a>
        </div>
      </div>

      {/* Iframe with loading overlay */}
      <div className="relative">
        {!iframeLoaded && (
          <div className="absolute inset-0 z-10 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-bold">Memuat {tool.name}...</p>
            </div>
          </div>
        )}
        <iframe
          title={tool.name}
          src={tool.targetUrl}
          onLoad={() => setIframeLoaded(true)}
          className="w-full h-[86vh] rounded-2xl border border-white/10 bg-white"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
};

export default ToolIframePage;
