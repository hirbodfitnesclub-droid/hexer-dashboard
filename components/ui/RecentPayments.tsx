import React from 'react';
import { Payment } from '../../lib/supabase';
import { Badge } from './Badge';
import { DollarSign, Eye } from 'lucide-react';

interface RecentPaymentsProps {
  payments: Payment[];
  onView?: (p: Payment) => void;
}

export const RecentPayments: React.FC<RecentPaymentsProps> = ({ 
  payments,
  onView 
}) => {
  return (
    <div id="recent-payments-table-container" className="overflow-x-auto w-full">
      <table id="payments-data-table" className="w-full text-right border-collapse">
        <thead>
          <tr id="table-head-row" className="border-b border-slate-800 text-slate-400 text-xs">
            <th className="pb-3 font-semibold">شناسه تراکنش</th>
            <th className="pb-3 font-semibold">کاربر</th>
            <th className="pb-3 font-semibold">مبلغ (تومان)</th>
            <th className="pb-3 font-semibold">کد تخفیف</th>
            <th className="pb-3 font-semibold">وضعیت</th>
            <th className="pb-3 font-semibold text-left">تاریخ پرداخت</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40 text-sm">
          {payments.length === 0 ? (
            <tr id="empty-row-item">
              <td colSpan={6} className="py-6 text-center text-slate-500 text-xs font-medium">
                هیچ تراکنش پرداخت جدیدی ثبت نشده است.
              </td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr id={`row-${payment.id}`} key={payment.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="py-3.5 font-mono text-xs text-slate-400 font-bold">
                  #{payment.id.slice(0, 8)}
                </td>
                <td className="py-3.5">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="text-xs font-bold text-slate-200">
                      {payment.profiles?.display_name || payment.profiles?.email || 'کاربر هکسر'}
                    </span>
                  </div>
                </td>
                <td className="py-3.5 text-xs font-bold text-slate-100 font-mono">
                  {(payment.amount / 10).toLocaleString('fa-IR')}
                </td>
                <td className="py-3.5">
                  {payment.coupon_code ? (
                    <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded font-bold border border-brand-500/20">
                      {payment.coupon_code}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-xs">-</span>
                  )}
                </td>
                <td className="py-3.5">
                  <Badge variant={payment.status === 'success' ? 'success' : payment.status === 'failed' ? 'danger' : 'warning'}>
                    {payment.status === 'success' ? 'موفق' : payment.status === 'failed' ? 'ناموفق' : 'در انتظار'}
                  </Badge>
                </td>
                <td className="py-3.5 text-left text-xs text-slate-500 font-medium">
                  {new Date(payment.created_at).toLocaleDateString('fa-IR')}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
