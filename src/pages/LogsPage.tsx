import React, { useEffect, useMemo, useState } from 'react';
import { dataStore } from '../lib/dataStore';
import { AuditLogRow } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorPanel } from '../components/ui/ErrorPanel';
import { Pagination } from '../components/ui/Pagination';
import { ScrollText, RefreshCw, Search } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { formatFaDateTime } from '../lib/format';
import { useDebouncedValue } from '../lib/useDebouncedValue';

const ACTION_FA: Record<string, string> = {
  update_profile: 'ویرایش کاربر',
  upsert_subscription: 'ویرایش اشتراک',
  create_subscription: 'ساخت اشتراک',
  cancel_subscription: 'لغو اشتراک',
  save_discount: 'ثبت تخفیف',
  delete_discount: 'حذف تخفیف',
  approve_manual_payment: 'تایید پرداخت دستی',
  reject_manual_payment: 'رد پرداخت دستی',
  save_telegram_settings: 'تنظیمات تلگرام',
  save_app_settings: 'تنظیمات عمومی',
  marketing_save_campaign: 'ثبت کمپین',
  update_ticket: 'پاسخ تیکت',
};

/**
 * لاگ ساده فعالیت ادمین: چه کاری، روی چه هدفی، کی، با چه نتیجه‌ای.
 */
export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const rows = await dataStore.getAuditLogs(200, 0);
      setLogs(rows);
    } catch (e: any) {
      const msg = e.message || 'خطا در دریافت لاگ‌ها';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, actionFilter]);

  const actions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (!q) return true;
      return (
        (l.target_id || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.admin_label || '').toLowerCase().includes(q)
      );
    });
  }, [logs, debouncedQuery, actionFilter]);

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <motion.div
      id="logs-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-100 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-brand-400" />
            <span>لاگ فعالیت ادمین</span>
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            ثبت خودکار همه عملیات مهم: بلاک کاربر، تایید/رد مالی، تغییر اشتراک و تیکت
          </p>
        </div>
        <Button id="logs-refresh-btn" variant="secondary" size="sm" onClick={fetchLogs} isLoading={loading} icon={<RefreshCw className="w-4 h-4" />}>
          به‌روزرسانی
        </Button>
      </div>

      <div className="bg-slate-900/60 rounded-2xl p-4 border border-white/5 flex flex-col md:flex-row md:items-center gap-3">
        <select
          id="logs-action-filter"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 px-3 py-2 focus:outline-none focus:border-brand-500 cursor-pointer md:w-56"
        >
          <option value="all">همه عملیات‌ها ({logs.length.toLocaleString('fa-IR')})</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_FA[a] || a}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            id="logs-search-box"
            type="text"
            placeholder="جستجو شناسه هدف یا نام عملیات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/50 border border-white/5 focus:border-brand-500/50 rounded-xl pr-10 pl-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
          />
        </div>
      </div>

      <Card id="logs-list-card" hoverable={false}>
        {loading ? (
          <LoadingSpinner size="md" message="در حال بارگذاری لاگ‌ها..." />
        ) : loadError ? (
          <ErrorPanel id="logs-error-panel" message={loadError} onRetry={fetchLogs} />
        ) : paged.length === 0 ? (
          <p className="py-12 text-center text-slate-500 text-xs font-medium">
            {logs.length === 0 ? 'هنوز هیچ عملیاتی ثبت نشده است. از این به بعد همه عملیات مهم اینجا لاگ می‌شوند.' : 'موردی با این فیلتر یافت نشد.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs">
                  <th className="pb-3 font-semibold">عملیات</th>
                  <th className="pb-3 font-semibold">نتیجه</th>
                  <th className="pb-3 font-semibold">هدف</th>
                  <th className="pb-3 font-semibold">ادمین</th>
                  <th className="pb-3 font-semibold text-left">زمان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {paged.map((l) => (
                  <tr key={l.id} className="text-xs hover:bg-slate-800/15 transition-colors">
                    <td className="py-3 font-bold text-slate-200">{ACTION_FA[l.action] || l.action}</td>
                    <td className="py-3">
                      <Badge variant={l.status === 'succeeded' ? 'success' : l.status === 'failed' ? 'danger' : 'warning'}>
                        {l.status === 'succeeded' ? 'موفق' : l.status === 'failed' ? 'ناموفق' : l.status}
                      </Badge>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-slate-400" title={l.target_id || ''}>
                      {l.target_id ? `${l.target_id.slice(0, 8)}…` : '—'}
                    </td>
                    <td className="py-3 text-slate-400">{l.admin_label || '—'}</td>
                    <td className="py-3 text-left text-slate-500">{formatFaDateTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              id="logs-pagination"
              page={safePage}
              totalPages={totalPages}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </Card>
    </motion.div>
  );
};
