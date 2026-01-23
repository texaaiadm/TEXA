export const getIframeAllowedHostPatterns = (): string[] => {
  const raw = (import.meta.env.VITE_IFRAME_ALLOWED_HOSTS || '').trim();
  const fromEnv = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return Array.from(new Set(['teknomail.teknoaiglobal.com', ...fromEnv].map((h) => h.toLowerCase())));
};

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

