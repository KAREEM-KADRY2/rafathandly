import React from 'react';

const formatCurrency = (val) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(val || 0);

const safeDate = (d) => {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('ar-EG');
  } catch (e) {
    return '-';
  }
};

const PurchasesTable = ({ data }) => {
  const list = Array.isArray(data) ? data : [];
  const totalItems = list.reduce((sum, r) => sum + (Number(r.items_count) || 0), 0);
  const totalAmount = list.reduce((sum, r) => sum + (Number(r.original_amount || r.total_amount) || 0), 0);
  const totalPaid = list.reduce((sum, r) => sum + (Number(r.paid_amount) || 0), 0);
  const totalRemaining = list.reduce((sum, r) => sum + (Number(r.remaining_amount) || 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-right font-medium text-gray-500">التاريخ</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">رقم الفاتورة</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">المورد</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">عدد العناصر</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">الإجمالي</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">المدفوع</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">المتبقي</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {list.map((row, idx) => (
            <tr key={row.id || idx} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">{safeDate(row.purchase_date || row.created_at)}</td>
              <td className="px-4 py-3 whitespace-nowrap font-medium text-blue-600">{row.invoice_number || row.id}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.supplier_name || 'مورد غير محدد'}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.items_count || '-'}</td>
              <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-800">{formatCurrency(row.original_amount || row.total_amount)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-green-600">{formatCurrency(row.paid_amount)}</td>
              <td className="px-4 py-3 whitespace-nowrap text-red-600">{formatCurrency(row.remaining_amount)}</td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan="7" className="px-4 py-8 text-center text-gray-500">لا توجد بيانات</td>
            </tr>
          )}
        </tbody>
        {list.length > 0 && (
          <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
            <tr>
              <td colSpan="3" className="px-4 py-3 text-right">الإجمالي العام للمشتريات ({list.length} فاتورة)</td>
              <td className="px-4 py-3">{totalItems}</td>
              <td className="px-4 py-3">{formatCurrency(totalAmount)}</td>
              <td className="px-4 py-3 text-green-700">{formatCurrency(totalPaid)}</td>
              <td className="px-4 py-3 text-red-700">{formatCurrency(totalRemaining)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default PurchasesTable;
