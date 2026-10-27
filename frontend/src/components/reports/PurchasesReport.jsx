import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function PurchasesReport({ startDate, endDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get('/reports-center/purchases', { params: { startDate, endDate } });
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
      <h2 className="text-xl font-bold mb-4">تقرير المشتريات</h2>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="summary-box"><div>إجمالي المشتريات</div><div className="font-bold text-blue-700">{Number(data?.summary?.total_purchases || 0).toLocaleString()}</div></div>
        <div className="summary-box"><div>مشتريات نقدية</div><div className="font-bold text-emerald-600">{Number(data?.summary?.total_cash_purchases || 0).toLocaleString()}</div></div>
        <div className="summary-box"><div>مشتريات آجلة</div><div className="font-bold text-amber-600">{Number(data?.summary?.total_credit_purchases || 0).toLocaleString()}</div></div>
        <div className="summary-box"><div>إجمالي المدفوع</div><div className="font-bold text-emerald-700">{Number(data?.summary?.total_paid || 0).toLocaleString()}</div></div>
        <div className="summary-box"><div>إجمالي المتبقي</div><div className="font-bold text-rose-600">{Number(data?.summary?.total_remaining || 0).toLocaleString()}</div></div>
        <div className="summary-box"><div>عدد الفواتير</div><div className="font-bold">{data?.summary?.count || 0}</div></div>
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="p-3">التاريخ</th>
              <th className="p-3">رقم الفاتورة</th>
              <th className="p-3 text-center">نوع الفاتورة</th>
              <th className="p-3">المورد</th>
              <th className="p-3">الإجمالي</th>
              <th className="p-3">المدفوع</th>
              <th className="p-3">المتبقي</th>
              <th className="p-3 text-center">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(data?.purchases) ? data.purchases : []).map(p => {
              const isCash = p.payment_type === 'cash' || (Number(p.remaining_amount || 0) <= 0 && Number(p.paid_amount || 0) >= Number(p.total_amount || 0) && p.payment_type !== 'credit');
              const isBalanceDeduction = p.payment_type === 'balance_deduction';

              return (
                <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-3">{p.purchase_date ? new Date(p.purchase_date).toLocaleDateString('ar-EG') : '-'}</td>
                  <td className="p-3 font-bold">{p.invoice_number ? '#' + p.invoice_number : `#${p.id}`}</td>
                  <td className="p-3 text-center">
                    {isCash ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        نقدي (كاش)
                      </span>
                    ) : isBalanceDeduction ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
                        خصم رصيد
                      </span>
                    ) : (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        آجل
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-semibold">{p.supplier_name || '-'}</td>
                  <td className="p-3 font-bold text-blue-700" dir="ltr">{Number(p.total_amount || 0).toLocaleString()} ج.م</td>
                  <td className="p-3 font-bold text-emerald-600" dir="ltr">{Number(p.paid_amount || 0).toLocaleString()} ج.م</td>
                  <td className="p-3 font-bold text-rose-600" dir="ltr">{Number(p.remaining_amount || 0).toLocaleString()} ج.م</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      p.remaining_amount <= 0 || isCash 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : (p.paid_amount > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-rose-100 text-rose-700')
                    }`}>
                      {p.remaining_amount <= 0 || isCash ? 'مسددة' : (p.paid_amount > 0 ? 'سداد جزئي' : 'غير مسددة')}
                    </span>
                  </td>
                </tr>
              );
            })}
            {(!Array.isArray(data?.purchases) || data.purchases.length === 0) && (
              <tr><td colSpan="8" className="text-center p-8 text-gray-500 font-bold">لا توجد مشتريات مسجلة</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}