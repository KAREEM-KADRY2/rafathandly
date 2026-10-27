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

const ExpensesTable = ({ data }) => {
  const list = Array.isArray(data) ? data : [];
  const totalAmount = list.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-right font-medium text-gray-500">التاريخ</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">المبلغ</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">النوع</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">البيان</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">رقم المرجع</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {list.map((row, idx) => (
            <tr key={row.id || idx} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">{safeDate(row.date || row.created_at)}</td>
              <td className="px-4 py-3 whitespace-nowrap font-bold text-red-600">{formatCurrency(row.amount)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                  {row.expense_type || 'عام'}
                </span>
              </td>
              <td className="px-4 py-3">{row.description}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500">{row.reference_number || '-'}</td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan="5" className="px-4 py-8 text-center text-gray-500">لا توجد بيانات</td>
            </tr>
          )}
        </tbody>
        {list.length > 0 && (
          <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300">
            <tr>
              <td className="px-4 py-3 text-right">الإجمالي العام ({list.length} عملية)</td>
              <td className="px-4 py-3 text-red-700">{formatCurrency(totalAmount)}</td>
              <td colSpan="3"></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default ExpensesTable;
