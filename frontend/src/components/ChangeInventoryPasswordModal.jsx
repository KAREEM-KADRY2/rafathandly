import React, { useState } from 'react';
import { X, Lock, KeyRound, Check } from 'lucide-react';
import api from '../api';

export default function ChangeInventoryPasswordModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setFormData({ current_password: '', new_password: '', confirm_password: '' });
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.current_password) {
      setError('يرجى إدخال كلمة المرور الحالية');
      return;
    }
    if (!formData.new_password) {
      setError('يرجى إدخال كلمة المرور الجديدة');
      return;
    }
    if (formData.new_password !== formData.confirm_password) {
      setError('كلمتا المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }

    setLoading(true);
    try {
      const res = await api.put('/settings/inventory-password', formData);
      setFormData({ current_password: '', new_password: '', confirm_password: '' });
      setError('');
      onSuccess(res.data?.message || 'تم تغيير كلمة مرور تسوية المخزن بنجاح');
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Lock size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">تغيير كلمة مرور تسوية المخزن</h2>
          </div>
          <button 
            type="button" 
            onClick={handleClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور الحالية</label>
            <div className="relative">
              <input 
                type="password"
                required
                autoFocus
                className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"
                placeholder="أدخل كلمة المرور الحالية"
                value={formData.current_password}
                onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
              />
              <KeyRound className="absolute right-3 top-3 text-gray-400" size={18} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور الجديدة</label>
            <div className="relative">
              <input 
                type="password"
                required
                className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"
                placeholder="أدخل كلمة المرور الجديدة"
                value={formData.new_password}
                onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
              />
              <KeyRound className="absolute right-3 top-3 text-gray-400" size={18} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">تأكيد كلمة المرور الجديدة</label>
            <div className="relative">
              <input 
                type="password"
                required
                className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800"
                placeholder="أعيد كتابة كلمة المرور الجديدة"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              />
              <KeyRound className="absolute right-3 top-3 text-gray-400" size={18} />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : <><Check size={18} /> حفظ كلمة المرور</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
