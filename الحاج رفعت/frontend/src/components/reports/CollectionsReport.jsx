import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function CollectionsReport({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports-center/collections', { params: { startDate, endDate } });
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
      <h2 className="text-xl font-bold mb-4">تقرير التحصيلات النقدية</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6 max-w-lg">
        <div className="summary-box bg-emerald-50 border-emerald-200">
          <div className="text-emerald-700">إجمالي التحصيل</div>
          <div className="text-emerald-900">{Number(data.summary?.total_collections || 0).toLocaleString()}</div>
        </div>
        <div className="summary-box">
          <div>عدد العمليات</div>
          <div>{data.summary?.count || 0}</div>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>العميل</th>
            <th>رقم الفاتورة</th>
            <th>المبلغ المحصل</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(data.collections) ? data.collections : []).map(c => (
            <tr key={c.id}>
              <td>{c.payment_date ? new Date(c.payment_date).toLocaleDateString('ar-EG') : '-'}</td>
              <td>{c.customer_name || '-'}</td>
              <td>{c.invoice_number ? '#' + c.invoice_number : '-'}</td>
              <td className="font-bold text-green-700">{Number(c.amount || 0).toLocaleString()}</td>
              <td>{c.notes || '-'}</td>
            </tr>
          ))}
          {(!Array.isArray(data.collections) || data.collections.length === 0) && (
            <tr><td colSpan="5" className="text-center p-4">لا توجد تحصيلات</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}