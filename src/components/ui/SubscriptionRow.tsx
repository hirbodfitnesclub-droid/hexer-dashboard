import React from 'react';
import { Subscription } from '../../lib/supabase';
import { Badge } from './Badge';
import { UserAvatar } from './UserAvatar';
import { Edit } from 'lucide-react';
import { PLAN_CONFIGS } from '../../lib/constants';

interface SubscriptionRowProps {
  subscription: Subscription;
  onEdit: (subscription: Subscription) => void;
}

export const SubscriptionRow: React.FC<SubscriptionRowProps> = ({
  subscription,
  onEdit,
}) => {
  const getStatusBadge = (status: 'active' | 'expired' | 'canceled') => {
    switch (status) {
      case 'active':
        return <Badge variant="success">فعال</Badge>;
      case 'expired':
        return <Badge variant="danger">منقضی شده</Badge>;
      case 'canceled':
        return <Badge variant="warning">لغو شده</Badge>;
      default:
        return <Badge variant="neutral">نامشخص</Badge>;
    }
  };

  return (
    <tr id={`sub-row-${subscription.id}`} className="hover:bg-slate-800/15 transition-all text-sm group">
      <td className="py-4 pl-4 text-right">
        <div className="flex items-center space-x-3 space-x-reverse">
          <UserAvatar 
            displayName={subscription.profiles?.display_name || 'کاربر هکسر'} 
            avatarUrl={subscription.profiles?.avatar_url} 
            size="md" 
          />
          <div className="flex flex-col">
            <span id={`sub-name-${subscription.id}`} className="text-xs font-bold text-slate-100 group-hover:text-brand-400 transition-colors">
              {subscription.profiles?.display_name || 'کاربر بدون نام'}
            </span>
            <span id={`sub-email-${subscription.id}`} className="text-[10px] text-slate-500 font-mono mt-0.5 mt-px">
              {subscription.profiles?.email || 'بدون ایمیل'}
            </span>
          </div>
        </div>
      </td>
      <td className="py-4 text-right">
        {(() => {
          const config = PLAN_CONFIGS[subscription.plan_id] || PLAN_CONFIGS['free'];
          const Icon = config.icon;
          return (
            <span className={`inline-flex items-center space-x-1 space-x-reverse px-2.5 py-1 ${config.badgeClass} rounded-lg text-xs font-bold`}>
              <Icon className="w-3.5 h-3.5 pointer-events-none" />
              <span>{config.name}</span>
            </span>
          );
        })()}
      </td>
      <td className="py-4 text-right">
        {getStatusBadge(subscription.status)}
      </td>
      <td className="py-4 text-right text-xs text-slate-400 font-mono font-bold">
        {subscription.plans?.price ? `${subscription.plans.price.toLocaleString('fa-IR')} تومان` : '۰ تومان'}
      </td>
      <td className="py-4 text-right text-xs font-semibold text-slate-400">
        {subscription.expires_at ? (
          <span className="font-mono text-slate-300">
            {new Date(subscription.expires_at).toLocaleDateString('fa-IR')}
          </span>
        ) : (
          <span className="text-slate-600 font-black">بدون انقضا (دائم)</span>
        )}
      </td>
      <td className="py-4 pr-4">
        <div className="flex items-center justify-end">
          <button
            id={`btn-edit-sub-${subscription.id}`}
            onClick={() => onEdit(subscription)}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700/80 hover:border-brand-500 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="تغییر پلن یا تمدید اشتراک"
          >
            <Edit className="w-3.5 h-3.5 pointer-events-none" />
          </button>
        </div>
      </td>
    </tr>
  );
};
