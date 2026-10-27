import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function SalesReport({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports-center/sales', { params: { startDate, endDate } });
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
      <h2 className="text-xl font-bold mb-4">تقرير المبيعات</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="summary-box"><div>إجمالي المبيعات</div><div>{Number(data?.summary?.total_sales || 0).toLocaleString()}</div></div>
        <div className="summary-box"><div>إجمالي المدفوع</div><div>{Number(data?.summary?.total_paid || 0).toLocaleString()}</div></div>
        <div className="summary-box"><div>إجمالي المتبقي</div><div>{Number(data?.summary?.total_remaining || 0).toLocaleString()}</div></div>
        <div className="summary-box"><div>عدد الفواتير</div><div>{data?.summary?.count || 0}</div></div>
        <div className="summary-box"><div>عدد العملاء</div><div>{data?.summary?.customers_count || 0}</div></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>رقم الفاتورة</th>
              <th>العميل</th>
              <th>الإجمالي</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(data?.sales) ? data.sales : []).map(s => (
              <tr key={s.id}>
                <td>{s.sale_date ? new Date(s.sale_date).toLocaleDateString('ar-EG') : '-'}</td>
                <td>{s.invoice_number ? '#' + s.invoice_number : '-'}</td>
                <td>{s.customer_name || '-'}</td>
                <td>{Number(s.original_amount || 0).toLocaleString()}</td>
                <td>{Number(s.paid_amount || 0).toLocaleString()}</td>
                <td>{Number(s.remaining_amount || 0).toLocaleString()}</td>
                <td>{s.status || '-'}</td>
              </tr>
            ))}
            {(!Array.isArray(data?.sales) || data.sales.length === 0) && (
              <tr><td colSpan="7" className="text-center p-4">لا توجد مبيعات مسجلة</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}