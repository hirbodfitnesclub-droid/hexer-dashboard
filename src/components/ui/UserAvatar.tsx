import React from 'react';

interface UserAvatarProps {
  displayName: string | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  displayName,
  avatarUrl,
  size = 'md',
}) => {
  const getInitials = (name: string | null): string => {
    if (!name) return 'کاربر';
    const cleanName = name.trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length > 1) {
      return `${parts[0].charAt(0)} ${parts[1].charAt(0)}`;
    }
    return cleanName.slice(0, 2);
  };

  const colors = [
    'from-pink-500 to-purple-600',
    'from-purple-500 to-indigo-600',
    'from-blue-500 to-brand-600',
    'from-teal-500 to-emerald-600',
    'from-amber-500 to-orange-600',
  ];

  // Pick a stable color gradient based on string characters
  const stringHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  const nameForHash = displayName || 'Hexer User';
  const colorIndex = stringHash(nameForHash) % colors.length;
  const gradientClass = colors[colorIndex];

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base font-bold',
  };

  return (
    <div 
      id={`avatar-${stringHash(nameForHash)}`}
      className={`flex items-center justify-center rounded-full overflow-hidden text-white font-medium bg-gradient-to-br border border-slate-700 shadow-inner flex-shrink-0 ${sizeClasses[size]} ${
        avatarUrl ? 'bg-slate-800' : gradientClass
      }`}
    >
      {avatarUrl ? (
        <img
          id={`avatar-img-${stringHash(nameForHash)}`}
          src={avatarUrl}
          alt={displayName || 'User Avatar'}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Remove image if failed to load
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <span id={`avatar-initials-${stringHash(nameForHash)}`}>{getInitials(displayName)}</span>
    </div>
  );
};
