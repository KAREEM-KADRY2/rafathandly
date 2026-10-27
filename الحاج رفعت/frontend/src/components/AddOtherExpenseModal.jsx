import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function AddOtherExpenseModal({ isOpen, onClose, onSuccess, expense = null }) {
  const [formData, setFormData] = useState({
    expense_name: '',
    amount: '',
    account_id: 1,
    expense_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    description: '',
    document_number: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (expense) {
        setFormData({
          expense_name: expense.expense_name,
          amount: expense.amount,
          account_id: expense.account_id || 1,
          expense_date: expense.expense_date.split('T')[0],
          description: expense.description || '',
          document_number: expense.document_number || '',
          notes: expense.notes || ''
        });
      } else {
        setFormData({
          expense_name: '',
          amount: '',
          account_id: 1,
          expense_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
          description: '',
          document_number: '',
          notes: ''
        });
      }
      
      // Fetch suggestions and accounts
      api.get('/other-expenses/names').then(res => {
        setSuggestions(res.data || []);
      }).catch(console.error);

      api.get('/treasury/accounts').then(res => {
        setAccounts(res.data || []);
      }).catch(console.error);
    }
  }, [isOpen, expense]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (expense) {
        await api.put(`/other-expenses/${expense.id}`, formData);
      } else {
        await api.post('/other-expenses', formData);
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{expense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">اسم المصروف</label>
            <input 
              required 
              type="text" 
              list="expense-names"
              className="w-full border p-2 rounded" 
              placeholder="مثال: كهرباء، مياه، أدوات مكتبية..."
              value={formData.expense_name} 
              onChange={e => setFormData({...formData, expense_name: e.target.value})} 
            />
            <datalist id="expense-names">
              {suggestions.map((name, i) => <option key={i} value={name} />)}
            </datalist>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">المبلغ</label>
            <input required type="number" min="1" step="any" className="w-full border p-2 rounded font-bold text-lg text-blue-600 bg-blue-50" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">خصم من حساب / خزنة / بنك</label>
            <select
              required
              className="w-full border p-2 rounded bg-white font-medium"
              value={formData.account_id}
              onChange={e => setFormData({...formData, account_id: Number(e.target.value)})}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type === 'CASH' ? 'خزنة' : acc.type === 'BANK' ? 'بنك' : 'محفظة'}) - رصيد: {acc.balance?.toLocaleString()} ج.م
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">التاريخ</label>
            <input required type="date" className="w-full border p-2 rounded" value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} />
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
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
