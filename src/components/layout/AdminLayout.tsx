import React, { useState } from 'react';
import { useAdminStore, ActiveTab } from '../../store/adminStore';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Tag, 
  LogOut, 
  Menu, 
  X, 
  ShieldAlert,
  User,
  Bell,
  MessageSquare,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { activeTab, setActiveTab, logout, username } = useAdminStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard' as ActiveTab, label: 'داشبورد تحلیلی', icon: LayoutDashboard },
    { id: 'users' as ActiveTab, label: 'مدیریت کاربران', icon: Users },
    { id: 'subscriptions' as ActiveTab, label: 'مدیریت اشتراک‌ها', icon: CreditCard },
    { id: 'manual_payments' as ActiveTab, label: 'تاییدات کارت به کارت', icon: CreditCard },
    { id: 'discounts' as ActiveTab, label: 'کدهای تخفیف', icon: Tag },
    { id: 'tickets' as ActiveTab, label: 'تیکت‌های پشتیبانی', icon: MessageSquare },
    { id: 'marketing' as ActiveTab, label: 'تحلیل مارکتینگ', icon: TrendingUp },
  ];

  const handleTabClick = (tabId: ActiveTab) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <div id="admin-layout-root" className="min-h-screen flex bg-slate-950 text-slate-100 font-sans selection:bg-brand-500/30 selection:text-white">
      
      {/* 1. Desktop Sidebar */}
      <aside 
        id="desktop-sidebar" 
        className="hidden lg:flex flex-col w-72 bg-slate-900 border-l border-white/5 p-6 flex-shrink-0 relative z-20"
      >
        {/* Clean Minimalism Brand Header */}
        <div id="sidebar-brand" className="flex items-center space-x-3 space-x-reverse pb-6 border-b border-white/5 mb-8">
          <div id="logo-badge" className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <span className="font-bold text-white text-xl">H</span>
          </div>
          <div>
            <h1 id="brand-title" className="text-base font-bold tracking-tight text-white">
              هکسر <span className="text-brand-400 font-medium">پنل</span>
            </h1>
            <p id="brand-subtitle" className="text-[10px] text-slate-500 font-semibold tracking-widest mt-0.5 uppercase">SYSTEM ARCH</p>
          </div>
        </div>

        {/* Navigation Menu Links */}
        <nav id="sidebar-nav" className="flex-1 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                id={`sidebar-tab-${item.id}`}
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center space-x-3.5 space-x-reverse px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 relative group cursor-pointer ${
                  isActive 
                    ? 'text-white bg-brand-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {isActive && (
                  <motion.div
                    id={`active-tab-glow-${item.id}`}
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-brand-500/10 border-r-4 border-brand-500 rounded-xl pointer-events-none"
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  />
                )}
                <Icon id={`sidebar-icon-${item.id}`} className={`w-5 h-5 transition-transform duration-300 pointer-events-none ${isActive ? 'text-brand-400 scale-105' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span id={`sidebar-label-${item.id}`} className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Admin Area info */}
        <div id="sidebar-footer" className="pt-6 border-t border-white/5 flex flex-col space-y-4">
          <div id="admin-info-card" className="flex items-center space-x-3 space-x-reverse p-3 bg-white/5 rounded-2xl border border-white/5">
            <div id="admin-avatar" className="w-10 h-10 rounded-full bg-gradient-to-b from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center text-brand-400">
              <User className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h4 id="admin-username" className="text-sm font-bold text-white truncate">{username || 'آرش'}</h4>
              <p id="admin-role" className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">Super Admin</p>
            </div>
          </div>
          
          <button
            id="sidebar-logout-btn"
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 space-x-reverse px-4 py-3 text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج از پنل</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Page Scope */}
      <div id="main-content-wrapper" className="flex-1 flex flex-col min-w-0 relative">
        {/* Decorative Gradient Blobs from Clean Minimalism style */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-500/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-600/5 blur-[150px] rounded-full -z-10 pointer-events-none" />
        
        {/* Responsive Header Banner */}
        <header id="layout-header" className="bg-slate-900/40 backdrop-blur-md border-b border-white/5 px-6 py-5 flex items-center justify-between sticky top-0 z-30">
          
          {/* Brand/Mobile menu button */}
          <div id="header-left" className="flex items-center space-x-3 space-x-reverse">
            <button
              id="mobile-hamburger-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div id="header-breadcrumbs" className="flex items-center space-x-2 space-x-reverse">
              <span id="breadcrumb-parent" className="text-xs text-slate-500 font-semibold font-[inherit]">پنل ادمین هکسر</span>
              <span id="breadcrumb-divider" className="text-slate-700 text-xs">/</span>
              <span id="breadcrumb-current" className="text-sm text-slate-200 font-bold">
                {menuItems.find(item => item.id === activeTab)?.label || 'داشبورد'}
              </span>
            </div>
          </div>

          {/* Action Tools & Admin Badge */}
          <div id="header-right" className="flex items-center space-x-3 space-x-reverse">
            <div id="notifications-bell" className="relative">
              <button id="bell-btn" className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer">
                <Bell className="w-4 h-4" />
              </button>
              <span id="bell-badge" className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            </div>

            <div id="layout-header-badge" className="hidden sm:flex items-center space-x-2 space-x-reverse px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              <span>پایگاه داده آنلاین</span>
            </div>
          </div>
        </header>

        {/* Dynamic page content layout wrapper */}
        <main id="dashboard-main-area" className="flex-1 p-6 md:p-8 overflow-y-auto">
          <div id="page-content-grid" className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* 3. Mobile Navigation Slider Overlay Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div id="mobile-menu-drawer-portal" className="fixed inset-0 z-50 lg:hidden">
            
            {/* Backdrop slide click target */}
            <motion.div
              id="mobile-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950 backdrop-blur-sm"
            />

            {/* Sidebar shelf drawer drawer */}
            <motion.aside
              id="mobile-drawer-aside"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 w-80 bg-slate-900 p-6 flex flex-col justify-between shadow-2xl border-l border-slate-800 z-50 h-screen"
            >
              <div id="mobile-drawer-top">
                <div id="mobile-drawer-header" className="flex items-center justify-between pb-6 border-b border-slate-800/60 mb-6">
                  <div id="mobile-drawer-brand" className="flex items-center space-x-3 space-x-reverse">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-brand-500/15">
                      <ShieldAlert className="w-4 h-4 pointer-events-none" />
                    </div>
                    <span className="text-sm font-extrabold text-white">مدیریت هکسر</span>
                  </div>
                  <button
                    id="mobile-drawer-close"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 px-[5px] rounded-lg text-slate-400 hover:bg-slate-800"
                    type="button"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Tab Select list links */}
                <nav id="mobile-nav-menu" className="space-y-1.5">
                  {menuItems.map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        id={`mobile-tab-${item.id}`}
                        key={item.id}
                        onClick={() => handleTabClick(item.id)}
                        className={`w-full flex items-center space-x-3.5 space-x-reverse px-4 py-3 rounded-xl text-sm font-semibold transition-all relative ${
                          isActive 
                            ? 'text-white bg-brand-500/10' 
                            : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                        }`}
                      >
                        {isActive && (
                          <div id={`mobile-active-glow-${item.id}`} className="absolute inset-0 border-r-4 border-brand-500 bg-brand-500/10 rounded-xl" />
                        )}
                        <Icon id={`mobile-icon-${item.id}`} className={`w-5 h-5 ${isActive ? 'text-brand-400' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Mobile Drawer Logout and Info area */}
              <div id="mobile-drawer-bottom" className="pt-6 border-t border-slate-800/60 flex flex-col space-y-4">
                <div id="mobile-admin-card" className="flex items-center space-x-3 space-x-reverse p-3 bg-slate-950/40 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-brand-400 font-bold border border-slate-700">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-white">{username || 'آرش'}</h4>
                    <p className="text-[10px] text-slate-500">مدیر ارشد پلتفرم</p>
                  </div>
                </div>
                <button
                  id="mobile-drawer-logout-btn"
                  onClick={logout}
                  className="w-full flex items-center justify-center space-x-2 space-x-reverse px-4 py-2.5 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>خروج از حساب</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
