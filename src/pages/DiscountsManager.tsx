import React, { useEffect, useMemo, useState } from 'react';
import { DiscountCode } from '../lib/supabase';
import { dataStore } from '../lib/dataStore';
import { Card } from '../components/ui/Card';
import { DiscountRow } from '../components/ui/DiscountRow';
import { DiscountCreateModal } from '../components/ui/DiscountCreateModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorPanel } from '../components/ui/ErrorPanel';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Tag, Search, PlusCircle, Download } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { exportToCsv } from '../lib/csv';
import { formatFaDate } from '../lib/format';

export const DiscountsManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deleteTarget, setDeleteTarget] = useState<DiscountCode | null>(null);
  const [isActing, setIsActing] = useState(false);
  
  // Modal active variables
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchDiscountsGrid = async (soft = false) => {
    try {
      if (!soft) setLoading(true);
      setLoadError(null);
      const list = await dataStore.getDiscountCodes();
      setDiscounts(list);
    } catch (e: any) {
      const msg = e.message || 'خطا در بارگذاری اطلاعات کدهای تخفیف';
      setLoadError(msg);
      if (!soft) toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscountsGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const handleToggleCodeActive = async (discount: DiscountCode) => {
    if (isActing) return;
    const nextState = !discount.is_active;
    try {
      setIsActing(true);
      const updated: DiscountCode = {
        ...discount,
        is_active: nextState,
      };
      const success = await dataStore.saveDiscountCode(updated);
      if (success) {
        toast.success(`کد تخفیف ${discount.code} به وضعیت ${nextState ? 'فعال' : 'غیرفعال'} تغییر یافت.`);
        fetchDiscountsGrid(true);
      }
    } finally {
      setIsActing(false);
    }
  };

  const handleDeleteCode = (id: string) => {
    const target = discounts.find((d) => d.id === id) || null;
    setDeleteTarget(target);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id || isActing) return;
    try {
      setIsActing(true);
      const success = await dataStore.deleteDiscountCode(deleteTarget.id);
      if (success) {
        setDeleteTarget(null);
        fetchDiscountsGrid(true);
      }
    } finally {
      setIsActing(false);
    }
  };

  const handleConfirmCreate = async (newDiscount: DiscountCode) => {
    const success = await dataStore.saveDiscountCode(newDiscount);
    if (success) {
      setIsCreateModalOpen(false);
      fetchDiscountsGrid(true);
    }
  };

  const filteredDiscounts = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return discounts;
    return discounts.filter(d =>
      d.code.toLowerCase().includes(q) ||
      d.discount_percent.toString().includes(q)
    );
  }, [discounts, debouncedQuery]);

  const totalPages = Math.max(Math.ceil(filteredDiscounts.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pagedDiscounts = filteredDiscounts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleExportCsv = () => {
    exportToCsv(
      `discounts-${new Date().toISOString().slice(0, 10)}`,
      ['کد', 'درصد', 'سقف استفاده', 'استفاده شده', 'وضعیت', 'انقضا'],
      filteredDiscounts.map((d) => [
        d.code,
        d.discount_percent,
        d.max_uses,
        d.used_count,
        d.is_active ? 'فعال' : 'غیرفعال',
        d.expires_at ? formatFaDate(d.expires_at) : '',
      ]),
    );
    toast.success('فایل CSV تخفیف‌ها دانلود شد.');
  };

  return (
    <motion.div
      id="discounts-manager-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Title Header Section */}
      <div id="discounts-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 id="discounts-title" className="text-xl md:text-2xl font-extrabold text-slate-100 flex items-center space-x-2 space-x-reverse">
            <Tag className="w-6 h-6 text-brand-400 pointer-events-none" />
            <span>مدیریت کدهای تخفیف و تبلیغات</span>
          </h2>
          <p id="discounts-desc" className="text-xs text-slate-400 font-semibold mt-1">
            طراحی، ساخت، فعال/غیرفعال‌سازی کدهای تخفیف معتبر بر روی درگاه پرداخت پلتفرم هکسر
          </p>
        </div>

        {/* Generate modal trigger button */}
        <div id="create-action-box">
          <Button
            id="open-create-discount-modal-btn"
            onClick={() => setIsCreateModalOpen(true)}
            variant="primary"
            size="md"
            icon={<PlusCircle className="w-4 h-4" />}
          >
            کد تخفیف جدید
          </Button>
        </div>
      </div>

      {/* Control Input query search */}
      <div id="discounts-controls" className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div id="disc-search" className="md:col-span-2">
          <Input
            id="discount-search-query-inp"
            type="text"
            placeholder="جستجو بر اساس نام حروف کد تخفیف با درصد تخفیف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-500" />}
          />
        </div>
        
        {/* Count total statistics badges */}
        <div id="disc-stats-row" className="flex justify-end items-center gap-2 text-xs font-semibold">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <span className="text-slate-400">نمایش:</span>
            <span className="font-mono text-brand-400 font-bold">{filteredDiscounts.length}</span>
            <span className="text-slate-500">از</span>
            <span className="font-mono text-slate-300 font-bold">{discounts.length}</span>
          </div>
          <Button id="discounts-export-btn" variant="secondary" size="sm" onClick={handleExportCsv} icon={<Download className="w-3.5 h-3.5" />}>
            CSV
          </Button>
        </div>
      </div>

      {/* Main Grid Table Card */}
      <Card id="discounts-list-card" hoverable={false}>
        {loading ? (
          <LoadingSpinner size="md" message="بارگذاری جزییات آماری کدهای تخفیف..." />
        ) : loadError ? (
          <ErrorPanel id="discounts-error-panel" message={loadError} onRetry={() => fetchDiscountsGrid()} />
        ) : (
          <div id="discounts-table-scroll" className="overflow-x-auto w-full">
            <table id="discounts-data-table" className="w-full text-right border-collapse">
              <thead>
                <tr id="disc-thead-row" className="border-b border-slate-800 text-slate-400 text-xs">
                  <th className="pb-3 text-right font-semibold pl-4">کد اختصاصی</th>
                  <th className="pb-3 text-right font-semibold">میزان تخفیف</th>
                  <th className="pb-3 text-right font-semibold">تعداد استفاده شده</th>
                  <th className="pb-3 text-right font-semibold">وضعیت کد</th>
                  <th className="pb-3 text-right font-semibold">تاریخ اعتبار انقضاء</th>
                  <th className="pb-3 text-left font-semibold pr-4">عملیات ادمین</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {pagedDiscounts.length === 0 ? (
                  <tr id="discounts-empty-row">
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs font-medium">
                      هیچ کد تخفیف تبلیغاتی منطبقی یافت نگردید.
                    </td>
                  </tr>
                ) : (
                  pagedDiscounts.map(disc => (
                    <DiscountRow
                      key={disc.id}
                      discount={disc}
                      onToggleActive={handleToggleCodeActive}
                      onDelete={handleDeleteCode}
                    />
                  ))
                )}
              </tbody>
            </table>
            <Pagination
              id="discounts-pagination"
              page={safePage}
              totalPages={totalPages}
              totalItems={filteredDiscounts.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </Card>

      {/* Delete confirmation (replaces native confirm) */}
      <ConfirmModal
        id="discount-delete-confirm"
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="حذف کد تخفیف"
        message={`کد «${deleteTarget?.code}» برای همیشه حذف شود؟ این عمل قابل بازگشت نیست.`}
        confirmLabel="حذف دائم"
        variant="danger"
        isLoading={isActing}
      />

      {/* Custom code generator popup template */}
      <DiscountCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleConfirmCreate}
      />

    </motion.div>
  );
};
