import React from 'react';
import { Profile } from '../../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { Badge } from './Badge';
import { ShieldCheck, ShieldAlert, Edit2 } from 'lucide-react';
import { formatFaDate } from '../../lib/format';

interface UserRowProps {
  profile: Profile;
  onEdit: (profile: Profile) => void;
  onToggleBlock: (profile: Profile) => void;
}

export const UserRow: React.FC<UserRowProps> = ({
  profile,
  onEdit,
  onToggleBlock,
}) => {
  return (
    <tr id={`user-row-${profile.id}`} className="hover:bg-slate-800/15 transition-all text-sm group">
      <td className="py-4 pl-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <UserAvatar displayName={profile.display_name} avatarUrl={profile.avatar_url} size="md" />
          <div className="flex flex-col">
            <span id={`row-display-name-${profile.id}`} className="text-xs font-bold text-slate-100 group-hover:text-brand-400 transition-colors">
              {profile.display_name || 'کاربر بدون نام'}
            </span>
            <span id={`row-email-${profile.id}`} className="text-[10px] text-slate-500 font-mono mt-0.5 mt-px">{[profile.email, profile.phone].filter(Boolean).join(' • ') || 'بدون ایمیل / موبایل'}</span>
          </div>
        </div>
      </td>
      <td className="py-4 text-xs text-slate-400 font-mono">
        #{profile.id.slice(0, 8)}
      </td>
      <td className="py-4 text-right">
        <Badge variant={profile.is_blocked ? 'danger' : 'success'}>
          {profile.is_blocked ? 'مسدود شده' : 'فعال و مجاز'}
        </Badge>
      </td>
      <td className="py-4 text-xs font-medium text-slate-500">
        {formatFaDate(profile.created_at)}
      </td>
      <td className="py-4 pr-4">
        <div className="flex items-center justify-end gap-2">
          {/* Change Info Action */}
          <button
            id={`btn-edit-${profile.id}`}
            onClick={() => onEdit(profile)}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700/80 hover:border-brand-500 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="ویرایش کاربر"
          >
            <Edit2 className="w-3.5 h-3.5 pointer-events-none" />
          </button>

          {/* Toggle Block Action */}
          <button
            id={`btn-block-${profile.id}`}
            onClick={() => onToggleBlock(profile)}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              profile.is_blocked
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
            }`}
            title={profile.is_blocked ? 'رفع مسدودیت' : 'مسدود کردن'}
          >
            {profile.is_blocked ? (
              <ShieldCheck className="w-3.5 h-3.5 pointer-events-none" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 pointer-events-none" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
};
