import React, { useState } from 'react';
import { X, Lock, KeyRound } from 'lucide-react';
import api from '../api';

export default function InventoryPasswordModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('كلمة المرور غير صحيحة');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/inventory/verify-password', { password });
      if (response.data && response.data.success) {
        const verifiedPassword = password;
        setPassword('');
        setError('');
        onSuccess(verifiedPassword);
      } else {
        setError('كلمة المرور غير صحيحة');
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('كلمة المرور غير صحيحة');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Lock size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">تأكيد تسوية المخزن</h2>
          </div>
          <button 
            type="button" 
            onClick={handleClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-gray-600 text-sm font-medium">أدخل كلمة المرور للمتابعة</p>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <input 
                type="password"
                required
                autoFocus
                className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <KeyRound className="absolute right-3 top-3 text-gray-400" size={18} />
            </div>
          </div>

          {/* Modal Actions */}
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري التحقق...' : 'تأكيد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
