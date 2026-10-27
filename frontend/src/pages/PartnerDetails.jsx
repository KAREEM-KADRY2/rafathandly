import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Users, Percent, DollarSign, Wallet, TrendingDown, TrendingUp, 
  Calendar, FileText, Download, Printer, Plus, Edit2, Trash2, Archive, 
  RotateCcw, FileSpreadsheet, ArrowUpRight, ArrowDownLeft, Clock, Filter, AlertCircle,
  History, CheckCircle2, Ban, X, Info, CheckCircle, AlertTriangle
} from 'lucide-react';
import api from '../api';
import AddPartnerModal from '../components/AddPartnerModal';
import RecordPartnerTransactionModal from '../components/RecordPartnerTransactionModal';
import RecordPartnerReturnModal from '../components/RecordPartnerReturnModal';
import PartnerStatementModal from '../components/PartnerStatementModal';

export default function PartnerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [partner, setPartner] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [periodSummary, setPeriodSummary] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isEditPartnerOpen, setIsEditPartnerOpen] = useState(false);
  const [isRecordTxOpen, setIsRecordTxOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Return modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedWithdrawalForReturn, setSelectedWithdrawalForReturn] = useState(null);

  // Linked History modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryTx, setSelectedHistoryTx] = useState(null);

  // Cancel / Delete modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedCancelTx, setSelectedCancelTx] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const fetchPartnerDetails = async () => {
    try {
      const res = await api.get(`/partners/${id}`);
      setPartner(res.data);
    } catch (err) {
      console.error('Error fetching partner:', err);
    }
  };

  const fetchTransactions = async (customStart = startDate, customEnd = endDate) => {
    setLoading(true);
    try {
      const params = { filter: filterType };
      if (filterType === 'custom') {
        if (customStart) params.startDate = customStart;
        if (customEnd) params.endDate = customEnd;
      }

      const res = await api.get(`/partners/${id}/transactions`, { params });
      setTransactions(res.data?.transactions || []);
      setPeriodSummary(res.data?.periodSummary || null);
      if (res.data?.partner) {
        setPartner(res.data.partner);
      }
    } catch (err) {
      console.error('Error fetching partner transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartnerDetails();
  }, [id]);

  useEffect(() => {
    fetchTransactions();
  }, [id, filterType]);

  const handleOpenReturnModal = (tx) => {
    setSelectedWithdrawalForReturn(tx);
    setIsReturnModalOpen(true);
  };

  const handleOpenHistoryModal = (tx) => {
    setSelectedHistoryTx(tx);
    setIsHistoryModalOpen(true);
  };

  const handleOpenCancelModal = (tx) => {
    setSelectedCancelTx(tx);
    setCancelReason('');
    setCancelError('');
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedCancelTx) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      await api.delete(`/partners/transactions/${selectedCancelTx.id}`, {
        data: { reason: cancelReason }
      });
      setIsCancelModalOpen(false);
      setSelectedCancelTx(null);
      fetchTransactions();
      fetchPartnerDetails();
    } catch (err) {
      setCancelError(err.response?.data?.error || 'حدث خطأ أثناء إلغاء الحركة');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleEditTx = (tx) => {
    setEditingTransaction(tx);
    setIsRecordTxOpen(true);
  };

  const handleArchiveToggle = async () => {
    if (!partner) return;
    try {
      if (partner.is_active) {
        if (window.confirm(`هل أنت متأكد من أرشفة الشريك "${partner.name}"؟`)) {
          await api.patch(`/partners/${partner.id}/archive`);
          fetchPartnerDetails();
        }
      } else {
        await api.patch(`/partners/${partner.id}/unarchive`);
        fetchPartnerDetails();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'حدث خطأ أثناء تغيير حالة الشريك');
    }
  };

  if (!partner && loading) {
    return <div className="py-20 text-center text-gray-400 font-bold">جاري تحميل بيانات الشريك...</div>;
  }

  if (!partner) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-gray-500 font-bold">الشريك غير موجود أو تم حذفه</p>
        <Link to="/partners" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold inline-block">
          العودة لقائمة الشركاء
        </Link>
      </div>
    );
  }

  const typeLabels = {
    'withdrawal': 'سحب شخصي للشريك',
    'withdrawal_return': 'رد مبالغ مسحوبات',
    'payment': 'دفعة نقدية مسددة',
    'capital_contribution': 'مساهمة رأس مال',
    'profit_distribution': 'توزيع أرباح'
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" dir="rtl">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/partners"
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors"
            title="رجوع إلى قائمة الشركاء"
          >
            <ArrowRight size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-gray-800">{partner.name}</h1>
              {partner.is_active ? (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                  شريك نشط
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-bold">
                  مؤرشف
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs mt-0.5">
              نسبة الشراكة: <strong className="text-blue-700">{partner.share_percentage}%</strong> | تاريخ البدء: {partner.start_date || '-'} {partner.phone ? `| هاتف: ${partner.phone}` : ''}
            </p>
            {partner.notes && (
              <div className="mt-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 inline-flex items-center gap-1.5 font-medium">
                <span className="font-bold">الملاحظات:</span>
                <span>{partner.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {Boolean(partner.is_active) && (
            <button
              onClick={() => {
                setEditingTransaction(null);
                setIsRecordTxOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus size={17} />
              <span>تسجيل سحب / دفعة</span>
            </button>
          )}

          <button
            onClick={() => setIsStatementOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Printer size={17} />
            <span>كشف الحساب والطباعة</span>
          </button>

          <a
            href={`/api/partners/${partner.id}/statement/pdf`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
            title="تحميل كشف حساب PDF"
          >
            <Download size={16} />
            <span>PDF</span>
          </a>

          <a
            href={`/api/partners/${partner.id}/statement/excel`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
            title="تصدير كشف حساب Excel"
          >
            <FileSpreadsheet size={16} />
            <span>Excel</span>
          </a>

          <button
            onClick={() => setIsEditPartnerOpen(true)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all"
            title="تعديل بيانات الشريك"
          >
            <Edit2 size={16} />
            <span>تعديل</span>
          </button>

          <button
            onClick={handleArchiveToggle}
            className={`p-2 rounded-xl transition-all ${
              partner.is_active 
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' 
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
            }`}
            title={partner.is_active ? 'أرشفة الشريك' : 'استعادة الشريك'}
          >
            {partner.is_active ? <Archive size={18} /> : <RotateCcw size={18} />}
          </button>
        </div>
      </div>

      {/* Partner Metrics Overview Cards (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Metric 1: Share Percentage */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-gray-400 text-xs font-semibold block">نسبة الشراكة</span>
          <span className="text-xl font-black text-blue-700 mt-1 block">
            {partner.share_percentage}%
          </span>
        </div>

        {/* Metric 2: Total Capital */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-gray-400 text-xs font-semibold block">إجمالي رأس المال</span>
          <span className="text-lg font-black text-emerald-700 mt-1 block" dir="ltr">
            {Number(partner.total_capital || 0).toLocaleString()} <span className="text-xs">ج.م</span>
          </span>
        </div>

        {/* Metric 3: Total Withdrawals */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-gray-400 text-xs font-semibold block">إجمالي المسحوبات</span>
          <span className="text-lg font-black text-red-700 mt-1 block" dir="ltr">
            {Number(partner.total_withdrawals || 0).toLocaleString()} <span className="text-xs">ج.م</span>
          </span>
        </div>

        {/* Metric 4: Total Returned */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-gray-400 text-xs font-semibold block">المسترد للخزينة</span>
          <span className="text-lg font-black text-emerald-600 mt-1 block" dir="ltr">
            {Number(partner.total_returned || 0).toLocaleString()} <span className="text-xs">ج.م</span>
          </span>
        </div>

        {/* Metric 5: Net Withdrawals */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-gray-400 text-xs font-semibold block">صافي المسحوبات</span>
          <span className="text-lg font-black text-amber-700 mt-1 block" dir="ltr">
            {Number(partner.net_withdrawals || 0).toLocaleString()} <span className="text-xs">ج.م</span>
          </span>
        </div>

        {/* Metric 6: Intact Capital */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-gray-400 text-xs font-semibold block">رأس المال المحفوظ</span>
          <span className="text-lg font-black text-emerald-800 mt-1 block" dir="ltr">
            {Number(partner.total_capital || partner.capital_contribution || 0).toLocaleString()} <span className="text-xs">ج.م</span>
          </span>
          <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">ثابت لا يُخصم منه المسحوبات</span>
        </div>
      </div>

      {/* Filter Tabs & Period Box */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <span className="text-xs sm:text-sm font-bold text-gray-700">تصفية الحركات حسب الفترة:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'all' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterType('today')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'today' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setFilterType('week')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'week' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              هذا الأسبوع
            </button>
            <button
              onClick={() => setFilterType('month')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'month' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setFilterType('year')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'year' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              هذه السنة
            </button>
            <button
              onClick={() => setFilterType('custom')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                filterType === 'custom' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              مخصص
            </button>
          </div>
        </div>

        {/* Custom date range inputs */}
        {filterType === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <span>من تاريخ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="p-1.5 border border-gray-300 rounded-lg text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <span>إلى تاريخ:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="p-1.5 border border-gray-300 rounded-lg text-xs"
              />
            </div>
            <button
              onClick={() => fetchTransactions(startDate, endDate)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              تطبيق
            </button>
          </div>
        )}

        {/* Period Totals Box */}
        {periodSummary && (
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
            <div>
              <span className="text-gray-400 block font-semibold">سحوبات الفترة:</span>
              <span className="text-sm font-black text-red-700" dir="ltr">
                {Number(periodSummary.total_withdrawals || 0).toLocaleString()} ج.م
              </span>
            </div>
            <div>
              <span className="text-gray-400 block font-semibold">المسترد بالفترة:</span>
              <span className="text-sm font-black text-emerald-600" dir="ltr">
                {Number(periodSummary.total_returned || 0).toLocaleString()} ج.م
              </span>
            </div>
            <div>
              <span className="text-gray-400 block font-semibold">صافي المسحوبات:</span>
              <span className="text-sm font-black text-amber-700" dir="ltr">
                {Number(periodSummary.net_withdrawals || 0).toLocaleString()} ج.م
              </span>
            </div>
            <div>
              <span className="text-gray-400 block font-semibold">دفعات الفترة:</span>
              <span className="text-sm font-black text-indigo-700" dir="ltr">
                {Number(periodSummary.total_payments || 0).toLocaleString()} ج.م
              </span>
            </div>
            <div>
              <span className="text-gray-400 block font-semibold">صافي حركة الفترة:</span>
              <span className="text-sm font-black text-blue-900" dir="ltr">
                {Number(periodSummary.net_movement || 0).toLocaleString()} ج.م
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-base font-bold text-gray-800">
            سجل الحركات والمسحوبات ({transactions.length} حركة)
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 font-bold">جاري تحميل الحركات...</div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center text-gray-400 space-y-1">
            <p className="font-bold">لا توجد حركات مسجلة خلال هذه الفترة</p>
            <p className="text-xs">اضغط على زر "تسجيل سحب / دفعة" لإضافة حركة جديدة.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-gray-100 text-gray-600 font-bold">
                <tr>
                  <th className="p-3.5 text-center w-24">التاريخ</th>
                  <th className="p-3.5 text-center w-36">نوع العملية</th>
                  <th className="p-3.5">البيان والتفاصيل</th>
                  <th className="p-3.5 text-center w-28">المبلغ</th>
                  <th className="p-3.5 text-center w-36">طريقة الدفع / الخزينة</th>
                  <th className="p-3.5 text-center w-28">الحالة</th>
                  <th className="p-3.5 text-center w-40">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const isCancelled = tx.status === 'cancelled';
                  const isAddition = tx.transaction_type === 'capital_contribution' || tx.transaction_type === 'withdrawal_return';
                  const isWithdrawal = tx.transaction_type === 'withdrawal';
                  const isReturn = tx.transaction_type === 'withdrawal_return';
                  
                  return (
                    <tr 
                      key={tx.id} 
                      className={`transition-colors ${isCancelled ? 'bg-gray-50/70 opacity-60' : 'hover:bg-slate-50/70'}`}
                    >
                      {/* Date */}
                      <td className="p-3.5 text-center font-medium" dir="ltr">
                        {tx.transaction_date ? tx.transaction_date.substring(0, 10) : '-'}
                      </td>

                      {/* Type */}
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isCancelled
                            ? 'bg-gray-200 text-gray-700'
                            : tx.transaction_type === 'withdrawal_return'
                            ? 'bg-teal-100 text-teal-800'
                            : isAddition 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : tx.transaction_type === 'profit_distribution'
                            ? 'bg-purple-100 text-purple-800'
                            : tx.transaction_type === 'payment'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {isAddition ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                          <span>{typeLabels[tx.transaction_type] || tx.transaction_type}</span>
                        </span>
                      </td>

                      {/* Description & Return Context */}
                      <td className="p-3.5 text-gray-800">
                        <div className={`font-semibold ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                          {tx.description || '-'}
                        </div>
                        
                        {/* For Withdrawals: Show Breakdown & Linked Returns Pill */}
                        {isWithdrawal && !isCancelled && (
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                            {tx.returned_amount > 0 ? (
                              <div className="inline-flex items-center gap-2 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold text-emerald-900">
                                <span>المبلغ المرتجع: <strong>{Number(tx.returned_amount).toLocaleString()} ج.م</strong></span>
                                <span className="text-gray-300">|</span>
                                <span>المتبقي من السحب: <strong className={tx.remaining_amount === 0 ? 'text-emerald-700' : 'text-amber-700'}>{Number(tx.remaining_amount).toLocaleString()} ج.م</strong></span>
                              </div>
                            ) : (
                              <span className="text-gray-400">لم يتم رد أي مبالغ من هذا السحب بعد</span>
                            )}

                            {tx.linked_returns && tx.linked_returns.length > 0 && (
                              <button
                                onClick={() => handleOpenHistoryModal(tx)}
                                className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 font-bold"
                              >
                                <History size={12} />
                                <span>سجل الحركات المرتبطة ({tx.linked_returns.length})</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* For Returns: Show link to parent withdrawal */}
                        {isReturn && tx.parent_transaction_id && (
                          <div className="mt-1 text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 inline-flex items-center gap-1.5 font-medium">
                            <RotateCcw size={11} />
                            <span>مرتبط بحركة السحب رقم #{tx.parent_transaction_id}</span>
                            {tx.parent_withdrawal && (
                              <span>(أصل السحب: {Number(tx.parent_withdrawal.amount).toLocaleString()} ج.م)</span>
                            )}
                          </div>
                        )}

                        {/* Notes and Reference */}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {tx.reference && (
                            <span className="text-[11px] text-gray-500 font-medium">مرجع: {tx.reference}</span>
                          )}
                          {tx.notes && (
                            <span className="text-[11px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                              ملاحظة: {tx.notes}
                            </span>
                          )}
                          {isCancelled && tx.cancel_reason && (
                            <span className="text-[11px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 font-medium">
                              سبب الإلغاء: {tx.cancel_reason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="p-3.5 text-center font-black" dir="ltr">
                        <span className={
                          isCancelled 
                            ? 'text-gray-400 line-through' 
                            : isAddition 
                            ? 'text-emerald-700' 
                            : 'text-red-700'
                        }>
                          {isAddition ? '+' : '-'}{Number(tx.amount).toLocaleString()} ج.م
                        </span>
                      </td>

                      {/* Payment Method / Account */}
                      <td className="p-3.5 text-center">
                        <div className="font-semibold text-gray-700">{tx.payment_method || 'نقدي'}</div>
                        {tx.account_name ? (
                          <div className="text-[11px] text-blue-600 font-bold flex items-center justify-center gap-1 mt-0.5">
                            <Wallet size={12} />
                            <span>{tx.account_name}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400">تسجيل دفتري فقط</div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5 text-center">
                        {isCancelled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">
                            <Ban size={12} />
                            <span>ملغي</span>
                          </span>
                        ) : tx.computed_status === 'completed_return' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800" title="تم رد كامل مبلغ هذا السحب">
                            <CheckCircle2 size={12} />
                            <span>مكتمل الرد</span>
                          </span>
                        ) : tx.computed_status === 'partial_return' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800" title="تم رد جزء من المبلغ">
                            <Clock size={12} />
                            <span>مردود جزئياً</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                            <CheckCircle size={12} />
                            <span>نشط</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Record Return Button (For active withdrawals with remaining balance > 0) */}
                          {isWithdrawal && !isCancelled && tx.remaining_amount > 0 && (
                            <button
                              onClick={() => handleOpenReturnModal(tx)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
                              title="تسجيل رد مبلغ من هذا السحب إلى الخزينة"
                            >
                              <RotateCcw size={13} />
                              <span>رد مبلغ</span>
                            </button>
                          )}

                          {/* View linked returns if withdrawal has returns */}
                          {isWithdrawal && tx.linked_returns && tx.linked_returns.length > 0 && (
                            <button
                              onClick={() => handleOpenHistoryModal(tx)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                              title="عرض سجل الحركات المرتبطة"
                            >
                              <History size={15} />
                            </button>
                          )}

                          {/* Edit Transaction */}
                          {!isCancelled && (
                            <button
                              onClick={() => handleEditTx(tx)}
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                              title="تعديل الحركة"
                            >
                              <Edit2 size={15} />
                            </button>
                          )}

                          {/* Cancel / Delete Transaction */}
                          {!isCancelled && (
                            <button
                              onClick={() => handleOpenCancelModal(tx)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                              title="إلغاء / حذف الحركة وعكس الأثر المالي"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Linked Returns History Modal */}
      {isHistoryModalOpen && selectedHistoryTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <History size={20} className="text-blue-400" />
                <h3 className="text-base sm:text-lg font-bold">
                  سجل الحركات المرتبطة بالسحب رقم #{selectedHistoryTx.id}
                </h3>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Original Withdrawal Info Card */}
              <div className="bg-red-50/70 p-4 rounded-xl border border-red-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-red-900 text-sm">حركة السحب الأصلية:</span>
                  <span className="font-black text-red-700 text-base" dir="ltr">
                    {Number(selectedHistoryTx.amount).toLocaleString()} ج.م
                  </span>
                </div>
                <div className="text-xs text-gray-600 flex flex-wrap gap-4">
                  <span>التاريخ: {selectedHistoryTx.transaction_date?.substring(0, 10)}</span>
                  <span>الخزينة: {selectedHistoryTx.account_name || 'تسجيل دفتري'}</span>
                  <span>البيان: {selectedHistoryTx.description}</span>
                </div>
              </div>

              {/* Linked Returns List */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2">
                  مبالغ الرد المسجلة على هذا السحب ({selectedHistoryTx.linked_returns?.length || 0} عملية):
                </h4>
                {(!selectedHistoryTx.linked_returns || selectedHistoryTx.linked_returns.length === 0) ? (
                  <p className="text-gray-400 text-xs py-4 text-center">لا توجد حركات رد مسجلة على هذا السحب.</p>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-gray-600 font-bold border-b border-gray-200">
                        <tr>
                          <th className="p-2.5 text-center">رقم الحركة</th>
                          <th className="p-2.5 text-center">التاريخ</th>
                          <th className="p-2.5">البيان</th>
                          <th className="p-2.5 text-center">المبلغ المرتجع</th>
                          <th className="p-2.5 text-center">الخزينة المودع بها</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedHistoryTx.linked_returns.map(ret => (
                          <tr key={ret.id} className="hover:bg-slate-50">
                            <td className="p-2.5 text-center font-bold text-gray-700">#{ret.id}</td>
                            <td className="p-2.5 text-center" dir="ltr">{ret.transaction_date?.substring(0, 10)}</td>
                            <td className="p-2.5 text-gray-800">
                              <div>{ret.description}</div>
                              {ret.notes && <div className="text-[10px] text-amber-800">ملاحظة: {ret.notes}</div>}
                            </td>
                            <td className="p-2.5 text-center font-black text-emerald-700" dir="ltr">
                              +{Number(ret.amount).toLocaleString()} ج.م
                            </td>
                            <td className="p-2.5 text-center text-blue-600 font-bold">{ret.account_name || 'تسجيل دفتري'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Balance Summary Box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-500">إجمالي المرتجع: </span>
                  <strong className="text-emerald-700">{Number(selectedHistoryTx.returned_amount || 0).toLocaleString()} ج.م</strong>
                </div>
                <div>
                  <span className="text-gray-500">المتبقي الصافي من السحب: </span>
                  <strong className="text-base font-black text-amber-800">{Number(selectedHistoryTx.remaining_amount || 0).toLocaleString()} ج.م</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation / Safe Delete Confirmation Modal */}
      {isCancelModalOpen && selectedCancelTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <AlertTriangle size={22} className="text-red-200" />
                <h3 className="text-base sm:text-lg font-bold">تأكيد إلغاء / حذف الحركة المالية</h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm">
              {cancelError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold flex items-center gap-2">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <span>{cancelError}</span>
                </div>
              )}

              {/* Blocking Warning if Withdrawal has Active Returns */}
              {selectedCancelTx.transaction_type === 'withdrawal' && selectedCancelTx.returned_amount > 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                    <AlertTriangle size={18} className="text-amber-700" />
                    <span>لا يمكن حذف أو إلغاء هذه الحركة في الوقت الحالي!</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    يوجد مبالغ مرتجعة مسجلة ومرتبطة بحركة السحب هذه بإجمالي <strong>{Number(selectedCancelTx.returned_amount).toLocaleString()} ج.م</strong>.
                    للحفاظ على دقة الحسابات، يجب إلغاء حركات الرد المرتبطة أولاً قبل إلغاء حركة السحب الأصلية.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-gray-700 leading-relaxed">
                    أنت على وشك إلغاء الحركة المالية التالية. سيتم عكس أثرها المالي على الخزينة وحساب الشريك فوراً مع الاحتفاظ بسجل الأمان والتدقيق:
                  </p>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">اسم الشريك:</span>
                      <span className="font-bold text-gray-800">{partner.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">نوع الحركة:</span>
                      <span className="font-bold text-blue-700">{typeLabels[selectedCancelTx.transaction_type] || selectedCancelTx.transaction_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">المبلغ:</span>
                      <span className="font-black text-red-700" dir="ltr">{Number(selectedCancelTx.amount).toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">تاريخ الحركة:</span>
                      <span className="font-semibold text-gray-700" dir="ltr">{selectedCancelTx.transaction_date?.substring(0, 10)}</span>
                    </div>
                    {selectedCancelTx.account_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">الخزينة المتأثرة:</span>
                        <span className="font-bold text-emerald-700">{selectedCancelTx.account_name}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 font-bold mb-1">سبب الإلغاء (اختياري للتدقيق):</label>
                    <input
                      type="text"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="أدخل سبب إلغاء هذه الحركة..."
                      className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 text-xs"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={cancelLoading}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs sm:text-sm font-bold transition-colors"
              >
                تراجع
              </button>

              {!(selectedCancelTx.transaction_type === 'withdrawal' && selectedCancelTx.returned_amount > 0) && (
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={cancelLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  <span>{cancelLoading ? 'جاري الإلغاء...' : 'تأكيد الإلغاء وعكس الأثر'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Other Modals */}
      <AddPartnerModal
        isOpen={isEditPartnerOpen}
        partnerToEdit={partner}
        existingPartners={[]}
        onClose={() => setIsEditPartnerOpen(false)}
        onSuccess={() => {
          fetchPartnerDetails();
          fetchTransactions();
        }}
      />

      <RecordPartnerTransactionModal
        isOpen={isRecordTxOpen}
        partner={partner}
        editingTransaction={editingTransaction}
        onClose={() => {
          setIsRecordTxOpen(false);
          setEditingTransaction(null);
        }}
        onSuccess={() => {
          fetchPartnerDetails();
          fetchTransactions();
        }}
      />

      <RecordPartnerReturnModal
        isOpen={isReturnModalOpen}
        withdrawal={selectedWithdrawalForReturn}
        partner={partner}
        onClose={() => {
          setIsReturnModalOpen(false);
          setSelectedWithdrawalForReturn(null);
        }}
        onSuccess={() => {
          fetchPartnerDetails();
          fetchTransactions();
        }}
      />

      <PartnerStatementModal
        isOpen={isStatementOpen}
        partner={partner}
        onClose={() => setIsStatementOpen(false)}
      />
    </div>
  );
}
