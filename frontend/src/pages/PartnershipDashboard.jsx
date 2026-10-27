import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Eye, Edit2, Trash2, Percent, DollarSign, Wallet, 
  ArrowUpRight, ArrowDownLeft, AlertTriangle, CheckCircle, Archive, RotateCcw, 
  FileText, ShieldAlert, TrendingDown, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import AddPartnerModal from '../components/AddPartnerModal';
import RecordPartnerTransactionModal from '../components/RecordPartnerTransactionModal';
import PartnerStatementModal from '../components/PartnerStatementModal';

export default function PartnershipDashboard() {
  const [partners, setPartners] = useState([]);
  const [summary, setSummary] = useState({
    total_partners: 0,
    archived_partners: 0,
    total_percentage: 0,
    is_percentage_valid: true,
    percentage_diff: 0,
    total_capital: 0,
    total_withdrawals: 0,
    total_payments: 0,
    total_profit_distributions: 0,
    total_balance: 0
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'archived', 'all'
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [partnerToEdit, setPartnerToEdit] = useState(null);

  const [isRecordTxOpen, setIsRecordTxOpen] = useState(false);
  const [selectedPartnerForTx, setSelectedPartnerForTx] = useState(null);

  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [selectedPartnerForStatement, setSelectedPartnerForStatement] = useState(null);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const res = await api.get('/partners', {
        params: { status: statusFilter, search: searchTerm }
      });
      setPartners(res.data?.partners || []);
      if (res.data?.summary) {
        setSummary(res.data.summary);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
      setPartners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayFn = setTimeout(() => {
      fetchPartners();
    }, 250);
    return () => clearTimeout(delayFn);
  }, [statusFilter, searchTerm]);

  const handleEditPartner = (p) => {
    setPartnerToEdit(p);
    setIsAddPartnerOpen(true);
  };

  const handleOpenTransaction = (p) => {
    setSelectedPartnerForTx(p);
    setIsRecordTxOpen(true);
  };

  const handleOpenStatement = (p) => {
    setSelectedPartnerForStatement(p);
    setIsStatementOpen(true);
  };

  const handleArchive = async (p) => {
    if (window.confirm(`هل أنت متأكد من أرشفة الشريك "${p.name}"؟ سيتم الاحتفاظ بكامل سجلاته المالية دون حذف.`)) {
      try {
        await api.patch(`/partners/${p.id}/archive`);
        fetchPartners();
      } catch (err) {
        alert(err.response?.data?.error || 'حدث خطأ أثناء أرشفة الشريك');
      }
    }
  };

  const handleUnarchive = async (p) => {
    try {
      await api.patch(`/partners/${p.id}/unarchive`);
      fetchPartners();
    } catch (err) {
      alert(err.response?.data?.error || 'حدث خطأ أثناء استعادة الشريك');
    }
  };

  const handleDelete = async (p) => {
    if (window.confirm(`هل أنت متأكد من حذف الشريك "${p.name}" نهائياً؟`)) {
      try {
        await api.delete(`/partners/${p.id}`);
        fetchPartners();
      } catch (err) {
        alert(err.response?.data?.error || 'لا يمكن حذف الشريك');
      }
    }
  };

  const totalPercentage = Number(summary.total_percentage) || 0;
  const isOver100 = totalPercentage > 100;
  const isUnder100 = totalPercentage < 100;
  const isExact100 = totalPercentage === 100;

  return (
    <div className="space-y-6 animate-fadeIn pb-10" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Percent size={26} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-800">إدارة الشراكة والشركاء</h1>
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                متابعة حصص الشركاء، مساهمات رأس المال، والمسحوبات والدفعات النقدية بدقة محاسبية
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/reports?tab=partners"
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <FileText size={18} />
            <span>تقرير المسحوبات والشراكة</span>
          </Link>

          <button
            onClick={() => {
              setSelectedPartnerForTx(null);
              setIsRecordTxOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <DollarSign size={18} />
            <span>تسجيل سحب / دفعة</span>
          </button>

          <button
            onClick={() => {
              setPartnerToEdit(null);
              setIsAddPartnerOpen(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm shadow-blue-500/20 transition-all"
          >
            <Plus size={18} />
            <span>إضافة شريك جديد</span>
          </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: عدد الشركاء */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl flex-shrink-0">
            <Users size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block">الشركاء النشطين</span>
            <span className="text-lg font-black text-gray-800">
              {summary.total_partners} <span className="text-xs font-normal text-gray-400">شريك</span>
            </span>
          </div>
        </div>

        {/* Card 2: إجمالي رأس مال الشركاء */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl flex-shrink-0">
            <TrendingUp size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block">إجمالي رأس المال</span>
            <span className="text-base font-black text-emerald-700" dir="ltr">
              {Number(summary.total_capital || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
            </span>
          </div>
        </div>

        {/* Card 3: إجمالي المسحوبات */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-600 rounded-xl flex-shrink-0">
            <TrendingDown size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block">إجمالي المسحوبات</span>
            <span className="text-base font-black text-red-700" dir="ltr">
              {Number(summary.total_withdrawals || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
            </span>
          </div>
        </div>

        {/* Card 4: إجمالي المسترد للخزينة */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl flex-shrink-0">
            <RotateCcw size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block">المسترد للخزينة</span>
            <span className="text-base font-black text-teal-700" dir="ltr">
              {Number(summary.total_returned || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
            </span>
          </div>
        </div>

        {/* Card 5: صافي المسحوبات */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl flex-shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block">صافي المسحوبات</span>
            <span className="text-base font-black text-amber-700" dir="ltr">
              {Number(summary.net_withdrawals || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
            </span>
          </div>
        </div>

        {/* Card 6: رأس المال المحفوظ */}
        <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl flex-shrink-0">
            <Wallet size={22} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-gray-400 block">رأس المال المحفوظ</span>
            <span className="text-base font-black text-emerald-800" dir="ltr">
              {Number(summary.total_capital || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
            </span>
            <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">ثابت لا يُخصم منه المسحوبات</span>
          </div>
        </div>
      </div>

      {/* Partnership Percentage Allocation Alert / Bar */}
      <div className={`p-4 rounded-2xl border shadow-sm transition-all ${
        isOver100
          ? 'bg-amber-50/80 border-amber-200'
          : isExact100
          ? 'bg-emerald-50/80 border-emerald-200'
          : 'bg-blue-50/80 border-blue-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {isOver100 ? (
              <ShieldAlert size={20} className="text-amber-600 flex-shrink-0" />
            ) : isExact100 ? (
              <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle size={20} className="text-blue-600 flex-shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-bold text-gray-800">
              توزيع الحصص الإجمالي بين الشركاء النشطين:
            </span>
          </div>
          <div className="text-sm sm:text-base font-black text-gray-900">
            {totalPercentage}% / 100%
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isOver100 ? 'bg-amber-500' : isExact100 ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(100, totalPercentage)}%` }}
          />
        </div>

        <div className="mt-2 text-xs">
          {isOver100 ? (
            <span className="text-amber-800 font-bold">
              تنبيه: مجموع نسب الشراكة يتجاوز 100% بنسبة ({Math.round((totalPercentage - 100) * 100) / 100}%). يرجى مراجعة نسب الشركاء.
            </span>
          ) : isExact100 ? (
            <span className="text-emerald-800 font-bold">
              مكتمل: تم توزيع كامل حصص الشراكة بنسبة 100% بدون أي فائض أو عجز.
            </span>
          ) : (
            <span className="text-blue-800 font-semibold">
              يوجد حصص متبقية غير موزعة بنسبة ({Math.round((100 - totalPercentage) * 100) / 100}%) لم يتم تخصيصها لشركاء بعد.
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'active' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            الشركاء النشطين ({summary.total_partners})
          </button>
          <button
            onClick={() => setStatusFilter('archived')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'archived' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            المؤرشفين ({summary.archived_partners})
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'all' ? 'bg-white text-blue-700 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            الكل
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="بحث باسم الشريك، رقم الهاتف أو الملاحظات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm font-medium transition-all"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        </div>
      </div>

      {/* Partners Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 font-bold text-sm">جاري تحميل بيانات الشركاء...</div>
        ) : partners.length === 0 ? (
          <div className="py-16 text-center text-gray-400 space-y-2">
            <Users size={36} className="mx-auto text-gray-300" />
            <p className="font-bold">لا يوجد شركاء مسجلين حالياً</p>
            <p className="text-xs">اضغط على زر "إضافة شريك جديد" لبدء تسجيل الشركاء ونسبهم.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-gray-100 text-gray-600 font-bold">
                <tr>
                  <th className="p-3.5 pr-5">اسم الشريك</th>
                  <th className="p-3.5 text-center">نسبة الشراكة</th>
                  <th className="p-3.5 text-center">رأس المال المساهم</th>
                  <th className="p-3.5 text-center">إجمالي السحوبات</th>
                  <th className="p-3.5 text-center">آخر سحب</th>
                  <th className="p-3.5 text-center">صافي المسحوبات المستحقة</th>
                  <th className="p-3.5 text-center">الملاحظات</th>
                  <th className="p-3.5 text-center">الحالة</th>
                  <th className="p-3.5 text-center pl-5">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partners.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* Name & Phone */}
                      <td className="p-3.5 pr-5">
                        <Link 
                          to={`/partners/${p.id}`}
                          className="font-bold text-blue-700 hover:text-blue-900 hover:underline block text-sm"
                        >
                          {p.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {p.phone && <span className="text-[11px] text-gray-400">{p.phone}</span>}
                          {p.notes && (
                            <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-medium truncate max-w-[160px]" title={p.notes}>
                              {p.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Share Percentage */}
                      <td className="p-3.5 text-center">
                        <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-black text-xs">
                          {p.share_percentage}%
                        </span>
                      </td>

                      {/* Capital Contribution */}
                      <td className="p-3.5 text-center font-bold text-emerald-700" dir="ltr">
                        {Number(p.total_capital || 0).toLocaleString()} ج.م
                      </td>

                      {/* Total Withdrawals */}
                      <td className="p-3.5 text-center" dir="ltr">
                        <div className="font-bold text-red-700">
                          {Number(p.total_withdrawals || 0).toLocaleString()} ج.م
                        </div>
                        <div className="text-[11px] text-gray-400 font-normal">
                          ({p.withdrawals_count || 0} عملية سحب)
                        </div>
                      </td>

                      {/* Last Withdrawal Date */}
                      <td className="p-3.5 text-center text-gray-500 font-medium" dir="ltr">
                        {p.last_withdrawal_date ? p.last_withdrawal_date.substring(0, 10) : '-'}
                      </td>

                      {/* Net Withdrawals Due */}
                      <td className="p-3.5 text-center font-black" dir="ltr">
                        <span className={Number(p.net_withdrawals || 0) > 0 ? 'text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200' : 'text-gray-400 font-semibold'}>
                          {Number(p.net_withdrawals || 0).toLocaleString()} ج.م
                        </span>
                      </td>

                      {/* Notes Column */}
                      <td className="p-3.5 text-center max-w-xs">
                        {p.notes ? (
                          <div className="px-2.5 py-1 bg-amber-50/80 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold inline-block text-right" title={p.notes}>
                            {p.notes}
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        {p.is_active ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                            نشط
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-[11px] font-bold">
                            مؤرشف
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 pl-5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View details page */}
                          <Link
                            to={`/partners/${p.id}`}
                            className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="تفاصيل الشريك والحركات"
                          >
                            <Eye size={16} />
                          </Link>

                          {/* Quick Statement */}
                          <button
                            onClick={() => handleOpenStatement(p)}
                            className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="كشف الحساب والطباعة"
                          >
                            <FileText size={16} />
                          </button>

                          {/* Add Transaction */}
                          {Boolean(p.is_active) && (
                            <button
                              onClick={() => handleOpenTransaction(p)}
                              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="تسجيل سحب / دفعة"
                            >
                              <Plus size={16} />
                            </button>
                          )}

                          {/* Edit Partner */}
                          <button
                            onClick={() => handleEditPartner(p)}
                            className="p-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            title="تعديل بيانات الشريك"
                          >
                            <Edit2 size={16} />
                          </button>

                          {/* Archive / Unarchive */}
                          {p.is_active ? (
                            <button
                              onClick={() => handleArchive(p)}
                              className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                              title="أرشفة الشريك"
                            >
                              <Archive size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnarchive(p)}
                              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="استعادة الشريك"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}

                          {/* Delete Partner */}
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="حذف الشريك (فقط إذا لم يكن لديه حركات)"
                          >
                            <Trash2 size={16} />
                          </button>
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

      {/* Modals */}
      <AddPartnerModal
        isOpen={isAddPartnerOpen}
        partnerToEdit={partnerToEdit}
        existingPartners={partners}
        onClose={() => {
          setIsAddPartnerOpen(false);
          setPartnerToEdit(null);
        }}
        onSuccess={fetchPartners}
      />

      <RecordPartnerTransactionModal
        isOpen={isRecordTxOpen}
        partner={selectedPartnerForTx}
        partnersList={partners}
        onClose={() => {
          setIsRecordTxOpen(false);
          setSelectedPartnerForTx(null);
        }}
        onSuccess={fetchPartners}
      />

      <PartnerStatementModal
        isOpen={isStatementOpen}
        partner={selectedPartnerForStatement}
        onClose={() => {
          setIsStatementOpen(false);
          setSelectedPartnerForStatement(null);
        }}
      />
    </div>
  );
}
