import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function AddWithdrawalModal({ isOpen, onClose, onSuccess, workerId, withdrawal = null }) {
  const [formData, setFormData] = useState({
    amount: '',
    withdrawal_type: 'سلفة',
    withdrawal_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    description: '',
    document_number: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (withdrawal) {
        setFormData({
          amount: withdrawal.amount,
          withdrawal_type: withdrawal.withdrawal_type,
          withdrawal_date: withdrawal.withdrawal_date.split('T')[0],
          description: withdrawal.description || '',
          document_number: withdrawal.document_number || '',
          notes: withdrawal.notes || ''
        });
      } else {
        setFormData({
          amount: '',
          withdrawal_type: 'سلفة',
          withdrawal_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
          description: '',
          document_number: '',
          notes: ''
        });
      }
    }
  }, [isOpen, withdrawal]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (withdrawal) {
        await api.put(`/workers/withdrawals/${withdrawal.id}`, formData);
      } else {
        await api.post(`/workers/${workerId}/withdrawals`, formData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || 'حدث خطأ غير معروف';
      alert(`حدث خطأ: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{withdrawal ? 'تعديل السحب' : 'إضافة سحب جديد'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">المبلغ</label>
            <input required type="number" min="1" step="any" className="w-full border p-2 rounded font-bold text-lg text-red-600 bg-red-50" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">نوع السحب</label>
            <select className="w-full border p-2 rounded" value={formData.withdrawal_type} onChange={e => setFormData({...formData, withdrawal_type: e.target.value})}>
              <option value="سلفة">سلفة</option>
              <option value="أجر">أجر</option>
              <option value="مصروف شخصي">مصروف شخصي</option>
              <option value="أخرى">أخرى</option>
            </select>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">التاريخ</label>
            <input required type="date" className="w-full border p-2 rounded" value={formData.withdrawal_date} onChange={e => setFormData({...formData, withdrawal_date: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">البيان</label>
            <input type="text" className="w-full border p-2 rounded" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">رقم المستند (اختياري)</label>
            <input type="text" className="w-full border p-2 rounded" value={formData.document_number} onChange={e => setFormData({...formData, document_number: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">ملاحظات</label>
            <textarea className="w-full border p-2 rounded" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">إلغاء</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
