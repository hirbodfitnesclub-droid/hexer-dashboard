import React from 'react';

interface CardProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  id,
  children,
  className = '',
  onClick,
  hoverable = true,
}) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`glass-card rounded-2xl p-6 glow-hover ${
        hoverable ? 'hover:-translate-y-1 hover:shadow-lg cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
