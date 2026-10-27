import React, { useState, useEffect } from 'react';
import { X, Calculator } from 'lucide-react';
import api from '../api';

export default function BarsalModal({ isOpen, onClose, onSuccess, editData }) {
  const initialFormState = {
    record_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }), 
    villa: '', 
    barsal: '', 
    type: '', 
    quantity: '', 
    unit_price: '', 
    total_amount: '', 
    paid_amount: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editData) {
        setFormData({
          record_date: editData.record_date ? new Date(editData.record_date).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }) : '',
          villa: editData.villa,
          barsal: editData.barsal,
          type: editData.type,
          quantity: editData.quantity,
          unit_price: editData.unit_price,
          total_amount: editData.total_amount,
          paid_amount: editData.paid_amount
        });
      } else {
        setFormData(initialFormState);
      }
    }
  }, [isOpen, editData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editData) {
        await api.put(`/barsal/${editData.id}`, formData);
      } else {
        await api.post(`/barsal`, formData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء التسجيل');
    } finally {
      setLoading(false);
    }
  };

  const calcNet = () => {
    const total = Number(formData.total_amount) || 0;
    const paid = Number(formData.paid_amount) || 0;
    return total - paid;
  };

  const handleQuantityChange = (e) => {
    const val = e.target.value;
    const qty = Number(val) || 0;
    const price = Number(formData.unit_price) || 0;
    setFormData(prev => ({
      ...prev,
      quantity: val,
      total_amount: (qty * price) || ''
    }));
  };

  const handlePriceChange = (e) => {
    const val = e.target.value;
    const price = Number(val) || 0;
    const qty = Number(formData.quantity) || 0;
    setFormData(prev => ({
      ...prev,
      unit_price: val,
      total_amount: (qty * price) || ''
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-l from-indigo-900 to-indigo-800 text-white rounded-t-xl">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator size={24} />
            {editData ? 'تعديل حساب البرسل' : 'إضافة حساب برسل'}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors"><X size={28} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 space-y-8 bg-gray-50/50">
          
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">بيانات العملية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">التاريخ</label>
                <input required type="date" className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.record_date} onChange={e => setFormData({...formData, record_date: e.target.value})} />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">الفيلا</label>
                <input required type="text" placeholder="رقم / اسم الفيلا" className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.villa} onChange={e => setFormData({...formData, villa: e.target.value})} />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">البرسل</label>
                <input required type="text" className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.barsal} onChange={e => setFormData({...formData, barsal: e.target.value})} />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">النوع</label>
                <input required type="text" placeholder="مثال: طوب، رمل، سن..." className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">البيانات المالية</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <div>
                <label className="block mb-1.5 text-sm font-bold text-gray-700">الكمية</label>
                <input required type="number" step="any" min="0" placeholder="0" className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800" dir="ltr" value={formData.quantity} onChange={handleQuantityChange} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-gray-700">السعر</label>
                <input required type="number" step="any" min="0" placeholder="0" className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800" dir="ltr" value={formData.unit_price} onChange={handlePriceChange} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-indigo-700">الإجمالي</label>
                <input required type="number" step="any" placeholder="0" className="w-full border-indigo-200 bg-indigo-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-900" dir="ltr" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-emerald-700">المدفوع</label>
                <input required type="number" step="any" placeholder="0" className="w-full border-emerald-200 bg-emerald-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-900" dir="ltr" value={formData.paid_amount} onChange={e => setFormData({...formData, paid_amount: e.target.value})} />
              </div>

            </div>

            <div className="mt-8 border-t border-gray-200 pt-6 flex justify-center">
              <div className="bg-slate-800 text-white p-5 rounded-2xl shadow-inner text-center border-4 border-slate-700 w-full max-w-sm">
                <span className="block text-slate-300 font-semibold mb-2">الصافي (تلقائي)</span>
                <span className={`text-4xl font-extrabold tracking-wider ${calcNet() >= 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                  {calcNet().toLocaleString()}
                </span>
                <p className="text-xs text-slate-400 mt-3 opacity-80">
                  الإجمالي - المدفوع
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-4 border-t mt-6">
            <button type="button" onClick={onClose} className="px-8 py-3 border-2 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors">إلغاء</button>
            <button type="submit" disabled={loading} className="px-10 py-3 bg-indigo-700 font-bold text-white rounded-xl shadow-lg hover:bg-indigo-800 disabled:opacity-50 transition-colors">
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
