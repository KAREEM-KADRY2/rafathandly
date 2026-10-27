import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function ProductsReport({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports-center/products', { params: { startDate, endDate } });
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
      <h2 className="text-xl font-bold mb-4">تقرير حركة الأصناف</h2>
      
      <table className="w-full">
        <thead>
          <tr>
            <th>الصنف</th>
            <th>الرصيد الحالي</th>
            <th>تم شراؤه (خلال الفترة)</th>
            <th>تم بيعه (خلال الفترة)</th>
            <th>إيرادات المبيعات</th>
          </tr>
        </thead>
        <tbody>
          {(Array.isArray(data?.products) ? data.products : []).map(p => (
            <tr key={p.id}>
              <td className="font-bold">{p.item_name || '-'}</td>
              <td className="font-bold text-blue-600">{p.current_stock || 0}</td>
              <td className="text-emerald-600">{p.qty_purchased || 0}</td>
              <td className="text-red-600">{p.qty_sold || 0}</td>
              <td>{Number(p.sales_revenue || 0).toLocaleString()}</td>
            </tr>
          ))}
          {(!Array.isArray(data?.products) || data.products.length === 0) && (
            <tr><td colSpan="5" className="text-center p-4">لا توجد حركة أصناف مسجلة</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}