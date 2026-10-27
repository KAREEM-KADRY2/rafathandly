import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function AddExpenseModal({ isOpen, onClose, onSuccess, expense = null }) {
  const [formData, setFormData] = useState({
    expense_type: 'بنزين',
    vehicle: 'تريلة',
    amount: '',
    expense_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    description: '',
    document_number: '',
    notes: '',
    maintenance_type: '',
    spare_parts_cost: '',
    labor_cost: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (expense) {
        setFormData({
          expense_type: expense.expense_type,
          vehicle: expense.vehicle,
          amount: expense.amount,
          expense_date: expense.expense_date.split('T')[0],
          description: expense.description || '',
          document_number: expense.document_number || '',
          notes: expense.notes || '',
          maintenance_type: expense.maintenance_type || '',
          spare_parts_cost: expense.spare_parts_cost || '',
          labor_cost: expense.labor_cost || ''
        });
      } else {
        setFormData({
          expense_type: 'بنزين',
          vehicle: 'تريلة',
          amount: '',
          expense_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
          description: '',
          document_number: '',
          notes: '',
          maintenance_type: '',
          spare_parts_cost: '',
          labor_cost: ''
        });
      }
    }
  }, [isOpen, expense]);

  if (!isOpen) return null;

  const calculateMaintenanceTotal = () => {
    if (formData.expense_type === 'صيانة') {
      const parts = parseFloat(formData.spare_parts_cost) || 0;
      const labor = parseFloat(formData.labor_cost) || 0;
      if (parts > 0 || labor > 0) {
        setFormData({ ...formData, amount: parts + labor });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (expense) {
        await api.put(`/expenses/${expense.id}`, formData);
      } else {
        await api.post('/expenses', formData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || 'حدث خطأ غير معروف';
      alert(`حدث خطأ أثناء الحفظ: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{expense ? 'تعديل مصروف' : 'إضافة مصروف'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium">نوع المصروف</label>
              <select className="w-full border p-2 rounded" value={formData.expense_type} onChange={e => setFormData({...formData, expense_type: e.target.value, amount: ''})}>
                <option value="بنزين">بنزين</option>
                <option value="جاز">جاز</option>
                <option value="صيانة">صيانة</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">المركبة</label>
              <select className="w-full border p-2 rounded" value={formData.vehicle} onChange={e => setFormData({...formData, vehicle: e.target.value})}>
                <option value="تريلة">تريلة</option>
                <option value="مازدا">مازدا</option>
                <option value="تويوتا">تويوتا</option>
              </select>
            </div>
            
            {formData.expense_type === 'صيانة' ? (
              <>
                <div className="col-span-2">
                  <label className="block mb-1 text-sm font-medium">نوع الصيانة</label>
                  <input type="text" required className="w-full border p-2 rounded" value={formData.maintenance_type} onChange={e => setFormData({...formData, maintenance_type: e.target.value})} />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">تكلفة قطع الغيار</label>
                  <input type="number" min="0" step="any" className="w-full border p-2 rounded" value={formData.spare_parts_cost} onChange={e => setFormData({...formData, spare_parts_cost: e.target.value})} onBlur={calculateMaintenanceTotal} />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">أجرة العمالة</label>
                  <input type="number" min="0" step="any" className="w-full border p-2 rounded" value={formData.labor_cost} onChange={e => setFormData({...formData, labor_cost: e.target.value})} onBlur={calculateMaintenanceTotal} />
                </div>
              </>
            ) : null}

            <div>
              <label className="block mb-1 text-sm font-medium">المبلغ الإجمالي</label>
              <input type="number" required min="1" step="any" className="w-full border p-2 rounded font-bold text-lg text-blue-700 bg-blue-50" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">التاريخ</label>
              <input type="date" required className="w-full border p-2 rounded" value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block mb-1 text-sm font-medium">البيان / الوصف</label>
              <input type="text" className="w-full border p-2 rounded" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">رقم الفاتورة أو المستند</label>
              <input type="text" className="w-full border p-2 rounded" value={formData.document_number} onChange={e => setFormData({...formData, document_number: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block mb-1 text-sm font-medium">ملاحظات</label>
              <textarea className="w-full border p-2 rounded" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
            </div>
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
