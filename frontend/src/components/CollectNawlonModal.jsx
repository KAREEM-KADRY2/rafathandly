import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function CollectNawlonModal({ isOpen, onClose, trip, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: '', payment_method: 'نقدي', collection_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }), reference_number: '', notes: ''
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        amount: '', payment_method: 'نقدي', collection_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }), reference_number: '', notes: ''
      });
    }
  }, [isOpen]);

  if (!isOpen || !trip) return null;

  const remaining = trip.nawlon_cost - trip.collected_amount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/transport-trips/${trip.id}/collect`, formData);
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء التحصيل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">تحصيل نولون مستحق</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-blue-50 border border-blue-100 p-3 rounded text-sm mb-4">
            <div className="flex justify-between mb-1">
              <span>إجمالي النولون:</span>
              <span className="font-bold">{trip.nawlon_cost} ج.م</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>تم تحصيله مسبقاً:</span>
              <span className="font-bold text-green-600">{trip.collected_amount} ج.م</span>
            </div>
            <div className="flex justify-between border-t border-blue-200 mt-2 pt-2">
              <span>المتبقي للتحصيل:</span>
              <span className="font-bold text-red-600">{remaining} ج.م</span>
            </div>
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium">المبلغ المحصل (ج.م)</label>
            <input required type="number" step="any" min="1" max={remaining} className="w-full border p-2 rounded" dir="ltr" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">طريقة الدفع</label>
            <select className="w-full border p-2 rounded" value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})}>
              <option value="نقدي">نقدي</option>
              <option value="تحويل بنكي">تحويل بنكي</option>
              <option value="شيك">شيك</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">تاريخ التحصيل</label>
            <input required type="date" className="w-full border p-2 rounded" value={formData.collection_date} onChange={e => setFormData({...formData, collection_date: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">رقم المرجع / الإيصال</label>
            <input type="text" className="w-full border p-2 rounded" dir="ltr" value={formData.reference_number} onChange={e => setFormData({...formData, reference_number: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">ملاحظات</label>
            <input type="text" className="w-full border p-2 rounded" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">إلغاء</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
              {loading ? 'جاري التحصيل...' : 'تأكيد التحصيل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
