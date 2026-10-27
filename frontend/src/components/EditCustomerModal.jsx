import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function EditCustomerModal({ customer, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: customer.name || '',
    phone: customer.phone || '',
    address: customer.address || '',
    notes: customer.notes || '',
    default_credit_deadline: customer.default_credit_deadline || 3
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/customers/${customer.id}`, formData);
      onSuccess();
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تعديل بيانات العميل');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-x-auto flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold">تعديل بيانات العميل</h2>
          <button onClick={onClose} className="text-gray-500 hover:bg-gray-200 p-1 rounded">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">اسم العميل *</label>
              <input required type="text" className="w-full border p-2 rounded" 
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">رقم الهاتف</label>
              <input type="text" className="w-full border p-2 rounded" dir="ltr"
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العنوان</label>
              <input type="text" className="w-full border p-2 rounded" 
                value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">ملاحظات</label>
              <textarea className="w-full border p-2 rounded h-20" 
                value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">إلغاء</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300">
              {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
