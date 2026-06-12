/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAdminStore } from './store/adminStore';
import { Login } from './pages/Login';
import { AdminLayout } from './components/layout/AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { UsersManager } from './pages/UsersManager';
import { SubscriptionsManager } from './pages/SubscriptionsManager';
import { DiscountsManager } from './pages/DiscountsManager';
import { ManualPaymentsManager } from './pages/ManualPaymentsManager';
import { TicketsManager } from './pages/TicketsManager';
import { MarketingDashboard } from './pages/MarketingDashboard';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const { isAuthenticated, activeTab } = useAdminStore();

  return (
    <div className="min-h-screen text-slate-100 bg-slate-950 font-sans">
      {/* Visual Global Feedback System */}
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: 'Vazirmatn, system-ui, sans-serif',
            fontSize: '13px',
            direction: 'rtl',
            borderRadius: '12px'
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#f43f5e',
              secondary: '#ffffff',
            },
          },
        }}
      />

      {/* Main Authentication guard routers */}
      {!isAuthenticated ? (
        <Login />
      ) : (
        <AdminLayout>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'users' && <UsersManager />}
          {activeTab === 'subscriptions' && <SubscriptionsManager />}
          {activeTab === 'manual_payments' && <ManualPaymentsManager />}
          {activeTab === 'discounts' && <DiscountsManager />}
          {activeTab === 'tickets' && <TicketsManager />}
          {activeTab === 'marketing' && <MarketingDashboard />}
        </AdminLayout>
      )}
    </div>
  );
}

