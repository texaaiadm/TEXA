export const RECENT_OPENED_TOOLS_KEY = 'recent_opened_tools';

export const getRecentOpenedToolIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_OPENED_TOOLS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const pushRecentOpenedTool = (toolId: string, limit = 20): string[] => {
  if (typeof window === 'undefined') return [];
  if (!toolId) return getRecentOpenedToolIds();
  const current = getRecentOpenedToolIds();
  const next = [toolId, ...current.filter((id) => id !== toolId)];
  const trimmed = next.slice(0, limit);
  try {
    window.localStorage.setItem(RECENT_OPENED_TOOLS_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new Event('recent-tools-updated'));
  } catch {
  }
  return trimmed;
};
