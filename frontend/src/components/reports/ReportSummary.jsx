import React from 'react';

const formatCurrency = (val) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(val || 0);

const ReportSummary = ({ summary, type }) => {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {summary.total_opening !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-indigo-500">
          <div className="text-sm text-gray-500 mb-1">إجمالي الأرصدة الافتتاحية</div>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(summary.total_opening)}</div>
        </div>
      )}
      {summary.total_sales !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-blue-500">
          <div className="text-sm text-gray-500 mb-1">إجمالي المبيعات</div>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(summary.total_sales)}</div>
        </div>
      )}
      {summary.total_purchases !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-blue-500">
          <div className="text-sm text-gray-500 mb-1">إجمالي المشتريات</div>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(summary.total_purchases)}</div>
        </div>
      )}
      {summary.total_expenses !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-red-500">
          <div className="text-sm text-gray-500 mb-1">إجمالي المصروفات</div>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(summary.total_expenses)}</div>
        </div>
      )}
      {summary.total_paid !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-green-500">
          <div className="text-sm text-gray-500 mb-1">الإجمالي المدفوع</div>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(summary.total_paid)}</div>
        </div>
      )}
      {summary.total_remaining !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-orange-500">
          <div className="text-sm text-gray-500 mb-1">الإجمالي المتبقي</div>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(summary.total_remaining)}</div>
        </div>
      )}
      {summary.total_profit !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-emerald-500">
          <div className="text-sm text-gray-500 mb-1">إجمالي الأرباح</div>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(summary.total_profit)}</div>
        </div>
      )}
      {summary.total_capital !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-blue-600">
          <div className="text-sm text-gray-500 mb-1">إجمالي رأس المال</div>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(summary.total_capital)}</div>
        </div>
      )}
      {summary.total_withdrawals !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-red-500">
          <div className="text-sm text-gray-500 mb-1">إجمالي المسحوبات</div>
          <div className="text-xl font-bold text-red-700">{formatCurrency(summary.total_withdrawals)}</div>
        </div>
      )}
      {summary.total_returned !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-teal-500">
          <div className="text-sm text-gray-500 mb-1">المسترد للخزينة</div>
          <div className="text-xl font-bold text-teal-700">{formatCurrency(summary.total_returned)}</div>
        </div>
      )}
      {summary.net_withdrawals !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-amber-500">
          <div className="text-sm text-gray-500 mb-1">صافي المسحوبات</div>
          <div className="text-xl font-bold text-amber-700">{formatCurrency(summary.net_withdrawals)}</div>
        </div>
      )}
      {summary.total_balance !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-indigo-600">
          <div className="text-sm text-gray-500 mb-1">صافي رصيد الشركاء</div>
          <div className="text-xl font-bold text-indigo-900">{formatCurrency(summary.total_balance)}</div>
        </div>
      )}
      {summary.count !== undefined && (
        <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm border-r-4 border-r-gray-500">
          <div className="text-sm text-gray-500 mb-1">{type === 'partners' ? 'عدد الشركاء النشطين' : 'العدد'}</div>
          <div className="text-xl font-bold text-gray-800">{summary.count}</div>
        </div>
      )}
    </div>
  );
};

export default ReportSummary;
