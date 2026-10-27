import React, { useState, useRef } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import api from '../api';

export default function AddItemModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    unit: 'طن',
    min_stock: '0',
    secondary_unit: '',
    conversion_factor: '',
    conversion_operator: '/' // or '*'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isSubmittingRef = useRef(false);

  if (!isOpen) return null;

  const handleNameChange = (e) => {
    const val = e.target.value;
    const lower = String(val || '').toLowerCase();
    let newFormData = { ...formData, name: val };
    
    if (lower.includes('أسمنت') || lower.includes('اسمنت') || lower.includes('سمنت')) {
      newFormData.unit = 'طن';
      newFormData.secondary_unit = 'شكارة';
      newFormData.conversion_factor = '20';
      newFormData.conversion_operator = '/';
    } else if (lower.includes('رمل') || lower.includes('رمال') || lower.includes('رملة')) {
      newFormData.unit = 'نقلة';
      newFormData.secondary_unit = 'متر ونص';
      newFormData.conversion_factor = '1.5';
      newFormData.conversion_operator = '/';
    }
    
    setFormData(newFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;

    const trimmedName = (formData.name || '').trim();
    if (!trimmedName) {
      setError('يرجى كتابة اسم الصنف');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const payload = { 
        ...formData,
        name: trimmedName,
        unit: (formData.unit || '').trim() || 'طن'
      };
      if (!payload.secondary_unit || !payload.secondary_unit.trim()) {
        payload.secondary_unit = null;
        payload.conversion_factor = null;
      } else {
        payload.secondary_unit = payload.secondary_unit.trim();
      }
      
      await api.post('/inventory/items', payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء إضافة الصنف');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Plus size={24} />
            إضافة صنف جديد
          </h2>
          <button onClick={onClose} className="text-blue-100 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-center gap-2 text-sm font-bold">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">اسم الصنف</label>
            <input
              required
              type="text"
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold"
              value={formData.name}
              onChange={handleNameChange}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">الوحدة الأساسية (في المخزن)</label>
            <input
              required
              type="text"
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold"
              placeholder="مثال: طن، متر، عدد"
              value={formData.unit}
              onChange={e => setFormData({ ...formData, unit: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">الحد الأدنى للتنبيه</label>
            <input
              required
              type="number"
              min="0"
              step="any"
              className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold"
              value={formData.min_stock}
              onChange={e => setFormData({ ...formData, min_stock: e.target.value })}
            />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="font-bold text-gray-800 mb-3 text-sm text-blue-600">وحدة بيع إضافية (اختياري)</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الوحدة الفرعية</label>
                <input
                  type="text"
                  className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold"
                  placeholder="مثال: شكارة، نقلة (اتركها فارغة إذا لم يوجد)"
                  value={formData.secondary_unit}
                  onChange={e => setFormData({ ...formData, secondary_unit: e.target.value })}
                />
              </div>

              {formData.secondary_unit && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">طريقة التحويل</label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded focus:border-blue-500 outline-none text-sm font-bold"
                      value={formData.conversion_operator}
                      onChange={e => setFormData({ ...formData, conversion_operator: e.target.value })}
                    >
                      <option value="/">قسمة (/) مثال: 1 طن = 20 شكارة</option>
                      <option value="*">ضرب (*) مثال: 1 نقلة = 1.5 متر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">معامل التحويل</label>
                    <input
                      required
                      type="number"
                      min="0.0001"
                      step="any"
                      className="w-full p-2 border border-gray-300 rounded focus:border-blue-500 outline-none text-sm font-bold"
                      placeholder="مثال: 20 أو 1.5"
                      value={formData.conversion_factor}
                      onChange={e => setFormData({ ...formData, conversion_factor: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100 mt-6">
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
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ الصنف'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
