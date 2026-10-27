import React, { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import api from '../api';

export default function AddLeaveModal({ isOpen, onClose, workerId, onSuccess }) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    leave_type: 'إجازة سنوية',
    start_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    end_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    reason: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/workers/${workerId}/leaves`, formData);
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'حدث خطأ أثناء تسجيل الإجازة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-purple-600 p-6 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={24} />
            تسجيل إجازة
          </h2>
          <button onClick={onClose} className="text-purple-100 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">نوع الإجازة</label>
            <select
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none font-bold text-gray-700"
              value={formData.leave_type}
              onChange={e => setFormData({ ...formData, leave_type: e.target.value })}
            >
              <option value="إجازة سنوية">إجازة سنوية</option>
              <option value="إجازة مرضية">إجازة مرضية</option>
              <option value="إجازة عارضة">إجازة عارضة</option>
              <option value="عطلة رسمية">عطلة رسمية</option>
              <option value="أخرى">أخرى</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">من تاريخ</label>
                <input
                required
                type="date"
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none font-bold text-gray-700"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                />
            </div>
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">إلى تاريخ</label>
                <input
                required
                type="date"
                className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none font-bold text-gray-700"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">السبب (اختياري)</label>
            <input
              type="text"
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none font-bold text-gray-700"
              value={formData.reason}
              onChange={e => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات (اختياري)</label>
            <input
              type="text"
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none font-bold text-gray-700"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري التسجيل...' : 'تسجيل الإجازة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
