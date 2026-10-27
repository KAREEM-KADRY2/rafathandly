import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Printer, ArrowRightLeft, ArrowDownLeft, ArrowUpRight, Plus, 
  Wallet, Landmark, Smartphone, Search, Calendar, RefreshCw, Trash2, 
  FileText, CheckCircle2, TrendingUp, TrendingDown, Layers
} from 'lucide-react';
import api from '../api';
import TreasuryVoucherModal from './TreasuryVoucherModal';

export default function AccountDetailsModal({ isOpen, accountId, onClose, onRefreshAccounts }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, TRANSFER, IN, OUT
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Modals inside details
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDirection, setTransferDirection] = useState('FROM'); // FROM (out) or TO (in)
  const [transferForm, setTransferForm] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    description: '',
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
  });
  const [allAccounts, setAllAccounts] = useState([]);
  
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherType, setVoucherType] = useState('receipt');
  
  const printRef = useRef(null);

  useEffect(() => {
    if (isOpen && accountId) {
      fetchStatement();
      fetchOtherAccounts();
    }
  }, [isOpen, accountId, activeTab, startDate, endDate]);

  const fetchStatement = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') params.append('type', activeTab);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (search.trim()) params.append('search', search.trim());

      const res = await api.get(`/treasury/accounts/${accountId}/statement?${params.toString()}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching account statement:', err);
      alert('تعذر تحميل بيانات وكشف حساب الخزنة');
    } finally {
      setLoading(false);
    }
  };

  const fetchOtherAccounts = async () => {
    try {
      const res = await api.get('/treasury/accounts');
      const list = Array.isArray(res.data) ? res.data : (res.data?.accounts || []);
      setAllAccounts(list);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchStatement();
  };

  const handleOpenTransfer = (direction) => {
    setTransferDirection(direction);
    setTransferForm({
      from_account_id: direction === 'FROM' ? String(accountId) : '',
      to_account_id: direction === 'TO' ? String(accountId) : '',
      amount: '',
      description: '',
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
    });
    setShowTransferModal(true);
  };

  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    try {
      if (!transferForm.from_account_id || !transferForm.to_account_id) {
        alert('يرجى تحديد الخزنة المحول منها والخزنة المحول إليها');
        return;
      }
      if (transferForm.from_account_id === transferForm.to_account_id) {
        alert('لا يمكن التحويل لنفس الخزنة');
        return;
      }
      if (!transferForm.amount || Number(transferForm.amount) <= 0) {
        alert('يرجى إدخال مبلغ تحويل صحيح أكبر من صفر');
        return;
      }

      await api.post('/treasury/transfer', transferForm);
      setShowTransferModal(false);
      fetchStatement();
      if (onRefreshAccounts) onRefreshAccounts();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء إجراء التحويل');
    }
  };

  const handleDeleteTransaction = async (tx) => {
    const isTransfer = tx.related_entity_type === 'transfer_in' || tx.related_entity_type === 'transfer_out';
    const confirmMsg = isTransfer 
      ? 'هل أنت متأكد من حذف حركة التحويل هذه؟ سيتم إلغاؤها وعكس الرصيد في الخزنتين (المحولة والمستلمة) تلقائياً.'
      : 'هل أنت متأكد من حذف هذا السند وعكس تأثيره المالي؟';

    if (!window.confirm(confirmMsg)) return;

    try {
      await api.delete(`/treasury/voucher/${tx.id}`);
      fetchStatement();
      if (onRefreshAccounts) onRefreshAccounts();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف الحركة');
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  if (!isOpen) return null;

  const account = data?.account || {};
  const summary = data?.summary || {};
  const opening_balance = data?.opening_balance;
  const transactions = data?.transactions || [];

  const getAccountIcon = (type) => {
    switch (type) {
      case 'BANK': return <Landmark className="text-blue-600" size={24} />;
      case 'EWALLET': return <Smartphone className="text-purple-600" size={24} />;
      default: return <Wallet className="text-emerald-600" size={24} />;
    }
  };

  const getAccountTypeLabel = (type) => {
    switch (type) {
      case 'BANK': return 'حساب بنكي';
      case 'EWALLET': return 'محفظة إلكترونية';
      default: return 'نقدية / كاش';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex justify-between items-center rounded-t-2xl border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700">
              {getAccountIcon(account.type)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">{account.name || 'تفاصيل الخزنة'}</h2>
                <span className="text-xs bg-slate-700 text-slate-200 px-2.5 py-0.5 rounded-full font-bold">
                  {getAccountTypeLabel(account.type)}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                كشف حساب شامل ومفصل لجميع التحويلات والوارد والمنصرف
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col text-left px-4 py-1.5 bg-slate-800 rounded-xl border border-slate-700" dir="ltr">
              <span className="text-[11px] font-bold text-slate-400">الرصيد الحالي</span>
              <span className={`text-lg font-black ${Number(account.balance || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {Number(account.balance || 0).toLocaleString()} ج.م
              </span>
            </div>
            
            <button
              onClick={handlePrint}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition flex items-center gap-1.5 text-xs font-bold border border-slate-700"
              title="طباعة كشف حساب الخزنة"
            >
              <Printer size={18} />
              <span className="hidden md:inline">طباعة الكشف</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-rose-900/40 rounded-xl transition"
              title="إغلاق"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BODY CONTAINER */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 bg-slate-50" ref={printRef}>
          
          {/* STATS SUMMARY BAR */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
            
            {/* 1. Current Balance */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                <span>الرصيد الحالي</span>
                <CheckCircle2 size={16} className={Number(account.balance || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
              </div>
              <div className={`text-xl sm:text-2xl font-black ${Number(account.balance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
                {Number(account.balance || 0).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 font-semibold">السيولة المتاحة في الخزنة</span>
            </div>

            {/* 2. Opening Balance */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                <span>الرصيد الافتتاحي</span>
                <Layers size={16} className="text-indigo-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-indigo-700" dir="ltr">
                {opening_balance ? Number(opening_balance.amount || 0).toLocaleString() : '0'} <span className="text-xs font-normal">ج.م</span>
              </div>
              <span className="text-[11px] text-indigo-600 font-bold mt-1">
                {opening_balance ? `(${opening_balance.balance_type === 'credit' ? 'دائن / له' : 'مدين / عليه'})` : 'رصيد البداية'}
              </span>
            </div>

            {/* 3. Total Incoming */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                <span>إجمالي الوارد (+)</span>
                <TrendingUp size={16} className="text-emerald-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-700" dir="ltr">
                {Number(summary.total_in || 0).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 font-semibold">مقبوضات وتحصيلات وتحويل وارد</span>
            </div>

            {/* 4. Total Outgoing */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 mb-1">
                <span>إجمالي الصادر (-)</span>
                <TrendingDown size={16} className="text-rose-500" />
              </div>
              <div className="text-lg sm:text-xl font-black text-rose-700" dir="ltr">
                {Number(summary.total_out || 0).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 font-semibold">مدفوعات ومصروفات وتحويل صادر</span>
            </div>

            {/* 5. Transfers Total */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
              <div className="flex justify-between items-center text-xs font-bold text-blue-900 mb-1">
                <span>حركات التحويل</span>
                <ArrowRightLeft size={16} className="text-blue-600" />
              </div>
              <div className="space-y-0.5 text-xs font-bold">
                <div className="flex justify-between text-emerald-700">
                  <span>وارد:</span>
                  <span dir="ltr">+{Number(summary.transfers_in || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>صادر:</span>
                  <span dir="ltr">-{Number(summary.transfers_out || 0).toLocaleString()}</span>
                </div>
              </div>
              <span className="text-[11px] text-blue-800 font-bold mt-1 text-center bg-blue-100/60 py-0.5 rounded">
                {summary.total_transfers_count || 0} حركة تحويل
              </span>
            </div>

          </div>

          {/* ACTION BUTTONS TOOLBAR */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-slate-500 ml-1">إجراءات سريعة:</span>
              
              <button
                onClick={() => handleOpenTransfer('FROM')}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <ArrowUpRight size={16} />
                <span>تحويل صادر (من هذه الخزنة)</span>
              </button>

              <button
                onClick={() => handleOpenTransfer('TO')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <ArrowDownLeft size={16} />
                <span>تحويل وارد (إلى هذه الخزنة)</span>
              </button>

              <button
                onClick={() => { setVoucherType('receipt'); setShowVoucherModal(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus size={16} />
                <span>سند قبض / إيداع</span>
              </button>

              <button
                onClick={() => { setVoucherType('payment'); setShowVoucherModal(true); }}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus size={16} />
                <span>سند صرف / سحب</span>
              </button>
            </div>

            <button
              onClick={fetchStatement}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition flex items-center gap-1 text-xs font-bold"
              title="تحديث البيانات"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>تحديث</span>
            </button>
          </div>

          {/* TABS & FILTERS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            
            {/* Tabs Header */}
            <div className="p-3 border-b border-slate-100 flex flex-wrap gap-2 justify-between items-center bg-slate-50/70">
              
              {/* Category Tabs */}
              <div className="flex gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  كل الحركات ({summary.total_transactions || 0})
                </button>
                <button
                  onClick={() => setActiveTab('TRANSFER')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 ${activeTab === 'TRANSFER' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  <ArrowRightLeft size={14} />
                  <span>التحويلات فقط ({summary.total_transfers_count || 0})</span>
                </button>
                <button
                  onClick={() => setActiveTab('IN')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${activeTab === 'IN' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  الوارد فقط (+)
                </button>
                <button
                  onClick={() => setActiveTab('OUT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${activeTab === 'OUT' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  الصادر فقط (-)
                </button>
              </div>

              {/* Date Filters & Search */}
              <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400 font-bold">من:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 font-bold mr-1">إلى:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="بحث في البيان / الطرف..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border border-slate-300 rounded-lg pr-7 pl-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 w-40 sm:w-48"
                  />
                  <Search size={14} className="absolute right-2 top-2 text-slate-400" />
                </div>

                <button
                  type="submit"
                  className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow-sm"
                >
                  بحث
                </button>
                
                {(startDate || endDate || search || activeTab !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); setActiveTab('ALL'); }}
                    className="text-xs text-rose-600 hover:underline font-bold"
                  >
                    إعادة تعيين
                  </button>
                )}
              </form>
            </div>

            {/* TRANSACTIONS TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-center">م</th>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">الطرف المتعامل</th>
                    <th className="p-3 text-center text-emerald-700">وارد (+)</th>
                    <th className="p-3 text-center text-rose-700">صادر (-)</th>
                    <th className="p-3 text-center bg-slate-200/50">الرصيد التراكمي</th>
                    <th className="p-3">البيان والتفاصيل</th>
                    <th className="p-3">المستخدم</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-slate-400 font-bold">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-600" />
                        جاري تحميل حركات وتحويلات الخزنة...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-slate-400 font-bold">
                        لا توجد تحويلات أو حركات مطابقة للبحث في هذه الخزنة
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx, idx) => {
                      const isTransferIn = tx.related_entity_type === 'transfer_in';
                      const isTransferOut = tx.related_entity_type === 'transfer_out';
                      const isTransfer = isTransferIn || isTransferOut;
                      const isOB = tx.related_entity_type === 'OPENING_BALANCE' || (tx.description && tx.description.includes('رصيد افتتاحي'));

                      return (
                        <tr key={tx.id || idx} className={`hover:bg-slate-50 transition-colors ${isTransfer ? 'bg-blue-50/30' : ''}`}>
                          <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                          
                          <td className="p-3 font-semibold text-slate-600 whitespace-nowrap">
                            {tx.date ? new Date(tx.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                          </td>

                          {/* Transaction Type Badge */}
                          <td className="p-3 whitespace-nowrap">
                            {isTransferIn ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                                <ArrowDownLeft size={13} /> تحويل وارد
                              </span>
                            ) : isTransferOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 shadow-sm">
                                <ArrowUpRight size={13} /> تحويل صادر
                              </span>
                            ) : isOB ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-sm">
                                <FileText size={13} /> رصيد افتتاحي
                              </span>
                            ) : tx.type === 'IN' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                                📥 سند قبض / توريد
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                                📤 سند صرف / سداد
                              </span>
                            )}
                          </td>

                          {/* Party Name */}
                          <td className="p-3 font-bold text-slate-800">
                            {isTransferIn ? (
                              <span className="text-blue-900 font-black">
                                من خزنة: {tx.party_name || 'خزنة أخرى'}
                              </span>
                            ) : isTransferOut ? (
                              <span className="text-blue-900 font-black">
                                إلى خزنة: {tx.party_name || 'خزنة أخرى'}
                              </span>
                            ) : (
                              <span>
                                {tx.party_name ? `${tx.party_name} (${tx.party_type_label || 'جهة'})` : (tx.party_type_label || '-')}
                              </span>
                            )}
                          </td>

                          {/* Amount IN */}
                          <td className="p-3 text-center font-black text-emerald-600 whitespace-nowrap" dir="ltr">
                            {tx.type === 'IN' ? `+ ${Number(tx.amount || 0).toLocaleString()} ج.م` : '-'}
                          </td>

                          {/* Amount OUT */}
                          <td className="p-3 text-center font-black text-rose-600 whitespace-nowrap" dir="ltr">
                            {tx.type === 'OUT' ? `- ${Number(tx.amount || 0).toLocaleString()} ج.م` : '-'}
                          </td>

                          {/* Running Balance */}
                          <td className="p-3 text-center font-black text-slate-800 bg-slate-100/50 whitespace-nowrap" dir="ltr">
                            {Number(tx.running_balance || 0).toLocaleString()} ج.م
                          </td>

                          {/* Description */}
                          <td className="p-3 font-semibold text-slate-700 max-w-xs break-words">
                            {isOB ? 'رصيد الدفتر الافتتاحي للخزنة' : (tx.description || '-')}
                          </td>

                          {/* User */}
                          <td className="p-3 text-slate-500 font-semibold whitespace-nowrap">
                            {tx.user || 'النظام'}
                          </td>

                          {/* Delete Button */}
                          <td className="p-3 text-center whitespace-nowrap">
                            {!isOB && (
                              <button
                                onClick={() => handleDeleteTransaction(tx)}
                                className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition"
                                title={isTransfer ? 'إلغاء وحذف حركة التحويل' : 'حذف السند وعكس تأثيره'}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>

      </div>

      {/* TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200" dir="rtl">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <ArrowRightLeft className="text-blue-600" size={20} />
                <span>
                  {transferDirection === 'FROM' ? `تحويل صادر من: ${account.name}` : `تحويل وارد إلى: ${account.name}`}
                </span>
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">من خزنة (المرسلة)</label>
                <select
                  required
                  value={transferForm.from_account_id}
                  onChange={(e) => setTransferForm({ ...transferForm, from_account_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختر الخزنة المرسلة</option>
                  {allAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (رصيدها: {Number(acc.balance || 0).toLocaleString()} ج.م)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">إلى خزنة (المستلمة)</label>
                <select
                  required
                  value={transferForm.to_account_id}
                  onChange={(e) => setTransferForm({ ...transferForm, to_account_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">اختر الخزنة المستلمة</option>
                  {allAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (رصيدها: {Number(acc.balance || 0).toLocaleString()} ج.م)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">المبلغ المراد تحويله (ج.م)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-lg font-black text-blue-900 outline-none focus:ring-2 focus:ring-blue-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ التحويل</label>
                <input
                  type="date"
                  value={transferForm.date}
                  onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">بيان / ملاحظات (اختياري)</label>
                <input
                  type="text"
                  value={transferForm.description}
                  onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                  placeholder="سبب التحويل..."
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-sm"
                >
                  تأكيد التحويل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VOUCHER MODAL */}
      {showVoucherModal && (
        <TreasuryVoucherModal
          isOpen={showVoucherModal}
          type={voucherType}
          initialAccountId={accountId}
          onClose={() => setShowVoucherModal(false)}
          onSuccess={() => {
            setShowVoucherModal(false);
            fetchStatement();
            if (onRefreshAccounts) onRefreshAccounts();
          }}
        />
      )}

    </div>
  );
}
