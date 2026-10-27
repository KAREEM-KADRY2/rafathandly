import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function TreasuryReport({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports-center/treasury', { params: { startDate, endDate } });
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate]);

  if (loading) return <div className="text-center p-8">جاري التحميل...</div>;
  if (!data) return null;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">تقرير حركة الخزنة الشاملة</h2>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="summary-box bg-green-50 border-green-200">
          <div className="text-green-700">إجمالي الداخل</div>
          <div className="text-green-900">{Number(data?.summary?.totalIn || 0).toLocaleString()}</div>
        </div>
        <div className="summary-box bg-red-50 border-red-200">
          <div className="text-red-700">إجمالي الخارج</div>
          <div className="text-red-900">{Number(data?.summary?.totalOut || 0).toLocaleString()}</div>
        </div>
        <div className={`summary-box ${Number(data?.summary?.net || 0) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <div>صافي الحركة</div>
          <div className="font-extrabold" dir="ltr">{Number(data?.summary?.net || 0).toLocaleString()}</div>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>نوع الحركة</th>
            <th>الطرف / البيان</th>
            <th>داخل (+)</th>
            <th>خارج (-)</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(data?.transactions) ? data.transactions : []).map((t, idx) => (
            <tr key={idx}>
              <td>{t.date ? new Date(t.date).toLocaleDateString('ar-EG', { hour: '2-digit', minute:'2-digit' }) : '-'}</td>
              <td>{t.type || '-'}</td>
              <td className="font-semibold">{t.party || '-'}</td>
              <td className="text-green-600 font-bold">{t.flow === 'IN' ? Number(t.amount || 0).toLocaleString() : '-'}</td>
              <td className="text-red-600 font-bold">{t.flow === 'OUT' ? Number(t.amount || 0).toLocaleString() : '-'}</td>
              <td>{t.notes || '-'}</td>
            </tr>
          ))}
          {(!Array.isArray(data?.transactions) || data.transactions.length === 0) && (
            <tr><td colSpan="6" className="text-center p-4">لا توجد حركات</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}