import React, { useState } from 'react';
import { X, Calendar, Lock, AlertTriangle, PlusCircle } from 'lucide-react';
import { usePeriod } from '../context/PeriodContext';

export default function StartPeriodModal({ isOpen, onClose, onSuccess }) {
  const { startNewPeriod, activePeriod } = usePeriod();

  const defaultNextMonthName = `فترة ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`;
  
  const [name, setName] = useState(defaultNextMonthName);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setName(defaultNextMonthName);
    setNotes('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('يرجى تحديد اسم الفترة الجديدة');
      return;
    }

    setLoading(true);
    try {
      const res = await startNewPeriod(name.trim(), '', notes);
      handleClose();
      if (onSuccess) onSuccess(res.message || 'تم بدء الفترة المالية الجديدة بنجاح');
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء بدء الفترة الجديدة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Calendar size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">بدء فترة مالية جديدة</h2>
          </div>
          <button 
            type="button" 
            onClick={handleClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-bold space-y-1">
            <p className="flex items-center gap-1.5 text-amber-800 font-black text-sm">
              <AlertTriangle size={16} /> تنبيه هام:
            </p>
            <p>
              سيتم إغلاق الفترة الحالية ({activePeriod?.name || 'الفترة المفتوحة'}) وبدء فترة جديدة.
              <strong> لن يتم حذف أي بيانات سابقة إطلاقاً</strong>، وسيمكنك الوصول لكافة السجلات والتقارير للفترات السابقة من محدد الفترات بأعلى الشاشة.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">اسم الفترة الجديدة</label>
            <input 
              type="text" 
              required
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-800"
              placeholder="مثال: فترة نوفمبر 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>



          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات / وصف الفترة (اختياري)</label>
            <textarea 
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-gray-800"
              rows="2"
              placeholder="أدخل أي ملاحظات خاصة بهذه الفترة المالية"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
            <button 
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
            >
              إلغاء
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'جاري البدء...' : <><PlusCircle size={18} /> تأكيد وبدء الفترة الجديدة</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
