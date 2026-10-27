import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function EditTransactionModal({ isOpen, onClose, transaction, supplier, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: '', reference_number: '', description: '', created_at: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && transaction) {
      setFormData({
        amount: Math.abs(transaction.amount || 0),
        reference_number: transaction.reference_number || transaction.purchase_invoice_number || '',
        description: transaction.description || transaction.notes || '',
        created_at: transaction.created_at ? transaction.created_at.split(' ')[0] : transaction.transaction_date ? transaction.transaction_date.split(' ')[0] : ''
      });
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Retain transaction amount sign convention based on transaction type
      let finalAmount = Number(formData.amount);
      if (transaction.amount < 0) {
        finalAmount = -Math.abs(finalAmount);
      }

      await api.put(`/suppliers/transactions/${transaction.id}`, { 
        amount: finalAmount,
        reference_number: formData.reference_number,
        description: formData.description,
        created_at: formData.created_at
      });
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء تعديل الحركة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-5 border-b bg-amber-50 rounded-t-lg">
          <div>
            <h2 className="text-lg font-bold text-slate-800">تعديل الحركة المالية #{transaction.id}</h2>
            <p className="text-xs text-slate-500 mt-0.5">سيتم رصد الحركة وتعديل الرصيد تلقائياً</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block mb-1 text-sm font-bold text-slate-700">قيمة الحركة (ج.م)</label>
            <input 
              required 
              type="number" 
              step="any" 
              className="w-full border p-2.5 rounded font-bold text-lg" 
              dir="ltr"
              value={formData.amount} 
              onChange={e => setFormData({...formData, amount: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-slate-700">البيان / الوصف</label>
            <input 
              required 
              type="text" 
              className="w-full border p-2 rounded text-sm" 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-slate-700">رقم المستند / المرجع</label>
            <input 
              type="text" 
              className="w-full border p-2 rounded text-sm" 
              dir="ltr"
              value={formData.reference_number} 
              onChange={e => setFormData({...formData, reference_number: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-slate-700">تاريخ الحركة</label>
            <input 
              type="date" 
              className="w-full border p-2 rounded text-sm" 
              value={formData.created_at} 
              onChange={e => setFormData({...formData, created_at: e.target.value})} 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-bold">
              إلغاء
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-5 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:bg-gray-400 font-bold"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ التعديل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
