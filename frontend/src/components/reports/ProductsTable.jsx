import React from 'react';

const formatCurrency = (val) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(val || 0);

const ProductsTable = ({ data }) => {
  const list = Array.isArray(data) ? data : [];
  const totalPurchased = list.reduce((sum, r) => sum + (Number(r.purchased_qty) || 0), 0);
  const totalSold = list.reduce((sum, r) => sum + (Number(r.sold_qty) || 0), 0);
  const totalPurchaseCost = list.reduce((sum, r) => sum + (Number(r.purchase_cost) || 0), 0);
  const totalRevenue = list.reduce((sum, r) => sum + (Number(r.sales_revenue) || 0), 0);
  const totalProfit = list.reduce((sum, r) => sum + (Number(r.profit) || 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-right font-medium text-gray-500">المنتج</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">الكمية المشتراة</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">الكمية المباعة</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">متوسط التكلفة</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">تكلفة الشراء</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">إيرادات البيع</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">الربح</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {list.map((row, idx) => (
            <tr key={row.id || idx} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap font-medium">{row.name || '-'}</td>
              <td className="px-4 py-3 whitespace-nowrap text-blue-600">{row.purchased_qty || 0}</td>
              <td className="px-4 py-3 whitespace-nowrap text-green-600">{row.sold_qty || 0}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatCurrency(row.avg_unit_cost)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(row.purchase_cost)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(row.sales_revenue)}</td>
              <td className="px-4 py-3 whitespace-nowrap font-bold text-emerald-600">{formatCurrency(row.profit)}</td>
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
              <td className="px-4 py-3 text-right">الإجمالي العام ({list.length} صنف)</td>
              <td className="px-4 py-3 text-blue-700">{totalPurchased}</td>
              <td className="px-4 py-3 text-green-700">{totalSold}</td>
              <td></td>
              <td className="px-4 py-3">{formatCurrency(totalPurchaseCost)}</td>
              <td className="px-4 py-3 text-green-700">{formatCurrency(totalRevenue)}</td>
              <td className="px-4 py-3 text-emerald-700">{formatCurrency(totalProfit)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default ProductsTable;
