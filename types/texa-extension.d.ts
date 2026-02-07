export { };

interface TEXAExtensionInterface {
  ready: boolean;
  version: string;
  openTool: (
    toolId: string,
    targetUrl: string,
    apiUrl?: string | null,
    cookiesData?: any,
    idToken?: string | null
  ) => Promise<boolean>;
  getStatus: () => { ready: boolean; version: string; connected: boolean };
  syncSession?: (sessionData: { origin: string; token: string; user: any }) => void;
  logout?: () => void;
}

declare global {
  interface Window {
    TEXAExtension?: TEXAExtensionInterface;
  }
}
