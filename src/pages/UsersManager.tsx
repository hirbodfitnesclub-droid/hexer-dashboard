import React, { useEffect, useMemo, useState } from 'react';
import { Profile } from '../lib/supabase';
import { dataStore } from '../lib/dataStore';
import { Card } from '../components/ui/Card';
import { UserRow } from '../components/ui/UserRow';
import { UserBlockModal } from '../components/ui/UserBlockModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorPanel } from '../components/ui/ErrorPanel';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Users, Search, Download } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { exportToCsv } from '../lib/csv';
import { formatFaDate } from '../lib/format';

export const UsersManager: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [blockTarget, setBlockTarget] = useState<Profile | null>(null);
  const [isActing, setIsActing] = useState(false);
  
  // Modal controllers
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filter option
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'blocked'>('all');

  const fetchUsersList = async (soft = false) => {
    try {
      if (!soft) setLoading(true);
      setLoadError(null);
      const list = await dataStore.getProfiles();
      setProfiles(list);
    } catch (e: any) {
      const msg = e.message || 'خطا در دریافت لیست کاربران پلتفرم';
      setLoadError(msg);
      if (!soft) toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, activeFilter]);

  const handleEditClick = (profile: Profile) => {
    setSelectedProfile(profile);
    setIsEditModalOpen(true);
  };

  const handleConfirmEdit = async (updated: Profile) => {
    const success = await dataStore.updateProfile(updated);
    if (success) {
      setIsEditModalOpen(false);
      setSelectedProfile(null);
      // Re-fetch to reflect change
      fetchUsersList(true);
    } else {
      toast.error('ثبت اطلاعات با خطا مواجه شد.');
    }
  };

  const handleToggleBlock = (profile: Profile) => {
    // Require explicit confirmation: one click must never block a user.
    setBlockTarget(profile);
  };

  const handleConfirmBlock = async () => {
    if (!blockTarget || isActing) return;
    const nextState = !blockTarget.is_blocked;
    try {
      setIsActing(true);
      const updated: Profile = { ...blockTarget, is_blocked: nextState };
      const success = await dataStore.updateProfile(updated);
      if (success) {
        toast.success(`دسترسی کاربر ${nextState ? 'مسدود' : 'آزاد'} شد.`);
        setBlockTarget(null);
        fetchUsersList(true);
      }
    } catch {
      // toast handled in dataStore
    } finally {
      setIsActing(false);
    }
  };

  // Search filter computes (debounced)
  const filteredProfiles = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    return profiles.filter(profile => {
      const matchesSearch = !q ? true : (
        (profile.display_name || '').toLowerCase().includes(q) ||
        (profile.email || '').toLowerCase().includes(q) ||
        (profile.phone || '').toLowerCase().includes(q) ||
        (profile.id || '').toLowerCase().includes(q)
      );

      if (activeFilter === 'all') return matchesSearch;
      if (activeFilter === 'blocked') return matchesSearch && profile.is_blocked;
      if (activeFilter === 'active') return matchesSearch && !profile.is_blocked;

      return matchesSearch;
    });
  }, [profiles, debouncedQuery, activeFilter]);

  const totalPages = Math.max(Math.ceil(filteredProfiles.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pagedProfiles = filteredProfiles.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleExportCsv = () => {
    exportToCsv(
      `users-${new Date().toISOString().slice(0, 10)}`,
      ['نام', 'ایمیل', 'موبایل', 'وضعیت', 'تاریخ عضویت'],
      filteredProfiles.map((p) => [
        p.display_name || '',
        p.email || '',
        p.phone || '',
        p.is_blocked ? 'مسدود' : 'فعال',
        formatFaDate(p.created_at),
      ]),
    );
    toast.success('فایل CSV کاربران دانلود شد.');
  };

  return (
    <motion.div
      id="users-manager-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Title Header Section */}
      <div id="users-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 id="users-title-lbl" className="text-xl md:text-2xl font-extrabold text-slate-100 flex items-center space-x-2 space-x-reverse">
            <Users className="w-6 h-6 text-brand-400 pointer-events-none" />
            <span>مدیریت یکپارچه کاربران هکسر</span>
          </h2>
          <p id="users-subtext" className="text-xs text-slate-400 font-semibold mt-1">
            مشاهده، جستجو، تایید مدارک و یا بستن موقتی دسترسی کاربران اخلال‌گر به سرویس
          </p>
        </div>

        {/* Counter quick tag + export */}
        <div id="users-active-stat" className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 p-1.5 rounded-xl text-xs font-semibold">
            <span className="text-slate-400">نمایش:</span>
            <span className="font-mono text-brand-400 text-sm font-bold">{filteredProfiles.length}</span>
            <span className="text-slate-500">از</span>
            <span className="font-mono text-slate-300 text-sm font-bold">{profiles.length}</span>
          </div>
          <Button id="users-export-btn" variant="secondary" size="sm" onClick={handleExportCsv} icon={<Download className="w-3.5 h-3.5" />}>
            CSV
          </Button>
        </div>
      </div>

      {/* Interactive Controls Bar */}
      <div id="controls-bar" className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        
        {/* Real-time query search input */}
        <div id="search-container" className="md:col-span-2">
          <Input
            id="user-search-query"
            type="text"
            placeholder="جستجو بر اساس نام، ایمیل/شماره همراه، شناسه..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-500" />}
          />
        </div>

        {/* Filters Select row tabs */}
        <div id="filters-container" className="md:col-span-2 flex items-center justify-end gap-2 shrink-0">
          <span className="text-xs text-slate-500 font-bold hidden sm:inline"> فیلتر وضعیت:</span>
          
          <button
            id="filter-all-btn"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-brand-500 text-white shadow-md'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            همه کاربران
          </button>

          <button
            id="filter-active-btn"
            onClick={() => setActiveFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'active'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            فقط فعالان
          </button>

          <button
            id="filter-blocked-btn"
            onClick={() => setActiveFilter('blocked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilter === 'blocked'
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            مسدود شدگان
          </button>
        </div>
      </div>

      {/* Main Table Grid Card */}
      <Card id="users-list-card" hoverable={false}>
        {loading ? (
          <LoadingSpinner size="md" message="بارگذاری دقیق لیست پروفایل‌های سیستمی..." />
        ) : loadError ? (
          <ErrorPanel id="users-error-panel" message={loadError} onRetry={() => fetchUsersList()} />
        ) : (
          <div id="table-scroll-wrap" className="overflow-x-auto w-full">
            <table id="users-data-table" className="w-full text-right border-collapse">
              <thead>
                <tr id="users-thead-row" className="border-b border-slate-800 text-slate-400 text-xs select-none">
                  <th className="pb-3 text-right font-semibold pl-4">کاربر پلتفرم</th>
                  <th className="pb-3 text-right font-semibold">شناسه سیستمی</th>
                  <th className="pb-3 text-right font-semibold">وضعیت دسترسی</th>
                  <th className="pb-3 text-right font-semibold">تاریخ عضویت</th>
                  <th className="pb-3 text-left font-semibold pr-4">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {pagedProfiles.length === 0 ? (
                  <tr id="users-empty-row">
                    <td colSpan={5} className="py-12 text-center text-slate-500 text-xs font-medium">
                      هیچ کاربری با شرایط جستجو شده یافت نشد.
                    </td>
                  </tr>
                ) : (
                  pagedProfiles.map(profile => (
                    <UserRow
                      key={profile.id}
                      profile={profile}
                      onEdit={handleEditClick}
                      onToggleBlock={handleToggleBlock}
                    />
                  ))
                )}
              </tbody>
            </table>
            <Pagination
              id="users-pagination"
              page={safePage}
              totalPages={totalPages}
              totalItems={filteredProfiles.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </Card>

      {/* Block/unblock confirmation */}
      <ConfirmModal
        id="user-block-confirm"
        isOpen={blockTarget !== null}
        onClose={() => setBlockTarget(null)}
        onConfirm={handleConfirmBlock}
        title={blockTarget?.is_blocked ? 'رفع مسدودیت کاربر' : 'مسدود کردن کاربر'}
        message={
          blockTarget?.is_blocked
            ? `دسترسی «${blockTarget?.display_name || 'کاربر'}» دوباره آزاد شود؟`
            : `«${blockTarget?.display_name || 'کاربر'}» مسدود شود؟ کاربر بلافاصله از سرویس محروم می‌شود.`
        }
        confirmLabel={blockTarget?.is_blocked ? 'آزاد کردن' : 'مسدود کردن'}
        variant={blockTarget?.is_blocked ? 'primary' : 'danger'}
        isLoading={isActing}
      />

      {/* Custom Block / info modifier modal */}
      <UserBlockModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedProfile(null);
        }}
        profile={selectedProfile}
        onConfirm={handleConfirmEdit}
      />
    </motion.div>
  );
};
