import React from 'react';
import { DiscountCode } from '../../lib/supabase';
import { Badge } from './Badge';
import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { formatFaDate } from '../../lib/format';

interface DiscountRowProps {
  discount: DiscountCode;
  onToggleActive: (discount: DiscountCode) => void;
  onDelete: (id: string) => void;
}

export const DiscountRow: React.FC<DiscountRowProps> = ({
  discount,
  onToggleActive,
  onDelete,
}) => {
  const isExpired = discount.expires_at ? new Date(discount.expires_at) < new Date() : false;

  return (
    <tr id={`discount-row-${discount.id}`} className="hover:bg-slate-800/15 transition-all text-sm group">
      <td className="py-4 pl-4 text-right">
        <span className="font-mono font-bold text-xs text-brand-400 bg-brand-500/10 px-2.5 py-1.5 rounded-xl border border-brand-500/15 group-hover:bg-brand-500/20 group-hover:border-brand-500/30 transition-all select-all">
          {discount.code}
        </span>
      </td>
      <td className="py-4 text-right text-xs font-bold text-slate-100 font-mono">
        %{discount.discount_percent.toLocaleString('fa-IR')}
      </td>
      <td className="py-4 text-right text-xs font-semibold text-slate-400">
        <span className="font-mono text-slate-300">{discount.used_count.toLocaleString('fa-IR')}</span>
        <span className="text-slate-600"> / </span>
        <span className="font-mono text-slate-500">{discount.max_uses.toLocaleString('fa-IR')} بار</span>
      </td>
      <td className="py-4 text-right">
        {isExpired ? (
          <Badge variant="danger">منقضی شده</Badge>
        ) : discount.is_active ? (
          <Badge variant="success">فعال</Badge>
        ) : (
          <Badge variant="neutral">غیرفعال شده</Badge>
        )}
      </td>
      <td className="py-4 text-right text-xs font-medium text-slate-400">
        {discount.expires_at ? (
          <span className="font-mono">
            {formatFaDate(discount.expires_at)}
          </span>
        ) : (
          <span className="text-slate-600 h-full">نامحدود (دائمی)</span>
        )}
      </td>
      <td className="py-4 pr-4">
        <div className="flex items-center justify-end gap-2">
          {/* Toggle Code state */}
          <button
            id={`btn-toggle-dis-${discount.id}`}
            onClick={() => onToggleActive(discount)}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              discount.is_active
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
            }`}
            title={discount.is_active ? 'غیر فعال‌سازی کد' : 'فعال‌سازی مجدد'}
          >
            {discount.is_active ? (
              <ToggleRight className="w-4 h-4 pointer-events-none" />
            ) : (
              <ToggleLeft className="w-4 h-4 pointer-events-none" />
            )}
          </button>

          {/* Delete code permanently */}
          <button
            id={`btn-delete-dis-${discount.id}`}
            onClick={() => onDelete(discount.id!)}
            className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/25 transition-all cursor-pointer"
            title="حذف کد تخفیف"
          >
            <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
          </button>
        </div>
      </td>
    </tr>
  );
};
