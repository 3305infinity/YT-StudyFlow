import { create } from 'zustand';

export type WorkspaceTab = 'chat' | 'notes' | 'revision' | 'analytics';
export type UtilityPanel = 'transcript' | 'settings' | 'export';
export type SidebarTab = WorkspaceTab | UtilityPanel;

interface UiState {
  activeTab: WorkspaceTab;
  utilityPanel: UtilityPanel | null;
  sidebarCollapsed: boolean;
  apiKeyBannerDismissed: boolean;
  setActiveTab: (tab: SidebarTab) => void;
  closeUtility: () => void;
  toggleSidebarCollapsed: () => void;
  dismissApiKeyBanner: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'chat',
  utilityPanel: null,
  sidebarCollapsed: false,
  apiKeyBannerDismissed: false,

  setActiveTab: (tab) => {
    if (tab === 'chat' || tab === 'notes' || tab === 'revision' || tab === 'analytics') {
      set({ activeTab: tab, utilityPanel: null });
    } else {
      set({ utilityPanel: tab });
    }
  },

  closeUtility: () => set({ utilityPanel: null }),

  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  dismissApiKeyBanner: () => set({ apiKeyBannerDismissed: true }),
}));
