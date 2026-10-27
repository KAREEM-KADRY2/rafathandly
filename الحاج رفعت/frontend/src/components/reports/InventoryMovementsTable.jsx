import React from 'react';

const safeDateTime = (d) => {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '-' : dt.toLocaleString('ar-EG');
  } catch (e) {
    return '-';
  }
};

const InventoryMovementsTable = ({ data }) => {
  const list = Array.isArray(data) ? data : [];
  const inCount = list.filter(r => r.movement_type === 'IN' || Number(r.quantity) > 0).length;
  const outCount = list.length - inCount;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-right font-medium text-gray-500">التاريخ</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">المنتج</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">الكمية</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">نوع الحركة</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">رقم المرجع</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {list.map((row, idx) => (
            <tr key={row.id || idx} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">{safeDateTime(row.created_at || row.movement_date)}</td>
              <td className="px-4 py-3 whitespace-nowrap">{row.product_name || row.item_name || '-'}</td>
              <td className="px-4 py-3 whitespace-nowrap font-bold" dir="ltr">{row.quantity > 0 ? '+' + row.quantity : row.quantity}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {row.movement_type === 'IN' || row.quantity > 0 ? (
                  <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">وارد</span>
                ) : (
                  <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs">منصرف</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500">{row.reference_id || '-'}</td>
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
              <td colSpan="2" className="px-4 py-3 text-right">إجمالي العمليات ({list.length} حركة)</td>
              <td colSpan="3" className="px-4 py-3">
                <span className="text-green-700 ml-4">وارد: {inCount}</span>
                <span className="text-red-700">منصرف: {outCount}</span>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default InventoryMovementsTable;
