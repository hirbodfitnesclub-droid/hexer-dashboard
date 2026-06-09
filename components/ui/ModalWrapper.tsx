import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalWrapperProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
  id,
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = 'max-w-xl',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div id={`${id}-root-container`} className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop blur */}
          <motion.div
            id={`${id}-backdrop`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
          />

          {/* Modal box */}
          <motion.div
            id={`${id}-content-panel`}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className={`w-full ${maxWidthClass} bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 relative`}
          >
            {/* Header */}
            <div id={`${id}-header-container`} className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/20">
              <h3 id={`${id}-modal-title`} className="text-base font-bold text-slate-100">
                {title}
              </h3>
              <button
                id={`${id}-close-button`}
                onClick={onClose}
                className="p-1 px-[5px] rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inner Content */}
            <div id={`${id}-body-container`} className="p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
