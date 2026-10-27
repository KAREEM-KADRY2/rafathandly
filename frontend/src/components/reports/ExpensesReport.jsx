import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function ExpensesReport({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports-center/expenses', { params: { startDate, endDate } });
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
      <h2 className="text-xl font-bold mb-4">تقرير المصروفات</h2>
      
      <div className="grid grid-cols-1 gap-4 mb-6 max-w-sm">
        <div className="summary-box bg-red-50 border-red-200">
          <div className="text-red-700">إجمالي المصروفات</div>
          <div className="text-red-900">{Number(data?.summary || 0).toLocaleString()}</div>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>النوع</th>
            <th>الجهة / المركبة</th>
            <th>المبلغ</th>
            <th>البيان</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(data?.expenses) ? data.expenses : []).map((e, idx) => (
            <tr key={idx}>
              <td>{e.date ? new Date(e.date).toLocaleDateString('ar-EG') : '-'}</td>
              <td>{e.type || '-'}</td>
              <td>{e.party || '-'}</td>
              <td className="font-bold text-red-600">{Number(e.amount || 0).toLocaleString()}</td>
              <td>{e.description || e.notes || '-'}</td>
            </tr>
          ))}
          {(!Array.isArray(data?.expenses) || data.expenses.length === 0) && (
            <tr><td colSpan="5" className="text-center p-4">لا توجد مصروفات</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}