import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function ComprehensiveReport({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports-center/comprehensive', { params: { startDate, endDate } });
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
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">التقرير الشامل (لوحة القيادة)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl text-center">
          <div className="text-blue-800 font-bold mb-2 text-lg">المبيعات</div>
          <div className="text-3xl font-extrabold text-blue-900" dir="ltr">{Number(data?.sales || 0).toLocaleString()}</div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-xl text-center">
          <div className="text-emerald-800 font-bold mb-2 text-lg">التحصيلات النقدية</div>
          <div className="text-3xl font-extrabold text-emerald-900" dir="ltr">{Number(data?.collections || 0).toLocaleString()}</div>
        </div>

        <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center">
          <div className="text-red-800 font-bold mb-2 text-lg">إجمالي المصروفات التشغيلية</div>
          <div className="text-3xl font-extrabold text-red-900" dir="ltr">{Number(data?.expenses || 0).toLocaleString()}</div>
        </div>

      </div>

      <div className="mt-8 text-center text-gray-500">
        <p>هذا التقرير يعطي لمحة سريعة عن أهم الأرقام خلال الفترة المحددة.</p>
        <p>للحصول على تفاصيل دقيقة، يرجى اختيار التقرير المخصص من القائمة.</p>
      </div>

      {/* For printing purposes, we need a table to satisfy the excel export logic, or we disable excel for this report. We'll add a hidden table. */}
      <table className="hidden">
        <thead>
          <tr><th>البيان</th><th>القيمة</th></tr>
        </thead>
        <tbody>
          <tr><td>المبيعات</td><td>{data.sales}</td></tr>
          <tr><td>التحصيلات</td><td>{data.collections}</td></tr>
          <tr><td>المصروفات</td><td>{data.expenses}</td></tr>
        </tbody>
      </table>
    </div>
  );
}