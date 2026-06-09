import React, { useEffect, useState } from 'react';
import { SupportTicket } from '../lib/supabase';
import { dataStore } from '../lib/dataStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ModalWrapper } from '../components/ui/ModalWrapper';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Input } from '../components/ui/Input';
import { 
  MessageSquare, 
  Search, 
  Filter, 
  Mail, 
  User as UserIcon, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  Copy, 
  Check, 
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';

export const TicketsManager: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'pending' | 'resolved' | 'closed'>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const fetchTicketsList = async () => {
    try {
      setLoading(true);
      const list = await dataStore.getTickets();
      setTickets(list);
    } catch (e: any) {
      toast.error(e.message || 'خطا در دریافت لیست تیکت‌های پشتیبانی');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketsList();
  }, []);

  const handleCopyEmail = (email: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    toast.success('شناسه تماس کاربر کپی شد');
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    const cleaned = (status || '').toLowerCase().trim();
    switch (cleaned) {
      case 'open':
        return <Badge variant="info">باز</Badge>;
      case 'pending':
        return <Badge variant="warning">در انتظار پاسخ</Badge>;
      case 'resolved':
      case 'success':
        return <Badge variant="success">حل شده</Badge>;
      case 'closed':
        return <Badge variant="neutral">بسته شده</Badge>;
      default:
        return <Badge variant="neutral">{status || 'نامشخص'}</Badge>;
    }
  };

  // Compute stats
  const totalCount = tickets.length;
  const openCount = tickets.filter(t => (t.status || '').toLowerCase() === 'open').length;
  const pendingCount = tickets.filter(t => (t.status || '').toLowerCase() === 'pending').length;
  const resolvedCount = tickets.filter(t => ['resolved', 'success'].includes((t.status || '').toLowerCase())).length;
  const closedCount = tickets.filter(t => (t.status || '').toLowerCase() === 'closed').length;

  // Filter & Search
  const filteredTickets = tickets.filter(ticket => {
    const statusCleaned = (ticket.status || '').toLowerCase().trim();
    
    // 1. Status filter
    let matchesFilter = true;
    if (activeFilter === 'open') matchesFilter = statusCleaned === 'open';
    else if (activeFilter === 'pending') matchesFilter = statusCleaned === 'pending';
    else if (activeFilter === 'resolved') matchesFilter = ['resolved', 'success'].includes(statusCleaned);
    else if (activeFilter === 'closed') matchesFilter = statusCleaned === 'closed';

    // 2. Search query filter
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query ? true : (
      (ticket.subject || '').toLowerCase().includes(query) ||
      (ticket.message || '').toLowerCase().includes(query) ||
      (ticket.email || '').toLowerCase().includes(query) ||
      (ticket.profiles?.display_name || '').toLowerCase().includes(query)
    );

    return matchesFilter && matchesSearch;
  });

  return (
    <motion.div
      id="tickets-manager-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      {/* Header Section */}
      <div id="tickets-header" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 id="tickets-title" className="text-xl md:text-2xl font-extrabold text-slate-100 flex items-center space-x-2 space-x-reverse">
            <MessageSquare className="w-6 h-6 text-brand-400" />
            <span>مدیریت تیکت‌های پشتیبانی</span>
          </h2>
          <p id="tickets-desc" className="text-xs text-slate-400 mt-1.5 font-medium">
            بررسی و نظارت بر سوالات، گزارشات و بازخوردهای ارسالی از طرف کاربران پلتفرم هکسر
          </p>
        </div>
        
        <Button
          id="refresh-tickets-btn"
          variant="secondary"
          onClick={fetchTicketsList}
          isLoading={loading}
          icon={<RefreshCw className="w-4 h-4" />}
          className="self-start md:self-auto"
        >
          به‌روزرسانی لیست
        </Button>
      </div>

      {/* Stats Bento Grid */}
      <div id="tickets-stats-grid" className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card id="stat-total" hoverable={false} className="border-l-4 border-l-brand-500 !p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold">کل تیکت‌ها</p>
              <h3 className="text-xl font-black text-white mt-1.5 font-mono">{loading ? '...' : totalCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card id="stat-open" hoverable={false} className="border-l-4 border-l-cyan-500 !p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold">تیکت‌های باز</p>
              <h3 className="text-xl font-black text-cyan-400 mt-1.5 font-mono">{loading ? '...' : openCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card id="stat-pending" hoverable={false} className="border-l-4 border-l-amber-500 !p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold">در انتظار پاسخ</p>
              <h3 className="text-xl font-black text-amber-500 mt-1.5 font-mono">{loading ? '...' : pendingCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card id="stat-resolved" hoverable={false} className="border-l-4 border-l-emerald-500 !p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold">حل شده</p>
              <h3 className="text-xl font-black text-emerald-400 mt-1.5 font-mono">{loading ? '...' : resolvedCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card id="stat-closed" hoverable={false} className="border-l-4 border-l-slate-600 !p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold">بسته‌شده</p>
              <h3 className="text-xl font-black text-slate-400 mt-1.5 font-mono">{loading ? '...' : closedCount}</h3>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500">
              <CheckCircle className="w-4 h-4 opacity-70" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Panel */}
      <div id="filter-search-panel" className="bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Switch Tabs */}
        <div id="status-switcher-wrapper" className="flex items-center overflow-x-auto gap-2 py-1 scrollbar-none">
          <button
            id="tab-filter-all"
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'all' 
                ? 'bg-brand-500/10 border border-brand-500/30 text-white' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            همه تیکت‌ها ({totalCount})
          </button>
          <button
            id="tab-filter-open"
            onClick={() => setActiveFilter('open')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'open' 
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            تیکت‌های باز ({openCount})
          </button>
          <button
            id="tab-filter-pending"
            onClick={() => setActiveFilter('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'pending' 
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            در انتظار پاسخ ({pendingCount})
          </button>
          <button
            id="tab-filter-resolved"
            onClick={() => setActiveFilter('resolved')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'resolved' 
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            حل شده ({resolvedCount})
          </button>
          <button
            id="tab-filter-closed"
            onClick={() => setActiveFilter('closed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'closed' 
                ? 'bg-slate-800 border border-slate-700 text-slate-300' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            بسته شده ({closedCount})
          </button>
        </div>

        {/* Search input field */}
        <div id="search-input-container" className="relative w-full md:w-80">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            id="ticket-search-box"
            type="text"
            placeholder="جستجو در موضوع، پیغام، ایمیل یا موبایل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 font-sans text-xs bg-slate-950/50 border-white/5 focus:border-brand-500/50 rounded-xl"
          />
        </div>
      </div>

      {/* Main content viewport */}
      {loading ? (
        <div id="tickets-loading-panel" className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border border-white/5 rounded-2xl">
          <LoadingSpinner id="tickets-spinner" />
          <p className="text-xs text-slate-400 mt-4">در حال واکشی اطلاعات تیکت‌های پشتیبانی هکسر...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div id="tickets-empty-panel" className="flex flex-col items-center justify-center py-16 bg-slate-900/20 border border-white/5 rounded-2xl text-center">
          <HelpCircle className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-sm text-slate-300 font-bold">هیچ تیکتی با معیارهای شما یافت نشد</p>
          <p className="text-xs text-slate-500 mt-1.5">شما می‌توانید معیار فیلتر یا واژه‌های جستجوی خود را تغییر دهید</p>
        </div>
      ) : (
        <div id="tickets-list-wrapper" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((ticket, index) => {
            const PersianDate = new Date(ticket.created_at).toLocaleDateString('fa-IR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            return (
              <motion.div
                key={ticket.id}
                id={`ticket-card-${ticket.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
              >
                <Card 
                  id={`ticket-card-inner-${ticket.id}`}
                  onClick={() => setSelectedTicket(ticket)}
                  className="bg-slate-900/60 border border-white/5 hover:border-white/10 glow-hover min-h-[160px] flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top status & date row */}
                    <div className="flex items-center justify-between">
                      {getStatusBadge(ticket.status)}
                      <span className="text-[10px] text-slate-500 font-bold font-sans flex items-center space-x-1 space-x-reverse">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{PersianDate}</span>
                      </span>
                    </div>

                    {/* Subject line */}
                    <h4 className="text-sm font-extrabold text-slate-200 line-clamp-1">
                      {ticket.subject || 'بدون موضوع'}
                    </h4>

                    {/* Short message teaser snippet */}
                    <p className="text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed">
                      {ticket.message || 'پیامی درج نشده است'}
                    </p>
                  </div>

                  {/* Profile info footer in Card */}
                  <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-2 space-x-reverse min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs text-slate-300 font-bold block truncate">
                          {ticket.profiles?.display_name || 'کاربر مهمان'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 space-x-reverse">
                      <span className="text-[10px] text-slate-500 truncate max-w-[140px] font-mono leading-none">
                        {ticket.email || 'بدون ایمیل / موبایل'}
                      </span>
                      <button 
                        id={`btn-view-${ticket.id}`}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 transition-colors"
                        title="مشاهده جزئیات کامل"
                      >
                        <Eye className="w-3.5 h-3.5 pointer-events-none" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Premium ticket diagnostic detail view Modal */}
      <ModalWrapper
        id="ticket-details-modal"
        isOpen={selectedTicket !== null}
        onClose={() => {
          setSelectedTicket(null);
          setCopiedEmail(false);
        }}
        title="بررسی جزئیات تیکت پشتیبانی"
        maxWidthClass="max-w-2xl"
      >
        {selectedTicket && (
          <div id="selected-ticket-modal-content" className="space-y-6">
            
            {/* Subject, Status & Date */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">موضوع تیکت پشتیبانی</span>
                {getStatusBadge(selectedTicket.status)}
              </div>
              <h3 className="text-base font-black text-white leading-relaxed">
                {selectedTicket.subject || 'بدون موضوع'}
              </h3>
              
              <div className="flex items-center space-x-1.5 space-x-reverse text-xs text-slate-400 pt-1.5 border-t border-white/5">
                <Clock className="w-4 h-4 text-brand-400" />
                <span>ارسال شده در تاریخ:</span>
                <span className="font-bold text-slate-300 font-sans">
                  {new Date(selectedTicket.created_at).toLocaleDateString('fa-IR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>

            {/* Support Message */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400">متن پیام کاربر</span>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-slate-200 text-xs leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                {selectedTicket.message || 'هیچ پیامی ارسال نشده است.'}
              </div>
            </div>

            {/* User Meta Data Profiler card */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400">اطلاعات فرستنده (پروفایل کاربر)</span>
              
              <div className="p-4 bg-slate-950/30 rounded-2xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5 space-x-reverse">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-brand-400">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-100">{selectedTicket.profiles?.display_name || 'کاربر شناخته‌نشده'}</h4>
                    <p className="text-[10px] text-slate-500 mt-1.5 font-bold">شناسه کاربر: <span className="font-mono text-slate-400">{selectedTicket.user_id}</span></p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  <div className="text-left font-mono text-xs text-slate-400 leading-none">
                    {selectedTicket.email || 'بدون ایمیل / موبایل'}
                  </div>

                  <Button
                    id="copy-user-email-btn"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopyEmail(selectedTicket.email)}
                    icon={copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    className="!py-1 font-sans text-[10px] min-h-0 bg-slate-800/80"
                  >
                    {copiedEmail ? 'کپی شد' : 'کپی شناسه تماس'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Read-Only action banner */}
            <div className="p-3 px-4 bg-slate-800/40 border border-slate-700/50 rounded-xl flex items-start space-x-2.5 space-x-reverse text-slate-400">
              <Mail className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] leading-relaxed">
                برای فرستادن پاسخ، لطفاً با کلیک روی دکمه{' '}
                <strong className="text-slate-300">کپی شناسه تماس</strong>، شناسه تماس (ایمیل/موبایل) کاربر را کپی کرده و از طریق وب‌میل یا تماس پیگیری کنید.
              </p>
            </div>
          </div>
        )}
      </ModalWrapper>
    </motion.div>
  );
};
