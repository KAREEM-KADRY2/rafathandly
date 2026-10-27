import React, { useState, useEffect } from 'react';
import api from '../../api';

export default function SingleCustomerReport({ startDate, endDate }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/customers?all=true')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        setCustomers(list);
      })
      .catch(err => {
        console.error(err);
        setCustomers([]);
      });
  }, []);

  useEffect(() => {
    if (!selectedCustomerId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/reports-center/customer/${selectedCustomerId}`, { params: { startDate, endDate } });
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedCustomerId, startDate, endDate]);

  return (
    <div>
      <div className="mb-6 flex gap-4 items-center no-print">
        <label className="font-semibold">اختر العميل:</label>
        <select 
          className="border p-2 rounded w-64"
          value={selectedCustomerId}
          onChange={e => setSelectedCustomerId(e.target.value)}
        >
          <option value="">-- اختر --</option>
          {(Array.isArray(customers) ? customers : []).map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center p-8">جاري التحميل...</div>}
      
      {!loading && data && (
        <div>
          <h2 className="text-xl font-bold mb-4">كشف حساب: {data.customer?.name || 'عميل'}</h2>
          
          <div className={`grid grid-cols-2 ${Number(data.summary?.total_zara || 0) > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 mb-6`}>
            <div className="summary-box"><div>الرصيد الافتتاحي</div><div className="text-blue-600">{Number(data.openingBalance || data.summary?.opening_balance || 0).toLocaleString()}</div></div>
            <div className="summary-box"><div>إجمالي المسحوبات</div><div>{Number(data.summary?.total_sales || 0).toLocaleString()}</div></div>
            <div className="summary-box"><div>إجمالي المدفوع</div><div>{Number(data.summary?.total_paid || 0).toLocaleString()}</div></div>
            {Number(data.summary?.total_zara || 0) > 0 && (
              <div className="summary-box"><div>إجمالي الخصومات</div><div>{Number(data.summary?.total_zara).toLocaleString()}</div></div>
            )}
            <div className="summary-box border-red-200 bg-red-50"><div>الرصيد الحالي المتبقي</div><div className="text-red-700">{Number(data.currentBalance || 0).toLocaleString()}</div></div>
          </div>

          <table className="w-full">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>نوع الحركة</th>
                <th>عليه</th>
                <th>مدفوع</th>
                <th>الرصيد بعد الحركة</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(data.transactions) ? data.transactions : []).map(t => (
                <tr key={t.id || Math.random()}>
                  <td>{t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('ar-EG') : '-'}</td>
                  <td>{t.transaction_type === 'SALE' ? 'فاتورة بيع' : t.transaction_type === 'PAYMENT' ? 'سداد نقدية' : t.transaction_type === 'OPENING_BALANCE' ? 'رصيد افتتاحي' : 'خصم / تسوية'}</td>
                  <td className="text-red-600">{Number(t.amount || 0) > 0 ? Number(t.amount).toLocaleString() : '-'}</td>
                  <td className="text-green-600">{Number(t.amount || 0) < 0 ? Math.abs(Number(t.amount)).toLocaleString() : '-'}</td>
                  <td className="font-bold">{t.balance_after !== undefined && t.balance_after !== null ? Number(t.balance_after).toLocaleString() : '-'}</td>
                  <td>{t.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}