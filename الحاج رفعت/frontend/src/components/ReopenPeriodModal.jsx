import React, { useState } from 'react';
import { X, Lock, RefreshCw, AlertTriangle } from 'lucide-react';
import { usePeriod } from '../context/PeriodContext';

export default function ReopenPeriodModal({ isOpen, onClose, period, onSuccess }) {
  const { reopenPeriod } = usePeriod();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !period) return null;

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('يرجى إدخال كلمة المرور لتأكيد الصلاحية');
      return;
    }

    setLoading(true);
    try {
      const res = await reopenPeriod(period.id, password);
      handleClose();
      if (onSuccess) onSuccess(res.message || 'تم إعادة فتح الفترة المالية بنجاح');
    } catch (err) {
      setError(err.response?.data?.error || 'كلمة المرور غير صحيحة أو حدث خطأ أثناء إعادة الفتح');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <RefreshCw size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">إعادة فتح فترة مالية مغلقة</h2>
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
              <AlertTriangle size={16} /> تنبيه صلاحيات:
            </p>
            <p>
              أنت على وشك إعادة فتح الفترة ({period.name}). تتطلب هذه العملية صراحة إدخال كلمة مرور مسؤول النظام.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">كلمة مرور المسؤول (Admin Password)</label>
            <div className="relative">
              <input 
                type="password"
                required
                autoFocus
                className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-bold text-gray-800"
                placeholder="أدخل كلمة المرور لتأكيد الصلاحية"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Lock className="absolute right-3 top-3 text-gray-400" size={18} />
            </div>
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
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'جاري الفتح...' : <><RefreshCw size={18} /> تأكيد وإعادة الفتح</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
