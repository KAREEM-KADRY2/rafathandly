import React from 'react';
import { FaMinus, FaEquals } from 'react-icons/fa';

const formatCurrency = (val) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(val || 0);

const ProfitLossView = ({ data }) => {
  if (!data) return <div className="p-8 text-center text-gray-500">لا توجد بيانات للعرض</div>;

  const totalSales = data.total_sales || 0;
  const cogs = data.cogs || 0;
  const grossProfit = data.gross_profit !== undefined ? data.gross_profit : (totalSales - cogs);
  const expenses = data.expenses || 0;
  const netProfit = data.net_profit !== undefined ? data.net_profit : (grossProfit - expenses);
  const breakdown = data.breakdown || {};

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center">
        {/* Sales */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 w-full md:w-48 shadow-sm">
          <div className="text-blue-600 font-bold mb-2">إجمالي المبيعات</div>
          <div className="text-2xl font-black text-gray-800">{formatCurrency(totalSales)}</div>
        </div>

        <FaMinus className="text-gray-400 text-2xl hidden md:block" />

        {/* COGS */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 w-full md:w-48 shadow-sm">
          <div className="text-orange-600 font-bold mb-2">تكلفة البضاعة المباعة</div>
          <div className="text-2xl font-black text-gray-800">{formatCurrency(cogs)}</div>
        </div>

        <FaEquals className="text-gray-400 text-2xl hidden md:block" />

        {/* Gross Profit */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 w-full md:w-48 shadow-sm">
          <div className="text-emerald-600 font-bold mb-2">مجمل الربح</div>
          <div className="text-2xl font-black text-gray-800">{formatCurrency(grossProfit)}</div>
        </div>

        <FaMinus className="text-gray-400 text-2xl hidden md:block" />

        {/* Expenses */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 w-full md:w-48 shadow-sm">
          <div className="text-red-600 font-bold mb-2">إجمالي المصروفات</div>
          <div className="text-2xl font-black text-gray-800">{formatCurrency(expenses)}</div>
        </div>

        <FaEquals className="text-gray-400 text-2xl hidden md:block" />

        {/* Net Profit */}
        <div className="bg-green-100 border-2 border-green-500 rounded-xl p-6 w-full md:w-56 shadow-md transform md:scale-110">
          <div className="text-green-800 font-bold mb-2 text-lg">صافي الربح</div>
          <div className="text-3xl font-black text-green-700">{formatCurrency(netProfit)}</div>
        </div>
      </div>

      {breakdown && (
        <div className="mt-12">
          <h4 className="text-lg font-bold mb-4 border-b pb-2">تفصيل المصروفات</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded border">
              <div className="text-gray-600">مصروفات عامة</div>
              <div className="font-bold text-lg">{formatCurrency(breakdown.general_expenses)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded border">
              <div className="text-gray-600">مسحوبات عمال</div>
              <div className="font-bold text-lg">{formatCurrency(breakdown.worker_withdrawals)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded border">
              <div className="text-gray-600">أخرى</div>
              <div className="font-bold text-lg">{formatCurrency(breakdown.other_expenses)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitLossView;
