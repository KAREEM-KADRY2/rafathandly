import React, { useState, useEffect } from 'react';
import { X, Save, Settings } from 'lucide-react';
import api from '../api';

export default function EditItemModal({ item, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    secondary_unit: '',
    conversion_factor: '',
    conversion_operator: '/',
    min_stock: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        unit: item.unit || '',
        secondary_unit: item.secondary_unit || '',
        conversion_factor: item.conversion_factor || '',
        conversion_operator: item.conversion_operator || '/',
        min_stock: item.min_stock || 0
      });
    }
  }, [item]);

  if (!item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...formData };
      if (!payload.secondary_unit) {
        payload.secondary_unit = null;
        payload.conversion_factor = null;
      }
      await api.put(`/inventory/items/${item.id}`, payload);
      onSuccess();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء التحديث');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b bg-gradient-to-l from-indigo-900 to-indigo-800 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings size={22} />
            إعدادات وتحويلات صنف: {item.name}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors"><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex-1 space-y-5 bg-gray-50/50">
          
          <div>
            <label className="block mb-1.5 text-sm font-bold text-gray-700">اسم الصنف</label>
            <input required type="text" className="w-full border-gray-300 p-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white" 
              value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-sm font-bold text-gray-700">الوحدة الأساسية (المخزن)</label>
              <input required type="text" placeholder="مثال: طن" className="w-full border-gray-300 p-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white" 
                value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-bold text-gray-700">الحد الأدنى للمخزون</label>
              <input required type="number" min="0" step="any" className="w-full border-gray-300 p-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white" dir="ltr"
                value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: e.target.value})} />
            </div>
          </div>
          
          <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100 mt-2 space-y-3">
            <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
              الوحدة الثانوية للبيع (تحديد الطن يعمل كم شكارة)
            </h3>
            <p className="text-xs text-indigo-700 leading-relaxed font-medium">
              تتيح لك تحديد عدد الشكائر في الطن لهذا الصنف (مثلاً: 20 للأسمنت، 33 للجبس) ليتعامل النظام معها تلقائياً في الفواتير والمبيعات.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block mb-1 text-xs font-bold text-gray-700">الوحدة الفرعية / البيع</label>
                <input type="text" placeholder="مثال: شكارة (اتركها فارغة إن لم يوجد)" className="w-full border-indigo-200 p-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white" 
                  value={formData.secondary_unit} onChange={e => setFormData({...formData, secondary_unit: e.target.value})} />
              </div>

              {formData.secondary_unit && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-indigo-200 shadow-sm">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">طريقة التحويل</label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:border-indigo-500 outline-none text-xs font-bold bg-white"
                      value={formData.conversion_operator}
                      onChange={e => setFormData({ ...formData, conversion_operator: e.target.value })}
                    >
                      <option value="/">قسمة (/) 1 طن = 20 شكارة</option>
                      <option value="*">ضرب (*) 1 نقلة = 1.5 متر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">معامل التحويل (كم شكارة في الطن؟)</label>
                    <input 
                      required
                      type="number" 
                      min="0.0001" 
                      step="any" 
                      placeholder="20 للأسمنت أو 33 للجبس" 
                      className="w-full border-gray-300 p-2 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold bg-white" 
                      dir="ltr"
                      value={formData.conversion_factor} 
                      onChange={e => setFormData({...formData, conversion_factor: e.target.value})} 
                    />
                  </div>
                </div>
              )}
            </div>
            
            {formData.unit && formData.secondary_unit && formData.conversion_factor && (
              <div className="mt-3 text-xs font-bold text-emerald-800 bg-emerald-100 p-2.5 rounded-lg text-center border border-emerald-200 shadow-sm">
                ✅ النتيجة المعتمدة: 1 {formData.unit} = {formData.conversion_factor} {formData.secondary_unit}
              </div>
            )}
          </div>
          
          <div className="pt-4 mt-4 flex gap-3 border-t border-gray-200">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold transition-colors">إلغاء</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-bold transition-colors shadow-sm flex items-center justify-center gap-2">
              <Save size={18} /> {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
