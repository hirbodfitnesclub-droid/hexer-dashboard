import React, { useEffect, useState } from 'react';
import { DiscountCode } from '../lib/supabase';
import { dataStore } from '../lib/dataStore';
import { Card } from '../components/ui/Card';
import { DiscountRow } from '../components/ui/DiscountRow';
import { DiscountCreateModal } from '../components/ui/DiscountCreateModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Tag, Search, PlusCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export const DiscountsManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal active variables
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchDiscountsGrid = async () => {
    try {
      setLoading(true);
      const list = await dataStore.getDiscountCodes();
      setDiscounts(list);
    } catch (e) {
      toast.error('خطا در بارگذاری اطلاعات کدهای تخفیف');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscountsGrid();
  }, []);

  const handleToggleCodeActive = async (discount: DiscountCode) => {
    const nextState = !discount.is_active;
    const updated: DiscountCode = {
      ...discount,
      is_active: nextState,
    };
    const success = await dataStore.saveDiscountCode(updated);
    if (success) {
      toast.success(`کد تخفیف ${discount.code} به وضعیت ${nextState ? 'فعال' : 'غیرفعال'} تغییر یافت.`);
      fetchDiscountsGrid();
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (confirm('آیا از حذف دائم این کد تخفیف اطمینان دارید؟')) {
      const success = await dataStore.deleteDiscountCode(id);
      if (success) {
        fetchDiscountsGrid();
      }
    }
  };

  const handleConfirmCreate = async (newDiscount: DiscountCode) => {
    const success = await dataStore.saveDiscountCode(newDiscount);
    if (success) {
      setIsCreateModalOpen(false);
      fetchDiscountsGrid();
    }
  };

  const filteredDiscounts = discounts.filter(d => 
    d.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.discount_percent.toString().includes(searchQuery)
  );

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
        <div id="disc-stats-row" className="flex justify-end gap-2 text-xs font-semibold">
          <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <span className="text-slate-400">کدهای بارگذاری شده:</span>
            <span className="font-mono text-brand-400 font-bold">{filteredDiscounts.length}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Table Card */}
      <Card id="discounts-list-card" hoverable={false}>
        {loading ? (
          <LoadingSpinner size="md" message="بارگذاری جزییات آماری کدهای تخفیف..." />
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
                {filteredDiscounts.length === 0 ? (
                  <tr id="discounts-empty-row">
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs font-medium">
                      هیچ کد تخفیف تبلیغاتی منطبقی یافت نگردید.
                    </td>
                  </tr>
                ) : (
                  filteredDiscounts.map(disc => (
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
          </div>
        )}
      </Card>

      {/* Custom code generator popup template */}
      <DiscountCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleConfirmCreate}
      />

    </motion.div>
  );
};
