// ── Dynamic iframe hosts loaded from DB ──
let dynamicHosts: string[] = [];
let dynamicHostsLoaded = false;

/**
 * Set iframe hosts fetched from Supabase settings.
 * Called once on app init and when admin updates domains.
 */
export const setDynamicIframeHosts = (hosts: string[]): void => {
  dynamicHosts = hosts.map(h => h.toLowerCase().trim()).filter(Boolean);
  dynamicHostsLoaded = true;
};

/**
 * Fetch iframe allowed hosts from DB (public API, no auth).
 * Safe to call from anywhere — returns [] on failure.
 */
export const fetchIframeHostsFromDB = async (): Promise<string[]> => {
  try {
    const isLocalDev = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const baseUrl = isLocalDev ? 'http://127.0.0.1:8787' : '';
    const response = await fetch(`${baseUrl}/api/admin/settings?key=iframe_allowed_hosts`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const result = await response.json();
      const hosts: string[] = result.data?.value?.hosts || [];
      if (hosts.length > 0) {
        setDynamicIframeHosts(hosts);
        console.log(`✅ Loaded ${hosts.length} iframe hosts from DB`);
      }
      return hosts;
    }
  } catch (e) {
    console.warn('[iframePolicy] Failed to fetch iframe hosts from DB:', e);
  }
  return [];
};

export const getIframeAllowedHostPatterns = (): string[] => {
  const raw = (import.meta.env.VITE_IFRAME_ALLOWED_HOSTS || '').trim();
  const fromEnv = raw
    ? raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    : [];

  return Array.from(new Set([
    'teknomail.teknoaiglobal.com',
    ...fromEnv,
    ...dynamicHosts
  ].map((h) => h.toLowerCase())));
};

export const isDynamicHostsLoaded = (): boolean => dynamicHostsLoaded;

const getHostFromUrl = (value: string): string | null => {
  try {
    if (!value) return null;
    if (value.startsWith('/')) return window.location.host.toLowerCase();
    const parsed = new URL(value);
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
};

const matchHostPattern = (host: string, pattern: string): boolean => {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  if (!p) return false;
  if (p.startsWith('*.')) {
    const suffix = p.slice(2);
    return h.endsWith(`.${suffix}`) && h !== suffix;
  }
  return h === p;
};

export const isUrlIframeAllowed = (value: string): boolean => {
  const host = getHostFromUrl(value);
  if (!host) return false;
  if (host === window.location.host.toLowerCase()) return true;

  const patterns = getIframeAllowedHostPatterns();
  return patterns.some((p) => matchHostPattern(host, p));
};

const getImageBlockedHostPatterns = (): string[] => {
  const raw = (import.meta.env.VITE_IMAGE_BLOCKED_HOSTS || '').trim();
  const fromEnv = raw
    ? raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    : [];

  return Array.from(
    new Set(
      [
        'lh3.googleusercontent.com',
        'img.freepik.com',
        'freepik.com',
        'www.freepik.com',
        'deepseek.com',
        'www.deepseek.com',
        ...fromEnv
      ].map((h) => h.toLowerCase())
    )
  );
};

export const isUrlImageAllowed = (value: string): boolean => {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return true;
  if (trimmed.startsWith('/')) return true;

  const host = getHostFromUrl(trimmed);
  if (!host) return false;
  if (host === window.location.host.toLowerCase()) return true;

  const blocked = getImageBlockedHostPatterns();
  return !blocked.some((p) => matchHostPattern(host, p));
};
