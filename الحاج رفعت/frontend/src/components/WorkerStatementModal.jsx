import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, User, Calendar, Wallet, CheckCircle2, FileText, Phone, MapPin, Briefcase } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import api from '../api';

export default function WorkerStatementModal({ isOpen, workerId, onClose }) {
  const { settings } = useSettings();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('all'); // all, this_month, prev_month, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const invoiceRef = useRef(null);

  useEffect(() => {
    if (isOpen && workerId) {
      fetchWorkerData();
    }
  }, [isOpen, workerId, filterPeriod]);

  const fetchWorkerData = async (customStart = startDate, customEnd = endDate) => {
    try {
      setLoading(true);
      let sDate = '';
      let eDate = '';
      const now = new Date();

      if (filterPeriod === 'this_month') {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        sDate = `${y}-${m}-01`;
        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
        eDate = `${y}-${m}-${lastDay}`;
      } else if (filterPeriod === 'prev_month') {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const y = prev.getFullYear();
        const m = String(prev.getMonth() + 1).padStart(2, '0');
        sDate = `${y}-${m}-01`;
        const lastDay = new Date(y, prev.getMonth() + 1, 0).getDate();
        eDate = `${y}-${m}-${lastDay}`;
      } else if (filterPeriod === 'custom') {
        sDate = customStart;
        eDate = customEnd;
      }

      let qParams = new URLSearchParams();
      if (sDate) qParams.append('startDate', sDate);
      if (eDate) qParams.append('endDate', eDate);

      const [wRes, sumRes, wdRes, attRes, leavesRes] = await Promise.all([
        api.get(`/workers?all=true`),
        api.get(`/workers/${workerId}/summary`),
        api.get(`/workers/${workerId}/withdrawals?${qParams.toString()}`),
        api.get(`/workers/${workerId}/attendance/advanced`),
        api.get(`/workers/${workerId}/leaves`)
      ]);

      const list = Array.isArray(wRes.data) ? wRes.data : (wRes.data?.items || []);
      const foundWorker = list.find(w => String(w?.id) === String(workerId));

      let withdrawalsList = Array.isArray(wdRes.data) ? wdRes.data : (wdRes.data?.items || []);
      let attendanceList = Array.isArray(attRes.data) ? attRes.data : (attRes.data?.items || []);
      let leavesList = Array.isArray(leavesRes.data) ? leavesRes.data : (leavesRes.data?.items || []);

      // Filter attendance and leaves by date if period selected
      if (sDate) {
        attendanceList = attendanceList.filter(a => a.date >= sDate);
        leavesList = leavesList.filter(l => l.start_date >= sDate);
      }
      if (eDate) {
        attendanceList = attendanceList.filter(a => a.date <= eDate);
        leavesList = leavesList.filter(l => l.start_date <= eDate);
      }

      setData({
        worker: foundWorker,
        summary: sumRes.data,
        withdrawals: withdrawalsList,
        attendance: attendanceList,
        leaves: leavesList,
        period: {
          sDate: sDate || '',
          eDate: eDate || ''
        }
      });
    } catch (err) {
      console.error('Error fetching worker statement data:', err);
      alert('تعذر تحميل بيانات كشف حساب العامل');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!invoiceRef.current) return;
    const printContent = invoiceRef.current.innerHTML;
    const printWindow = window.open('', '', 'width=950,height=750');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>ملف وكشف حساب العامل - ${data?.worker?.name || ''}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
          * { box-sizing: border-box; }
          body { 
            font-family: 'Cairo', sans-serif; 
            direction: rtl; 
            margin: 0; 
            padding: 15px; 
            color: #1e293b; 
            background: #fff;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          table { width: 100%; border-collapse: collapse; }
          .page-break { page-break-after: always; }
          .no-break { page-break-inside: avoid; }
        </style>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>
        ${printContent}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  if (!isOpen) return null;

  const worker = data?.worker || {};
  const financials = data?.summary?.financials || {};
  const opening_balance = data?.summary?.opening_balance;
  const withdrawals = data?.withdrawals || [];
  const attendance = data?.attendance || [];
  const leaves = data?.leaves || [];

  const totalWithdrawnInPeriod = withdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const monthlySalary = Number(worker.monthly_salary) || 0;
  
  const obAmount = opening_balance ? Number(opening_balance.amount) || 0 : 0;
  const obType = opening_balance ? opening_balance.balance_type : 'debit';
  const obSigned = obType === 'debit' ? -obAmount : obAmount;

  // Net due calculation
  const remainingSalary = monthlySalary + obSigned - totalWithdrawnInPeriod;

  // Attendance counts
  const presentDays = attendance.filter(a => a.status === 'حاضر').length;
  const absentDays = attendance.filter(a => a.status === 'غائب').length;
  const halfDays = attendance.filter(a => a.status === 'نصف يوم').length;
  const leaveDays = leaves.reduce((sum, l) => sum + (Number(l.days) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm" dir="rtl">
      <div className="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">
        
        {/* MODAL ACTIONS BAR */}
        <div className="p-4 bg-white border-b border-gray-200 flex flex-wrap justify-between items-center gap-3 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#1a2b4c] text-white rounded-xl">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1a2b4c]">كشف حساب وملف العامل: {worker.name}</h2>
              <span className="text-xs text-gray-500 font-bold">معاينة وتنسيق الطباعة الرسمي</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Buttons */}
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold text-gray-700">
              <button
                onClick={() => setFilterPeriod('all')}
                className={`px-3 py-1.5 rounded-lg transition ${filterPeriod === 'all' ? 'bg-[#1a2b4c] text-white shadow-sm' : 'hover:text-black'}`}
              >
                كل الفترات
              </button>
              <button
                onClick={() => setFilterPeriod('this_month')}
                className={`px-3 py-1.5 rounded-lg transition ${filterPeriod === 'this_month' ? 'bg-[#1a2b4c] text-white shadow-sm' : 'hover:text-black'}`}
              >
                هذا الشهر
              </button>
              <button
                onClick={() => setFilterPeriod('prev_month')}
                className={`px-3 py-1.5 rounded-lg transition ${filterPeriod === 'prev_month' ? 'bg-[#1a2b4c] text-white shadow-sm' : 'hover:text-black'}`}
              >
                الشهر السابق
              </button>
              <button
                onClick={() => setFilterPeriod('custom')}
                className={`px-3 py-1.5 rounded-lg transition ${filterPeriod === 'custom' ? 'bg-[#1a2b4c] text-white shadow-sm' : 'hover:text-black'}`}
              >
                فترة مخصصة
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-[#1a2b4c] hover:bg-blue-950 text-white rounded-xl font-black text-sm transition shadow-sm"
            >
              <Printer size={18} />
              <span>طباعة الملف الآن</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* CUSTOM DATE RANGE BAR */}
        {filterPeriod === 'custom' && (
          <div className="bg-white border-b border-gray-100 p-3 flex flex-wrap items-center gap-3 text-xs font-bold">
            <span className="text-gray-500">الفترة المحددة:</span>
            <div className="flex items-center gap-1">
              <span>من:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border rounded-lg p-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              <span>إلى:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border rounded-lg p-1 text-xs"
              />
            </div>
            <button
              onClick={() => fetchWorkerData(startDate, endDate)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition"
            >
              تطبيق
            </button>
          </div>
        )}

        {/* PRINTABLE PREVIEW CONTENT */}
        <div className="overflow-y-auto p-4 md:p-8 flex-1 bg-gray-100 flex justify-center">
          
          {loading ? (
            <div className="bg-white p-12 rounded-2xl shadow-sm font-bold text-lg text-center text-gray-600 my-auto">
              جاري تجهيز كشف حساب وبيانات العامل...
            </div>
          ) : (
            <div
              ref={invoiceRef}
              className="bg-white w-full max-w-[210mm] min-h-[297mm] rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between"
              style={{ position: 'relative' }}
            >
              {/* Top Accent Stripe */}
              <div className="h-3 w-full bg-[#1a2b4c]"></div>

              <div className="p-8 space-y-6">
                
                {/* 1. OFFICIAL COMPANY HEADER */}
                <div className="flex justify-between items-center border-b-2 border-gray-200 pb-6 relative">
                  
                  {/* Right: Contact Info Box */}
                  <div className="bg-[#f4f7fb] border-r-4 border-[#1a2b4c] rounded-l-2xl p-4 w-[240px] text-[#1a2b4c]">
                    <h4 className="text-center font-black text-sm mb-2 border-b border-gray-200 pb-1">للتواصل والاستفسار</h4>
                    <div className="space-y-2 font-bold text-xs">
                      {settings.company_phone1 && (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="text-right">
                            <div className="text-[10px] text-gray-500">{settings.company_phone1_label || 'الإدارة'}</div>
                            <div dir="ltr">{settings.company_phone1}</div>
                          </div>
                          <div className="bg-[#1a2b4c] text-white p-1 rounded-full"><Phone size={12} /></div>
                        </div>
                      )}
                      {settings.company_phone2 && (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="text-right">
                            <div className="text-[10px] text-gray-500">{settings.company_phone2_label || 'الحسابات'}</div>
                            <div dir="ltr">{settings.company_phone2}</div>
                          </div>
                          <div className="bg-[#1a2b4c] text-white p-1 rounded-full"><Phone size={12} /></div>
                        </div>
                      )}
                      {settings.company_address && (
                        <div className="flex items-center gap-2 justify-end">
                          <div className="text-right text-[11px]">{settings.company_address}</div>
                          <div className="bg-[#1a2b4c] text-white p-1 rounded-full"><MapPin size={12} /></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center: Title & Company Name */}
                  <div className="text-center">
                    <h1 className="text-2xl sm:text-3xl font-black text-[#1a2b4c] mb-1">
                      {settings.company_name || 'مجموعة الحاج رفعت'}
                    </h1>
                    {settings.company_tagline && (
                      <p className="text-gray-500 font-bold text-xs mb-3">{settings.company_tagline}</p>
                    )}
                    <div className="inline-block bg-[#1a2b4c] text-white px-5 py-1.5 rounded-full font-black text-sm tracking-wide shadow-sm">
                      كشف حساب وملف العامل الشامل
                    </div>
                  </div>

                  {/* Left: Logo */}
                  {settings.invoice_show_logo !== 'false' && settings.invoice_show_logo !== false && (
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#1a2b4c] p-1 overflow-hidden shadow-md bg-white">
                      <img
                        src={settings.company_logo || '/logo.jpg'}
                        alt="Logo"
                        className="w-full h-full object-contain rounded-full"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                </div>

                {/* 2. WORKER PROFILE & REPORT INFO */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#f8f9fc] p-4 rounded-2xl border border-gray-200">
                  <div>
                    <span className="text-xs text-gray-400 font-bold block mb-0.5">اسم العامل:</span>
                    <span className="text-lg font-black text-[#1a2b4c]">{worker.name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-bold block mb-0.5">الوظيفة / المهنة:</span>
                    <span className="text-sm font-black text-gray-800">{worker.job_title || 'عامل'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-bold block mb-0.5">رقم الهاتف:</span>
                    <span className="text-sm font-bold text-gray-700" dir="ltr">{worker.phone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-bold block mb-0.5">تاريخ الطباعة:</span>
                    <span className="text-sm font-bold text-gray-700">{new Date().toLocaleDateString('ar-EG')}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-bold block mb-0.5">الراتب الشهري الأساسي:</span>
                    <span className="text-sm font-black text-blue-700" dir="ltr">{monthlySalary.toLocaleString()} ج.م</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-bold block mb-0.5">حالة العمل:</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 inline-block">
                      {worker.status === 'active' ? 'على رأس العمل (نشط)' : 'غير نشط'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 font-bold block mb-0.5">فترة التقرير:</span>
                    <span className="text-xs font-bold text-gray-700">
                      {data?.period?.sDate && data?.period?.eDate
                        ? `من ${data.period.sDate} إلى ${data.period.eDate}`
                        : 'كامل الحركات والمسحوبات المسجلة'}
                    </span>
                  </div>
                </div>

                {/* 3. FINANCIAL SUMMARY BOX */}
                <div className="rounded-2xl border-2 border-gray-200 overflow-hidden shadow-sm">
                  <div className="bg-[#1a2b4c] text-white p-3 font-black text-center text-sm flex items-center justify-center gap-2">
                    <Wallet size={16} />
                    <span>ملخص المستحقات والمسحوبات وصافي الرصيد</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-gray-200 bg-white">
                    {/* Salary */}
                    <div className="p-4 text-center">
                      <span className="text-xs font-bold text-gray-500 block mb-1">الراتب الأساسي</span>
                      <span className="text-xl font-black text-blue-900" dir="ltr">
                        + {monthlySalary.toLocaleString()} ج.م
                      </span>
                    </div>

                    {/* Opening Balance */}
                    <div className="p-4 text-center bg-indigo-50/40">
                      <span className="text-xs font-bold text-indigo-900 block mb-1">الرصيد الافتتاحي (سابق)</span>
                      <span className={`text-xl font-black ${obType === 'debit' ? 'text-amber-700' : 'text-emerald-700'}`} dir="ltr">
                        {obAmount > 0 ? `${obType === 'debit' ? '-' : '+'} ${obAmount.toLocaleString()} ج.م` : '0 ج.م'}
                      </span>
                      <span className="text-[11px] font-bold text-gray-500 block mt-0.5">
                        {obAmount > 0 ? (obType === 'debit' ? '(سلفة عليه)' : '(مستحق له)') : 'متوازن'}
                      </span>
                    </div>

                    {/* Total Withdrawn */}
                    <div className="p-4 text-center bg-rose-50/40">
                      <span className="text-xs font-bold text-rose-900 block mb-1">إجمالي المسحوبات والسلف</span>
                      <span className="text-xl font-black text-rose-600" dir="ltr">
                        - {totalWithdrawnInPeriod.toLocaleString()} ج.م
                      </span>
                      <span className="text-[11px] font-bold text-gray-500 block mt-0.5">
                        {withdrawals.length} حركة سحب
                      </span>
                    </div>
                  </div>

                  {/* NET RESULT BANNER */}
                  <div className="p-4 bg-[#f8f9fc] border-t-2 border-gray-200 flex justify-between items-center px-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={22} className={remainingSalary >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
                      <span className="text-base font-black text-[#1a2b4c]">
                        {remainingSalary >= 0 ? 'صافي المبلغ المستحق للعامل (له):' : 'المتبقي على العامل ذمة سلف (عليه):'}
                      </span>
                    </div>
                    <span className={`text-2xl font-black ${remainingSalary >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} dir="ltr">
                      {Math.abs(remainingSalary).toLocaleString()} ج.م
                    </span>
                  </div>
                </div>

                {/* 4. ATTENDANCE & LEAVES SUMMARY STATS */}
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                    <span className="text-[11px] font-bold text-emerald-800 block">أيام الحضور</span>
                    <span className="text-lg font-black text-emerald-700">{presentDays} يوم</span>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                    <span className="text-[11px] font-bold text-rose-800 block">أيام الغياب</span>
                    <span className="text-lg font-black text-rose-700">{absentDays} يوم</span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                    <span className="text-[11px] font-bold text-amber-800 block">أنصاف أيام</span>
                    <span className="text-lg font-black text-amber-700">{halfDays} يوم</span>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 p-2.5 rounded-xl">
                    <span className="text-[11px] font-bold text-purple-800 block">أيام الإجازات</span>
                    <span className="text-lg font-black text-purple-700">{leaveDays} يوم</span>
                  </div>
                </div>

                {/* 5. DETAILED WITHDRAWALS TABLE */}
                <div className="no-break space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <h3 className="font-black text-sm text-[#1a2b4c] flex items-center gap-1.5">
                      <Wallet size={16} />
                      <span>بيان المسحوبات المالية والسلف بالتفصيل</span>
                    </h3>
                    <span className="text-xs text-gray-500 font-bold">
                      الإجمالي: {totalWithdrawnInPeriod.toLocaleString()} ج.م
                    </span>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-[#1a2b4c] text-white font-bold">
                        <tr>
                          <th className="p-2.5 text-center w-10">م</th>
                          <th className="p-2.5 w-28">تاريخ السحب</th>
                          <th className="p-2.5 w-28">نوع السحب</th>
                          <th className="p-2.5 w-28 text-center">المبلغ</th>
                          <th className="p-2.5">البيان والملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {withdrawals.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-4 text-center text-gray-400 font-bold">
                              لا توجد مسحوبات مالية مسجلة لهذا العامل في هذه الفترة
                            </td>
                          </tr>
                        ) : (
                          withdrawals.map((w, index) => (
                            <tr key={w.id || index} className="hover:bg-gray-50">
                              <td className="p-2 text-center text-gray-400 font-bold">{index + 1}</td>
                              <td className="p-2 font-semibold text-gray-700">
                                {w.withdrawal_date ? new Date(w.withdrawal_date).toLocaleDateString('ar-EG') : '-'}
                              </td>
                              <td className="p-2 font-bold text-gray-800">{w.withdrawal_type || 'سلفة'}</td>
                              <td className="p-2 text-center font-black text-rose-600" dir="ltr">
                                {Number(w.amount || 0).toLocaleString()} ج.م
                              </td>
                              <td className="p-2 text-gray-600">{w.description || '-'}</td>
                            </tr>
                          ))
                        )}
                        {withdrawals.length > 0 && (
                          <tr className="bg-gray-100 font-black text-[#1a2b4c]">
                            <td colSpan="3" className="p-2.5 text-right">إجمالي المسحوبات</td>
                            <td className="p-2.5 text-center text-rose-700" dir="ltr">
                              {totalWithdrawnInPeriod.toLocaleString()} ج.م
                            </td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 6. GENERAL WORKER NOTES */}
                {worker.notes && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                    <span className="font-bold text-gray-500 block mb-0.5">ملاحظات عامة:</span>
                    <p className="text-gray-800 font-medium">{worker.notes}</p>
                  </div>
                )}

                {/* 7. OFFICIAL SIGNATURES BOX */}
                <div className="no-break pt-4 border-t-2 border-gray-200">
                  <div className="grid grid-cols-3 gap-6 text-center text-xs">
                    
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between h-28">
                      <div>
                        <span className="font-black text-[#1a2b4c] block mb-1">توقيع العامل / المستلم</span>
                        <span className="text-[10px] text-gray-400 font-bold">أقر بصحة البيانات واستلام مستحقاتي</span>
                      </div>
                      <div className="border-b-2 border-dashed border-gray-400 w-3/4 mx-auto mb-1"></div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between h-28">
                      <div>
                        <span className="font-black text-[#1a2b4c] block mb-1">المحاسب المسؤول</span>
                        <span className="text-[10px] text-gray-400 font-bold">مراجعة وتدقيق الحسابات</span>
                      </div>
                      <div className="border-b-2 border-dashed border-gray-400 w-3/4 mx-auto mb-1"></div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between h-28">
                      <div>
                        <span className="font-black text-[#1a2b4c] block mb-1">اعتماد الإدارة / الختم</span>
                        <span className="text-[10px] text-gray-400 font-bold">المدير العام</span>
                      </div>
                      <div className="border-b-2 border-dashed border-gray-400 w-3/4 mx-auto mb-1"></div>
                    </div>

                  </div>
                </div>

              </div>

              {/* Bottom Accent Stripe */}
              <div className="h-3 w-full bg-[#1a2b4c]"></div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
