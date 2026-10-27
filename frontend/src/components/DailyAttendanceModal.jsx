import React, { useState, useEffect } from 'react';
import api from '../api';

export default function DailyAttendanceModal({ isOpen, onClose, onSuccess, workerId }) {
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(workerId || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('حاضر');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchWorkers();
      if (workerId) {
        setSelectedWorkerId(workerId.toString());
      }
    }
  }, [isOpen, workerId]);

  const fetchWorkers = async () => {
    try {
      const res = await api.get('/workers');
      const data = res.data || [];
      setWorkers(data);
      if (!workerId && data.length > 0) {
        setSelectedWorkerId(data[0].id.toString());
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWorkerId) {
      alert('برجاء اختيار العامل أولاً');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/workers/${selectedWorkerId}/attendance/daily`, {
        date, status, notes
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'حدث خطأ أثناء تسجيل الحضور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">تسجيل حضور يومي</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">اسم العامل</label>
            <select
              required
              value={selectedWorkerId}
              onChange={e => setSelectedWorkerId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium bg-white"
            >
              <option value="">-- اختر العامل --</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.job_title ? `(${w.job_title})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">التاريخ</label>
            <input 
              type="date" 
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">الحالة</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-medium bg-white"
            >
              <option value="حاضر">حاضر</option>
              <option value="غائب">غائب</option>
              <option value="نصف يوم">نصف يوم</option>
              <option value="إجازة">إجازة</option>
              <option value="عطلة">عطلة</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات (اختياري)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 text-right"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold shadow-sm"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ وتسجيل'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-bold"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
