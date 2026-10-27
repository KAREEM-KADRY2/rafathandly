import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function AddWorkerModal({ isOpen, onClose, onSuccess, worker = null, workerToEdit = null }) {
  const targetWorker = worker || workerToEdit;
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    job_title: '',
    monthly_salary: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (targetWorker) {
        setFormData({
          name: targetWorker.name,
          phone: targetWorker.phone || '',
          job_title: targetWorker.job_title || '',
          monthly_salary: targetWorker.monthly_salary || '',
          notes: targetWorker.notes || ''
        });
      } else {
        setFormData({ name: '', phone: '', job_title: '', monthly_salary: '', notes: '' });
      }
    }
  }, [isOpen, targetWorker]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.name.trim()) {
      alert('يرجى كتابة اسم العامل أولاً');
      return;
    }
    setLoading(true);
    try {
      if (targetWorker) {
        await api.put(`/workers/${targetWorker.id}`, formData);
      } else {
        await api.post('/workers', formData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || 'حدث خطأ غير معروف';
      alert(`تنبيه: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{targetWorker ? 'تعديل بيانات العامل' : 'إضافة عامل جديد'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium">اسم العامل</label>
            <input required type="text" className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">رقم الهاتف</label>
            <input type="text" className="w-full border p-2 rounded" dir="ltr" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">الوظيفة / المهنة</label>
            <input type="text" className="w-full border p-2 rounded" value={formData.job_title} onChange={e => setFormData({...formData, job_title: e.target.value})} />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">الراتب الشهري / اليومية</label>
            <input type="number" step="0.01" className="w-full border p-2 rounded" value={formData.monthly_salary} onChange={e => setFormData({...formData, monthly_salary: e.target.value})} />
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
