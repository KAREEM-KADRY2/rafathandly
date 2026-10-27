import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function ProfitLossReport({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports-center/profit-loss', { params: { startDate, endDate } });
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
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">تقرير الأرباح والخسائر</h2>
      
      <div className="max-w-2xl mx-auto border rounded-lg p-6 shadow-sm bg-white">
        <div className="flex justify-between py-3 border-b">
          <span className="font-semibold text-lg">إجمالي إيرادات المبيعات</span>
          <span className="font-bold text-lg text-blue-600">{Number(data?.revenue || 0).toLocaleString()} ج.م</span>
        </div>
        
        <div className="flex justify-between py-3 border-b">
          <span className="font-semibold text-lg">تكلفة البضاعة المباعة</span>
          <span className="font-bold text-lg text-red-600">- {Number(data?.cogs || 0).toLocaleString()} ج.م</span>
        </div>

        <div className="flex justify-between py-4 border-b-4 border-gray-800 bg-gray-50 px-2 rounded mt-2">
          <span className="font-bold text-xl">مجمل الربح</span>
          <span className="font-bold text-xl text-green-700">{Number(data?.grossProfit || 0).toLocaleString()} ج.م</span>
        </div>

        <div className="mt-6 mb-2">
          <span className="font-bold text-gray-700">المصروفات التشغيلية:</span>
        </div>
        
        <div className="pl-6 space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex justify-between border-b pb-1">
            <span>مصروفات نقل / أخرى</span>
            <span>{Number(data?.expensesBreakdown?.other || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span>جاز</span>
            <span>{Number(data?.expensesBreakdown?.fuel || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span>صيانة</span>
            <span>{Number(data?.expensesBreakdown?.maintenance || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span>إكراميات</span>
            <span>{Number(data?.expensesBreakdown?.gratuity || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b pb-1">
            <span>مسحوبات العمال</span>
            <span>{Number(data?.expensesBreakdown?.workers || 0).toLocaleString()}</span>
          </div>
        </div>

        <div className="flex justify-between py-3 border-b">
          <span className="font-semibold text-lg">إجمالي المصروفات</span>
          <span className="font-bold text-lg text-red-600">- {Number(data?.operatingExpenses || 0).toLocaleString()} ج.م</span>
        </div>

        <div className="flex justify-between py-5 bg-gray-800 text-white px-4 rounded-lg mt-4 shadow-md">
          <span className="font-bold text-2xl">صافي الربح / (الخسارة)</span>
          <span className={`font-bold text-2xl ${(Number(data?.netProfit || 0)) >= 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
            {Number(data?.netProfit || 0).toLocaleString()} ج.م
          </span>
        </div>
      </div>
    </div>
  );
}