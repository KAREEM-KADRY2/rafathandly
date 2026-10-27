import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function CustomersReport({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports-center/customers', { params: { startDate, endDate } });
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
      <h2 className="text-xl font-bold mb-4">تقرير العملاء (الأرصدة)</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th>العميل</th>
              <th>الرصيد الافتتاحي</th>
              <th>إجمالي المبيعات الآجلة</th>
              <th>إجمالي المدفوع</th>
              <th>إجمالي المتبقي</th>
              <th>المتأخر</th>
              <th>عدد الفواتير</th>
              <th>آخر حركة</th>
              <th>أقرب استحقاق</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(data?.customers) ? data.customers : []).map(c => (
              <tr key={c.id}>
                <td>{c.name || '-'}</td>
                <td className="text-blue-600 font-bold">{Number(c.opening_balance || 0).toLocaleString()}</td>
                <td>{Number(c.total_sales || 0).toLocaleString()}</td>
                <td>{Number(c.total_paid || 0).toLocaleString()}</td>
                <td>{Number(c.total_remaining || 0).toLocaleString()}</td>
                <td className="text-red-600 font-bold">{Number(c.total_overdue || 0).toLocaleString()}</td>
                <td>{c.sales_count || 0}</td>
                <td>{c.last_sale_date ? new Date(c.last_sale_date).toLocaleDateString('ar-EG') : '-'}</td>
                <td>{c.nearest_due_date ? new Date(c.nearest_due_date).toLocaleDateString('ar-EG') : '-'}</td>
              </tr>
            ))}
            {(!Array.isArray(data?.customers) || data.customers.length === 0) && (
              <tr><td colSpan="9" className="text-center p-4">لا يوجد عملاء مسجلين</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}