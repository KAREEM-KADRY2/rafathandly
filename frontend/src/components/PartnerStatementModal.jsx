import React, { useState, useEffect } from 'react';
import { X, Printer, Download, FileSpreadsheet, Calendar, Filter } from 'lucide-react';
import api from '../api';

export default function PartnerStatementModal({ isOpen, partner, onClose }) {
  const [statementData, setStatementData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!isOpen || !partner) return;

    fetchStatement();
  }, [isOpen, partner, filterType]);

  const fetchStatement = async (customStart = startDate, customEnd = endDate) => {
    setLoading(true);
    try {
      let sDate = '';
      let eDate = '';
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

      if (filterType === 'today') {
        sDate = todayStr;
        eDate = todayStr;
      } else if (filterType === 'week') {
        const d = new Date(now);
        const diff = d.getDate() - 6;
        const startOfWeek = new Date(d.setDate(diff));
        sDate = startOfWeek.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
        eDate = todayStr;
      } else if (filterType === 'month') {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        sDate = `${y}-${m}-01`;
        eDate = todayStr;
      } else if (filterType === 'year') {
        const y = now.getFullYear();
        sDate = `${y}-01-01`;
        eDate = todayStr;
      } else if (filterType === 'custom') {
        sDate = customStart;
        eDate = customEnd;
      }

      const params = {};
      if (sDate) params.startDate = sDate;
      if (eDate) params.endDate = eDate;

      const res = await api.get(`/partners/${partner.id}/statement`, { params });
      setStatementData(res.data);
    } catch (err) {
      console.error('Error fetching statement:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !partner) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const sDate = statementData?.statementPeriod?.startDate || '';
    const eDate = statementData?.statementPeriod?.endDate || '';
    let url = `/api/partners/${partner.id}/statement/pdf`;
    if (sDate || eDate) {
      url += `?startDate=${sDate}&endDate=${eDate}`;
    }
    window.open(url, '_blank');
  };

  const handleDownloadExcel = () => {
    const sDate = statementData?.statementPeriod?.startDate || '';
    const eDate = statementData?.statementPeriod?.endDate || '';
    let url = `/api/partners/${partner.id}/statement/excel`;
    if (sDate || eDate) {
      url += `?startDate=${sDate}&endDate=${eDate}`;
    }
    window.open(url, '_blank');
  };

  const rows = statementData?.rows || [];
  const summary = statementData?.summary || {};
  const openingBalance = statementData?.opening_balance || 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Top Bar */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-4 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <Printer size={20} className="text-blue-400" />
            <h2 className="text-base sm:text-lg font-bold">
              كشف حساب الشريك: {partner.name} (نسبة الشراكة: {partner.share_percentage}%)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="bg-slate-50 border-b border-gray-200 p-4 space-y-3 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Period Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-200/80 p-1 rounded-xl text-xs font-semibold">
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

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Printer size={15} />
                <span>طباعة</span>
              </button>
              <button
                onClick={handleDownloadPDF}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download size={15} />
                <span>تحميل PDF</span>
              </button>
              <button
                onClick={handleDownloadExcel}
                className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <FileSpreadsheet size={15} />
                <span>تصدير Excel</span>
              </button>
            </div>
          </div>

          {/* Custom Date Pickers */}
          {filterType === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span>من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="p-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span>إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="p-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                />
              </div>
              <button
                onClick={() => fetchStatement(startDate, endDate)}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-bold transition-colors"
              >
                تطبيق البحث
              </button>
            </div>
          )}
        </div>

        {/* Printable Statement View */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 printable-area bg-white">
          {/* Statement Header */}
          <div className="border-b-2 border-blue-600 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-extrabold text-blue-900">كشف حساب الشريك</h1>
                <p className="text-gray-500 font-medium text-xs mt-0.5">نظام إدارة مجموعة الحاج رفعت / هنداكوتي جروب</p>
              </div>
              <div className="text-left text-xs text-gray-500">
                <div>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</div>
                <div className="font-semibold text-blue-800">
                  الفترة: {statementData?.statementPeriod?.startDate || 'البداية'} إلى {statementData?.statementPeriod?.endDate || 'اليوم'}
                </div>
              </div>
            </div>

            {/* Partner Info Details Box */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-gray-500 block">اسم الشريك:</span>
                <span className="font-bold text-gray-800 text-sm">{partner.name}</span>
              </div>
              <div>
                <span className="text-gray-500 block">نسبة الشراكة:</span>
                <span className="font-bold text-blue-700 text-sm">{partner.share_percentage}%</span>
              </div>
              <div>
                <span className="text-gray-500 block">رأس المال المسجل:</span>
                <span className="font-bold text-gray-800 text-sm">{Number(partner.capital_contribution || 0).toLocaleString()} ج.م</span>
              </div>
              <div>
                <span className="text-gray-500 block">رقم الهاتف:</span>
                <span className="font-bold text-gray-800 text-sm">{partner.phone || '-'}</span>
              </div>
              {partner.notes && (
                <div className="col-span-2 sm:col-span-4 mt-1 pt-2 border-t border-slate-200">
                  <span className="text-gray-500 font-bold ml-1">الملاحظات:</span>
                  <span className="text-amber-900 font-semibold">{partner.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Opening Balance Banner */}
          <div className="flex justify-between items-center bg-blue-50/70 px-4 py-2.5 rounded-xl border border-blue-200 text-xs font-bold text-blue-900">
            <span>رأس المال المساهم (ثابت ولا يُخصم منه المسحوبات):</span>
            <span dir="ltr" className="text-sm font-extrabold text-blue-800">{Number(partner.capital_contribution || summary.intact_capital || summary.closing_balance || 0).toLocaleString()} ج.م</span>
          </div>

          {/* Statement Table */}
          {loading ? (
            <div className="py-12 text-center text-gray-400 font-bold">جاري تحميل كشف الحساب...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-blue-600 text-white font-bold">
                    <th className="p-2.5 border border-blue-700 text-center w-24">التاريخ</th>
                    <th className="p-2.5 border border-blue-700 text-center w-36">نوع الحركة</th>
                    <th className="p-2.5 border border-blue-700 text-right">البيان والتفاصيل</th>
                    <th className="p-2.5 border border-blue-700 text-center w-28">المبلغ</th>
                    <th className="p-2.5 border border-blue-700 text-center w-32">طريقة الدفع</th>
                    <th className="p-2.5 border border-blue-700 text-center w-32">رصيد المسحوبات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-400 font-medium">
                        لا توجد حركات مسجلة خلال الفترة المحددة.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => {
                      const isAddition = row.transaction_type === 'capital_contribution' || row.transaction_type === 'withdrawal_return';
                      return (
                        <tr key={row.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="p-2.5 border border-gray-200 text-center font-medium" dir="ltr">
                            {row.transaction_date ? row.transaction_date.substring(0, 10) : '-'}
                          </td>
                          <td className="p-2.5 border border-gray-200 text-center">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isAddition ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {row.type_label}
                            </span>
                          </td>
                          <td className="p-2.5 border border-gray-200 text-gray-700">
                            <div>{row.description || '-'}</div>
                            {row.notes && (
                              <div className="text-[10px] text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium inline-block mt-0.5">
                                ملاحظة: {row.notes}
                              </div>
                            )}
                            {row.reference && <div className="text-[10px] text-gray-400 mt-0.5">مرجع: {row.reference}</div>}
                          </td>
                          <td className="p-2.5 border border-gray-200 text-center font-extrabold" dir="ltr">
                            <span className={isAddition ? 'text-emerald-700' : 'text-red-700'}>
                              {isAddition ? '+' : '-'}{Number(row.amount).toLocaleString()}
                            </span>
                          </td>
                          <td className="p-2.5 border border-gray-200 text-center text-gray-600">
                            <div>{row.payment_method || 'نقدي'}</div>
                            {row.account_name && <div className="text-[10px] text-blue-600 font-semibold">{row.account_name}</div>}
                          </td>
                          <td className="p-2.5 border border-gray-200 text-center font-extrabold text-slate-900" dir="ltr">
                            {Number(row.running_balance).toLocaleString()} ج.م
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Statement Summary Card */}
          <div className="bg-slate-100 p-4 rounded-2xl border border-slate-300 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div>
              <div className="text-gray-500 text-xs font-semibold">مساهمات رأس المال</div>
              <div className="text-sm font-extrabold text-emerald-700 mt-1">
                {Number(summary.total_capital_contributions || 0).toLocaleString()} ج.م
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs font-semibold">إجمالي المسحوبات</div>
              <div className="text-sm font-extrabold text-red-700 mt-1">
                {Number(summary.total_withdrawals || 0).toLocaleString()} ج.م
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs font-semibold">المسترد للخزينة</div>
              <div className="text-sm font-extrabold text-teal-700 mt-1">
                {Number(summary.total_returned || 0).toLocaleString()} ج.م
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs font-semibold">صافي المسحوبات</div>
              <div className="text-sm font-extrabold text-amber-700 mt-1">
                {Number(summary.net_withdrawals || 0).toLocaleString()} ج.م
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs font-semibold">رأس المال المحفوظ</div>
              <div className="text-base font-black text-blue-800 mt-1">
                {Number(summary.intact_capital || partner.capital_contribution || summary.closing_balance || 0).toLocaleString()} ج.م
              </div>
              <div className="text-[10px] text-emerald-600 font-bold mt-0.5">ثابت لا يُمس</div>
            </div>
          </div>

          {/* Stamp / Signature Area */}
          <div className="pt-6 hidden print:grid grid-cols-2 text-center text-xs text-gray-600">
            <div>
              <div className="font-bold">توقيع الشريك</div>
              <div className="mt-12 border-t border-dashed border-gray-400 w-36 mx-auto"></div>
            </div>
            <div>
              <div className="font-bold">إدارة الحسابات والمالية</div>
              <div className="mt-12 border-t border-dashed border-gray-400 w-36 mx-auto"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
