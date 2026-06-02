import { create } from 'zustand';

export type ActiveTab = 'dashboard' | 'users' | 'subscriptions' | 'discounts';

interface AdminState {
  isAuthenticated: boolean;
  username: string | null;
  activeTab: ActiveTab;
  isLoading: boolean;
  loginError: string | null;
  login: (usernameInput: string, passwordInput: string) => boolean;
  logout: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  setLoading: (loading: boolean) => void;
}

export const useAdminStore = create<AdminState>((set) => {
  // Check local storage for existing session
  const storedAuth = localStorage.getItem('hexer_admin_auth') === 'true';
  const storedUser = localStorage.getItem('hexer_admin_user');

  return {
    isAuthenticated: storedAuth,
    username: storedUser,
    activeTab: 'dashboard',
    isLoading: false,
    loginError: null,

    login: (usernameInput, passwordInput) => {
      set({ isLoading: true, loginError: null });
      
      // Fixed senior administrator credentials check
      if (usernameInput === 'arash' && passwordInput === '3128') {
        localStorage.setItem('hexer_admin_auth', 'true');
        localStorage.setItem('hexer_admin_user', 'arash');
        set({
          isAuthenticated: true,
          username: 'arash',
          activeTab: 'dashboard',
          isLoading: false,
          loginError: null,
        });
        return true;
      } else {
        set({
          isLoading: false,
          loginError: 'نام کاربری یا رمز عبور اشتباه است.',
        });
        return false;
      }
    },

    logout: () => {
      localStorage.removeItem('hexer_admin_auth');
      localStorage.removeItem('hexer_admin_user');
      set({
        isAuthenticated: false,
        username: null,
        activeTab: 'dashboard',
        loginError: null,
      });
    },

    setActiveTab: (tab) => set({ activeTab: tab }),
    setLoading: (loading) => set({ isLoading: loading }),
  };
});
