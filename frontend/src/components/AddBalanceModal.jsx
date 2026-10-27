import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function AddBalanceModal({ isOpen, onClose, supplierId, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: '', reference_number: '', description: 'إيداع نقدي / تحويل'
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFormData({ amount: '', reference_number: '', description: 'إيداع نقدي / تحويل' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/suppliers/${supplierId}/balance/deposit`, formData);
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الإضافة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">إضافة رصيد (إيداع)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">المبلغ (ج.م)</label>
            <input required type="number" min="1" step="any" className="w-full border p-2 rounded" dir="ltr" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">الوصف / ملاحظات</label>
            <input required type="text" className="w-full border p-2 rounded" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">رقم المرجع / الإيصال</label>
            <input type="text" className="w-full border p-2 rounded" dir="ltr" value={formData.reference_number} onChange={e => setFormData({...formData, reference_number: e.target.value})} />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">إلغاء</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
              {loading ? 'جاري الإضافة...' : 'تأكيد الإيداع'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
