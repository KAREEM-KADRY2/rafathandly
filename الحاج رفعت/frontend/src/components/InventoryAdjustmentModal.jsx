import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import api from '../api';

export default function InventoryAdjustmentModal({ isOpen, onClose, items, onSuccess, password }) {
  const [formData, setFormData] = useState({
    item_id: '',
    actual_stock: '',
    reason: '',
    adjustment_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const safeItems = Array.isArray(items) ? items : [];
  const selectedItem = safeItems.find(i => String(i?.id) === String(formData.item_id));
  const current_stock = selectedItem ? selectedItem.current_stock : 0;
  const actual = parseFloat(formData.actual_stock);
  const diff = isNaN(actual) ? 0 : actual - current_stock;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!formData.item_id || isNaN(actual)) {
      setError('الرجاء اختيار الصنف وإدخال الكمية الفعلية');
      return;
    }
    if (diff === 0) {
      setError('لا يوجد فرق للتسوية (الكمية الفعلية تساوي الرصيد الحالي)');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/inventory/adjustments', {
        ...formData,
        current_stock,
        difference: diff,
        password
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء حفظ التسوية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-x-auto flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">تسوية مخزون</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}
          
          <form id="adjustment-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الصنف</label>
              <select 
                required
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.item_id}
                onChange={e => setFormData({...formData, item_id: e.target.value})}
              >
                <option value="">-- اختر الصنف --</option>
                {safeItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>

            {selectedItem && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-500">الرصيد الحالي (نظام)</p>
                  <p className="text-xl font-bold text-blue-600">{current_stock} {selectedItem.unit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">الفرق بناءً على الإدخال</p>
                  <p className={`text-xl font-bold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {diff > 0 ? '+' : ''}{diff} {selectedItem.unit}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols- gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية الفعلية بالمخزن</label>
                <input 
                  type="number" 
                  step="any"
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.actual_stock}
                  onChange={e => setFormData({...formData, actual_stock: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التسوية</label>
                <input 
                  type="date" 
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.adjustment_date}
                  onChange={e => setFormData({...formData, adjustment_date: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سبب التسوية</label>
              <select 
                required
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.reason}
                onChange={e => setFormData({...formData, reason: e.target.value})}
              >
                <option value="">-- اختر السبب --</option>
                <option value="جرد فعلي">جرد فعلي</option>
                <option value="تالف / هالك">تالف / هالك</option>
                <option value="خطأ سابق في الإدخال">خطأ سابق في الإدخال</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات إضافية</label>
              <textarea 
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                rows="2"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              ></textarea>
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
          >
            إلغاء
          </button>
          <button 
            type="submit"
            form="adjustment-form"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? 'جاري الحفظ...' : <><Check size={18} /> حفظ التسوية</>}
          </button>
        </div>
      </div>
    </div>
  );
}
