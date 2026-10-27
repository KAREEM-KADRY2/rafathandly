import React from 'react';

const formatCurrency = (val) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(val || 0);

const SuppliersTable = ({ data }) => {
  const list = Array.isArray(data) ? data : (Array.isArray(data?.suppliers) ? data.suppliers : []);
  const totalInvoices = list.reduce((sum, r) => sum + (Number(r.invoices_count) || 0), 0);
  const totalOpening = list.reduce((sum, r) => sum + (Number(r.opening_balance) || 0), 0);
  const totalPurchases = list.reduce((sum, r) => sum + (Number(r.total_purchases) || 0), 0);
  const totalPaid = list.reduce((sum, r) => sum + (Number(r.total_paid) || 0), 0);
  const totalRemaining = list.reduce((sum, r) => {
    const rem = r.total_remaining !== undefined ? Number(r.total_remaining) : ((Number(r.opening_balance) || 0) + (Number(r.total_purchases) || 0) - (Number(r.total_paid) || 0));
    return sum + rem;
  }, 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-right font-medium text-gray-500">المورد</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">عدد الفواتير</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">الرصيد الافتتاحي</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">إجمالي المشتريات</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">المدفوع</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">المتبقي (مستحقات)</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {list.map((row, idx) => {
            const remaining = row.total_remaining !== undefined ? row.total_remaining : ((row.opening_balance || 0) + (row.total_purchases || 0) - (row.total_paid || 0));
            return (
              <tr key={row.id || idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">{row.name || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{row.invoices_count || 0}</td>
                <td className="px-4 py-3 whitespace-nowrap text-blue-600 font-semibold">{formatCurrency(row.opening_balance)}</td>
                <td className="px-4 py-3 whitespace-nowrap font-bold">{formatCurrency(row.total_purchases)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-green-600">{formatCurrency(row.total_paid)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-red-600 font-bold">{formatCurrency(remaining)}</td>
              </tr>
            );
          })}
          {list.length === 0 && (
            <tr>
              <td colSpan="6" className="px-4 py-8 text-center text-gray-500">لا توجد بيانات</td>
            </tr>
          )}
        </tbody>
        {list.length > 0 && (
          <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
            <tr>
              <td className="px-4 py-3 text-right">الإجمالي العام للموردين ({list.length} مورد)</td>
              <td className="px-4 py-3">{totalInvoices}</td>
              <td className="px-4 py-3 text-blue-700">{formatCurrency(totalOpening)}</td>
              <td className="px-4 py-3">{formatCurrency(totalPurchases)}</td>
              <td className="px-4 py-3 text-green-700">{formatCurrency(totalPaid)}</td>
              <td className="px-4 py-3 text-red-700">{formatCurrency(totalRemaining)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default SuppliersTable;
