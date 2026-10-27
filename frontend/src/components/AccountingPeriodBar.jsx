import React, { useState } from 'react';
import { 
  Calendar, ChevronLeft, ChevronRight, Globe, Plus, Lock, Unlock, 
  X, AlertTriangle, CheckCircle, ShieldAlert
} from 'lucide-react';
import { usePeriod } from '../context/PeriodContext';

export default function AccountingPeriodBar() {
  const { 
    periods, 
    activePeriod, 
    selectedPeriodId, 
    setSelectedPeriodId, 
    selectedPeriod, 
    isSelectedPeriodClosed,
    startNewPeriod,
    closePeriod,
    reopenPeriod 
  } = usePeriod();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Form states for New Period
  const defaultNextMonthName = `فترة ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`;
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Calculate default dates for next month
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const defaultStartDate = nextMonth.toISOString().split('T')[0];
  const defaultEndDate = nextMonthLastDay.toISOString().split('T')[0];

  const [name, setName] = useState(defaultNextMonthName);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reopen password state
  const [reopenPassword, setReopenPassword] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Chronological navigation
  const currentIndex = selectedPeriodId === 'all' 
    ? -1 
    : periods.findIndex(p => p.id.toString() === selectedPeriodId.toString());

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < periods.length - 1;

  const handlePrev = () => {
    if (selectedPeriodId === 'all') {
      if (periods.length > 0) {
        setSelectedPeriodId(periods[periods.length - 1].id.toString());
      }
    } else if (hasPrevious) {
      setSelectedPeriodId(periods[currentIndex - 1].id.toString());
    }
  };

  const handleNext = () => {
    if (selectedPeriodId === 'all') {
      if (periods.length > 0) {
        setSelectedPeriodId(periods[0].id.toString());
      }
    } else if (hasNext) {
      setSelectedPeriodId(periods[currentIndex + 1].id.toString());
    }
  };

  const handleCreateNewPeriod = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('يرجى كتابة اسم الفترة المحاسبية');
      return;
    }
    try {
      setLoading(true);
      const res = await startNewPeriod(name.trim(), startDate, endDate, notes);
      setIsNewModalOpen(false);
      setName(defaultNextMonthName);
      setNotes('');
      showToast(res.message || 'تم إنشاء الفترة المحاسبية الجديدة بنجاح');
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء إنشاء الفترة الجديدة');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmClosePeriod = async () => {
    if (!selectedPeriod) return;
    try {
      setLoading(true);
      const res = await closePeriod(selectedPeriod.id);
      setIsCloseModalOpen(false);
      showToast(res.message || 'تم إغلاق الفترة المحاسبية بنجاح');
    } catch (err) {
      alert(err.response?.data?.error || 'حدث خطأ أثناء إغلاق الفترة');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReopenPeriod = async (e) => {
    e.preventDefault();
    if (!selectedPeriod) return;
    try {
      setLoading(true);
      const res = await reopenPeriod(selectedPeriod.id, reopenPassword);
      setIsReopenModalOpen(false);
      setReopenPassword('');
      showToast(res.message || 'تم إعادة فتح الفترة المحاسبية بنجاح');
    } catch (err) {
      alert(err.response?.data?.error || 'كلمة المرور غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  // Determine current display label and status
  const isAllMode = selectedPeriodId === 'all';
  const displayPeriodName = isAllMode 
    ? 'كل الفترات المحاسبية' 
    : (selectedPeriod ? selectedPeriod.name : 'الفترة الحالية');

  const periodStatus = selectedPeriod ? selectedPeriod.status : (activePeriod ? activePeriod.status : 'OPEN');

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 mr-auto" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-md animate-fade-in flex items-center gap-1.5">
          <CheckCircle size={14} />
          {toastMessage}
        </div>
      )}

      {/* Main Horizontal Period Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl text-xs font-bold shadow-sm">
        
        {/* Title / Label */}
        <div className="flex items-center gap-1 text-slate-600 px-1 border-l border-slate-200 pl-2 hidden lg:flex">
          <Calendar size={15} className="text-blue-600" />
          <span>الفترة الحالية:</span>
        </div>

        {/* Previous Arrow Button */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={!hasPrevious && !isAllMode}
          className="p-1 rounded-lg hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="الفترة السابقة"
        >
          <ChevronRight size={18} />
        </button>

        {/* Selected Period Name & Status Badge */}
        <div className="flex items-center gap-2 px-2 py-0.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <span className="font-extrabold text-slate-800 text-xs sm:text-sm max-w-[150px] sm:max-w-[200px] truncate">
            {displayPeriodName}
          </span>

          {!isAllMode && (
            periodStatus === 'OPEN' ? (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                مفتوحة
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
                <Lock size={12} className="text-amber-700" />
                مغلقة
              </span>
            )
          )}

          {isAllMode && (
            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md text-[11px] font-bold">
              <Globe size={12} />
              شامل
            </span>
          )}
        </div>

        {/* Next Arrow Button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={!hasNext && !isAllMode}
          className="p-1 rounded-lg hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="الفترة التالية"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Action Button: All Periods */}
        <button
          type="button"
          onClick={() => setSelectedPeriodId('all')}
          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all text-xs border ${
            isAllMode 
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
          title="عرض بيانات كافة الفترات المحاسبية"
        >
          <Globe size={13} />
          <span>كل الفترات</span>
        </button>

        {/* Action Button: Close / Reopen Period */}
        {!isAllMode && selectedPeriod && (
          selectedPeriod.status === 'OPEN' ? (
            <button
              type="button"
              onClick={() => setIsCloseModalOpen(true)}
              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold flex items-center gap-1 transition-all text-xs"
              title="إغلاق هذه الفترة المحاسبية"
            >
              <Lock size={13} />
              <span className="hidden md:inline">إغلاق الفترة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsReopenModalOpen(true)}
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-bold flex items-center gap-1 transition-all text-xs"
              title="إعادة فتح هذه الفترة"
            >
              <Unlock size={13} />
              <span className="hidden md:inline">إعادة فتح</span>
            </button>
          )
        )}

        {/* Action Button: New Period */}
        <button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all shadow-sm text-xs"
          title="إنشاء فترة محاسبية جديدة"
        >
          <Plus size={14} />
          <span>فترة جديدة</span>
        </button>
      </div>

      {/* 1. Modal: Create New Period */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Calendar size={20} />
                </div>
                <h3 className="text-lg font-bold text-gray-800">إنشاء فترة محاسبية جديدة</h3>
              </div>
              <button 
                onClick={() => setIsNewModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateNewPeriod} className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <AlertTriangle size={14} className="text-amber-700" /> تنبيه هـام:
                </p>
                <p>
                  سيتم بدء الفترة المحاسبية الجديدة وحفظ كافة البيانات السابقة إطلاقاً دائم بدون أي حذف.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">اسم الفترة المحاسبية</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: نوفمبر 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">من تاريخ</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">إلى تاريخ</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows="2"
                  placeholder="أدخل أي ملاحظات إضافية عن الفترة"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-xs"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {loading ? 'جاري الإنشاء...' : <><Plus size={16} /> إنشاء الفترة</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Close Period Confirmation */}
      {isCloseModalOpen && selectedPeriod && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-amber-50">
              <div className="flex items-center gap-2 text-amber-900">
                <Lock size={20} className="text-amber-700" />
                <h3 className="text-lg font-bold">إغلاق الفترة المحاسبية</h3>
              </div>
              <button 
                onClick={() => setIsCloseModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-right">
              <p className="text-sm font-bold text-gray-800">
                هل أنت متأكد من إغلاق فترة <span className="text-amber-800 font-extrabold">"{selectedPeriod.name}"</span>؟
              </p>
              
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1 text-amber-800">
                  <ShieldAlert size={14} /> ملاحظة هامة:
                </p>
                <p>
                  إغلاق الفترة يقفل المعاملات المالية لهذه الفترة لحمايتها من التعديل العفوي، <strong>ولن يؤدي إطلاقاً إلى حذف أو تغيير أي سجلات سابقة</strong>.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClosePeriod}
                  disabled={loading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {loading ? 'جاري الإغلاق...' : <><Lock size={14} /> تأكيد إغلاق الفترة</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Reopen Period */}
      {isReopenModalOpen && selectedPeriod && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-blue-50">
              <div className="flex items-center gap-2 text-blue-900">
                <Unlock size={20} className="text-blue-700" />
                <h3 className="text-lg font-bold">إعادة فتح الفترة المحاسبية</h3>
              </div>
              <button 
                onClick={() => setIsReopenModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmReopenPeriod} className="p-6 space-y-4 text-right">
              <p className="text-sm font-bold text-gray-800">
                إعادة فتح فترة <span className="text-blue-800 font-extrabold">"{selectedPeriod.name}"</span>
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">أدخل كلمة المرور التأكيدية</label>
                <input
                  type="password"
                  required
                  value={reopenPassword}
                  onChange={e => setReopenPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsReopenModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {loading ? 'جاري الفتح...' : <><Unlock size={14} /> تأكيد إعادة الفتح</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
