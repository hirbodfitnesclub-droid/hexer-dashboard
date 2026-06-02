import React, { useState } from 'react';
import { useAdminStore } from '../store/adminStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ShieldCheck, User, Lock, ArrowLeftRight } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { login, isLoading } = useAdminStore();
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus(null);

    if (!usernameInput.trim() || !passwordInput.trim()) {
      setErrorStatus('لطفا نام کاربری و رمز عبور را وارد کنید.');
      toast.error('پر کردن تمامی فیلدها الزامی است.');
      return;
    }

    const success = login(usernameInput, passwordInput);
    if (success) {
      toast.success('ورود شما با موفقیت انجام شد. خوش‌آمدید!');
    } else {
      setErrorStatus('نام کاربری یا رمز عبور نادرست است.');
      toast.error('اطلاعات ورود نامعتبر است.');
    }
  };

  return (
    <div 
      id="login-page-root" 
      className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4 relative overflow-hidden"
    >
      {/* Radiant Glow Lights */}
      <div id="glow-light-1" className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div id="glow-light-2" className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 blur-[130px] rounded-full pointer-events-none" />

      <motion.div
        id="login-animated-container"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="w-full max-w-md bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800 p-8 md:p-10 shadow-2xl relative"
      >
        {/* Brand visual header */}
        <div id="login-brand-header" className="flex flex-col items-center mb-8">
          <div id="login-shield-badge" className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 mb-4 animate-pulse">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h2 id="login-main-title" className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
            درگاه امنیتی پلتفرم هکسر
          </h2>
          <p id="login-intro-text" className="text-xs text-slate-400 mt-2 text-center text-balance font-medium leading-relaxed">
            لطفا اطلاعات احراز هویت ادمین ارشد را جهت ورود ثبت نمایید.
          </p>
        </div>

        {/* Action interactive Form panel */}
        <form id="login-form-submit" onSubmit={handleSubmit} className="space-y-5">
          <Input
            id="username"
            label="نام کاربری ادمین"
            type="text"
            placeholder="مثال: arash"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            error={errorStatus && !usernameInput ? 'نام کاربری ضروری است' : null}
            icon={<User className="w-4 h-4 text-slate-500" />}
            autoFocus
          />

          <Input
            id="password"
            label="گذرواژه امنیتی"
            type="password"
            placeholder="••••••••"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            error={errorStatus && !passwordInput ? 'گذرواژه ضروری است' : null}
            icon={<Lock className="w-4 h-4 text-slate-500" />}
          />

          {errorStatus && (
            <div id="form-error-panel" className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-xs text-center font-bold">
              {errorStatus}
            </div>
          )}

          <Button
            id="login-action-btn"
            type="submit"
            variant="primary"
            className="w-full text-sm font-extrabold"
            isLoading={isLoading}
            icon={<ArrowLeftRight className="w-4 h-4 scale-x-[-1]" />}
          >
            ورود به سیستم مدیریت
          </Button>
        </form>

        {/* Bottom copyright banner */}
        <div id="login-footer-copyright" className="mt-8 text-center border-t border-slate-800/60 pt-4">
          <p id="copyright-txt" className="text-[10px] text-slate-500 tracking-wider font-mono">
            SECURE SYSTEM SHELL // HEXER.CO © 2026
          </p>
        </div>
      </motion.div>
    </div>
  );
};
