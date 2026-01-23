
// Re-export TexaUser from firebase service for backward compatibility
export type { TexaUser as User } from './services/firebase';
export type { UserRole } from './services/firebase';

export interface AITool {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  targetUrl: string;
  openMode?: 'new_tab' | 'iframe';
  status: 'active' | 'inactive';
  priceMonthly: number;
  // New fields for extension integration
  embedVideoUrl?: string;      // URL untuk embedded video (YouTube, dll)
  cookiesData?: string;        // JSON string cookies untuk inject oleh extension
  apiUrl?: string;             // API URL untuk fetch data oleh extension
}

export interface AuthState {
  user: import('./services/firebase').TexaUser | null;
  isAuthenticated: boolean;
}

export interface ToolCookie {
  id: string;
  toolId: string;
  data: string; // Encrypted simulation
  lastUpdated: string;
}
