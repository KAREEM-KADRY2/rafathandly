import React, { useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Calculator, ChevronDown, ChevronUp, AlertTriangle,
  Loader2, Calendar, FileText, BarChart2, X, RefreshCw
} from 'lucide-react';
import api from '../api';

// =============================================
// مساعدات التنسيق
// =============================================
const fmt = (n) => {
  if (n === null || n === undefined) return '-';
  return Number(n).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

// =============================================
// بطاقة الملخص
// =============================================
function SummaryCard({ label, value, color, icon: Icon, sub }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  const iconColors = {
    blue: 'text-blue-500',
    red: 'text-red-500',
    orange: 'text-orange-500',
    green: 'text-green-600',
    purple: 'text-purple-500',
    emerald: 'text-emerald-600',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]} flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium opacity-80">{label}</p>
        {Icon && <Icon size={20} className={iconColors[color]} />}
      </div>
      <p className="text-2xl font-bold" dir="ltr">
        {value === null ? (
          <span className="text-sm font-normal opacity-60">غير محددة</span>
        ) : (
          <>{fmt(value)} <span className="text-base font-normal">ج.م</span></>
        )}
      </p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

// =============================================
// موديال تفاصيل التصفية
// =============================================
function ProfitDetailsModal({ data, onClose }) {
  const { summary, saleDetails, expenseDetails } = data;
  const [activeTab, setActiveTab] = useState('sales');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl" dir="rtl">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-l from-emerald-50 to-green-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart2 size={22} className="text-emerald-600" />
              تفاصيل حساب صافي الربح
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {data.period?.start_date && `من ${fmtDate(data.period.start_date)}`}
              {data.period?.end_date && data.period.end_date !== data.period.start_date && ` إلى ${fmtDate(data.period.end_date)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={22} className="text-gray-500" />
          </button>
        </div>

        {/* Summary row */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 grid grid-cols-5 gap-3 text-center text-sm">
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="text-blue-600 font-bold text-base">{fmt(summary.totalSales)} ج.م</div>
            <div className="text-blue-500 text-xs">إجمالي المبيعات</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <div className="text-orange-600 font-bold text-base">{fmt(summary.totalCOGS)} ج.م</div>
            <div className="text-orange-500 text-xs">تكلفة البضاعة</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2">
            <div className="text-emerald-600 font-bold text-base">{fmt(summary.grossProfit)} ج.م</div>
            <div className="text-emerald-500 text-xs">إجمالي الربح</div>
          </div>
          <div className="bg-red-50 rounded-lg p-2">
            <div className="text-red-600 font-bold text-base">{fmt(summary.totalExpenses)} ج.م</div>
            <div className="text-red-500 text-xs">المصروفات</div>
          </div>
          <div className={`rounded-lg p-2 ${summary.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <div className={`font-bold text-base ${summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(summary.netProfit)} ج.م
            </div>
            <div className={`text-xs ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>صافي الربح</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-5 gap-1">
          {[
            { id: 'sales', label: 'تفاصيل الفواتير', count: saleDetails?.length },
            { id: 'expenses', label: 'تفاصيل المصروفات', count: expenseDetails?.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="mr-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {activeTab === 'sales' && (
            <div className="space-y-4">
              {saleDetails?.length === 0 ? (
                <div className="text-center py-10 text-gray-400">لا توجد فواتير في هذه الفترة</div>
              ) : (
                saleDetails?.map((sale) => (
                  <SaleDetailCard key={sale.sale_id} sale={sale} />
                ))
              )}

              {/* Service & Product Breakdown */}
              <div className="mb-4 bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                <h4 className="font-bold text-indigo-900 mb-3">تفاصيل المبيعات والأرباح (منتجات / خدمات)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="font-bold text-blue-800 mb-1 border-b border-blue-200 pb-1">المنتجات</div>
                    <div className="flex justify-between mb-1"><span>المبيعات:</span> <strong>{fmt(summary.totalProductSales || 0)}</strong></div>
                    <div className="flex justify-between mb-1"><span>التكلفة:</span> <strong>{fmt(summary.totalProductCOGS || 0)}</strong></div>
                    <div className="flex justify-between text-blue-600"><span>الربح:</span> <strong>{fmt(summary.productProfit || 0)}</strong></div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                    <div className="font-bold text-purple-800 mb-1 border-b border-purple-200 pb-1">الخدمات</div>
                    <div className="flex justify-between mb-1"><span>المبيعات:</span> <strong>{fmt(summary.totalServiceSales || 0)}</strong></div>
                    <div className="flex justify-between mb-1"><span>التكلفة:</span> <strong>{fmt(summary.totalServiceCOGS || 0)}</strong></div>
                    <div className="flex justify-between text-purple-600"><span>الربح:</span> <strong>{fmt(summary.serviceProfit || 0)}</strong></div>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    <div className="font-bold text-emerald-800 mb-1 border-b border-emerald-200 pb-1">الإجمالي (قبل المصروفات)</div>
                    <div className="flex justify-between mb-1"><span>المبيعات:</span> <strong>{fmt(summary.totalSales || 0)}</strong></div>
                    <div className="flex justify-between mb-1"><span>التكلفة:</span> <strong>{fmt(summary.totalCOGS || 0)}</strong></div>
                    <div className="flex justify-between text-emerald-600"><span>الربح:</span> <strong>{fmt(summary.grossProfit || 0)}</strong></div>
                  </div>
                </div>
              </div>

              {/* Totals row */}
              {saleDetails?.length > 0 && (
                <div className="border-t-2 border-gray-200 pt-4 bg-gray-50 rounded-xl p-4">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-sm text-gray-500">إجمالي المبيعات</div>
                      <div className="font-bold text-blue-700">{fmt(summary.totalSales)} ج.م</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">إجمالي التكلفة</div>
                      <div className="font-bold text-orange-700">{fmt(summary.totalCOGS)} ج.م</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">إجمالي الربح</div>
                      <div className="font-bold text-emerald-700">{fmt(summary.grossProfit)} ج.م</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">المصروفات</div>
                      <div className="font-bold text-red-700">{fmt(summary.totalExpenses)} ج.م</div>
                    </div>
                  </div>
                  <div className={`mt-4 text-center p-3 rounded-lg ${summary.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <span className="text-sm font-medium text-gray-600">صافي الربح النهائي: </span>
                    <span className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(summary.netProfit)} ج.م
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'expenses' && (
            <div>
              {expenseDetails?.length === 0 ? (
                <div className="text-center py-10 text-gray-400">لا توجد مصروفات في هذه الفترة</div>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="p-3 font-semibold">الفئة</th>
                      <th className="p-3 font-semibold">البيان</th>
                      <th className="p-3 font-semibold">التاريخ</th>
                      <th className="p-3 font-semibold">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenseDetails?.map((exp, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            exp.category === 'مصروفات مركبات' ? 'bg-orange-100 text-orange-700' :
                            exp.category === 'مسحوبات عمال' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {exp.category}
                          </span>
                        </td>
                        <td className="p-3 text-gray-700">
                          {exp.name}
                          {exp.vehicle && exp.vehicle !== '' && (
                            <span className="text-gray-400 text-xs mr-1">({exp.vehicle})</span>
                          )}
                          {exp.description && <div className="text-xs text-gray-400">{exp.description}</div>}
                        </td>
                        <td className="p-3 text-gray-500">{fmtDate(exp.date)}</td>
                        <td className="p-3 font-bold text-red-600" dir="ltr">{fmt(exp.amount)} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={3} className="p-3 font-bold text-gray-700">إجمالي المصروفات</td>
                      <td className="p-3 font-bold text-red-700" dir="ltr">{fmt(summary.totalExpenses)} ج.م</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
// بطاقة تفاصيل الفاتورة
// =============================================
function SaleDetailCard({ sale }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex justify-between items-center p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm">#{sale.invoice_number}</span>
          <span className="font-medium text-gray-800">{sale.customer_name}</span>
          <span className="text-xs text-gray-400">{fmtDate(sale.sale_date)}</span>
          {sale.has_missing_cost && (
            <span className="flex items-center gap-1 text-amber-600 text-xs bg-amber-50 px-2 py-0.5 rounded-full">
              <AlertTriangle size={11} />
              تكلفة ناقصة
            </span>
          )}
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-gray-500">
            بيع: <span className="font-bold text-blue-700" dir="ltr">{fmt(sale.total_selling)} ج.م</span>
          </div>
          <div className="text-gray-500">
            تكلفة: <span className="font-bold text-orange-700" dir="ltr">{fmt(sale.total_cost)} ج.م</span>
          </div>
          <div className="text-gray-500">
            ربح: <span className={`font-bold ${sale.gross_profit === null ? 'text-gray-400' : sale.gross_profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`} dir="ltr">
              {sale.gross_profit === null ? '؟' : `${fmt(sale.gross_profit)} ج.م`}
            </span>
          </div>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {expanded && (
        <div className="p-3">
          <table className="w-full text-sm text-right">
            <thead className="text-gray-500 border-b border-gray-100">
              <tr>
                <th className="py-2 px-2 font-medium">المنتج</th>
                <th className="py-2 px-2 font-medium">الكمية</th>
                <th className="py-2 px-2 font-medium">سعر البيع</th>
                <th className="py-2 px-2 font-medium">إجمالي البيع</th>
                <th className="py-2 px-2 font-medium">سعر التكلفة</th>
                <th className="py-2 px-2 font-medium">إجمالي التكلفة</th>
                <th className="py-2 px-2 font-medium">الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sale.items?.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-2 px-2 font-medium text-gray-800">{item.item_name}</td>
                  <td className="py-2 px-2 text-gray-600">{item.quantity} {item.unit}</td>
                  <td className="py-2 px-2 text-blue-700" dir="ltr">{fmt(item.selling_price)}</td>
                  <td className="py-2 px-2 font-bold text-blue-700" dir="ltr">{fmt(item.selling_total)} ج.م</td>
                  <td className="py-2 px-2 text-orange-600" dir="ltr">
                    {item.has_cost ? fmt(item.cost_price) : (
                      <span className="text-amber-600 text-xs bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                        <AlertTriangle size={10} />
                        {item.note}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2 font-bold text-orange-600" dir="ltr">
                    {item.has_cost ? `${fmt(item.cost_total)} ج.م` : '-'}
                  </td>
                  <td className="py-2 px-2 font-bold" dir="ltr">
                    {item.item_profit === null ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <span className={item.item_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                        {fmt(item.item_profit)} ج.م
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================
// موديال تصفية اليوم
// =============================================
function DailyClosingModal({ closing, onClose }) {
  if (!closing) return null;
  const netPositive = closing.net_profit >= 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" dir="rtl">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-l from-indigo-50 to-blue-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-800">تصفية اليوم</h2>
            <p className="text-sm text-gray-500">{fmtDate(closing.date)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
            <X size={22} className="text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label: 'إجمالي المبيعات', val: closing.total_sales, color: 'text-blue-700', bold: true },
            { label: '  • مبيعات نقدية', val: closing.cash_sales, color: 'text-blue-600', indent: true },
            { label: '  • مبيعات آجلة', val: closing.credit_sales, color: 'text-indigo-600', indent: true },
            { label: 'تحصيلات من العملاء (نقدية)', val: closing.customer_collections, color: 'text-emerald-700' },
            { label: '─── المصروفات ───', divider: true },
            { label: 'إجمالي المصروفات', val: closing.total_expenses, color: 'text-red-700', bold: true },
            { label: '  • مصروفات مركبات', val: closing.expense_breakdown?.vehicle_expenses, color: 'text-red-500', indent: true },
            { label: '  • مسحوبات عمال', val: closing.expense_breakdown?.worker_withdrawals, color: 'text-red-500', indent: true },
            { label: '  • مصروفات أخرى', val: closing.expense_breakdown?.other_expenses, color: 'text-red-500', indent: true },
            { label: 'دفعيات الموردين', val: closing.supplier_payments, color: 'text-orange-600' },
            { label: '─── الأرباح ───', divider: true },
            { label: 'إجمالي الربح (قبل المصروفات)', val: closing.gross_profit, color: 'text-emerald-600', bold: true },
            { label: 'صافي الربح', val: closing.net_profit, color: closing.net_profit >= 0 ? 'text-green-700' : 'text-red-700', big: true },
          ].map((row, i) => (
            row.divider ? (
              <div key={i} className="text-center text-gray-400 text-xs font-medium py-1 border-t border-dashed border-gray-200 pt-2">{row.label}</div>
            ) : (
              <div key={i} className={`flex justify-between items-center py-1 ${row.indent ? 'opacity-75' : ''}`}>
                <span className={`text-sm ${row.bold ? 'font-bold text-gray-800' : 'text-gray-600'} ${row.indent ? 'mr-4' : ''}`}>{row.label}</span>
                <span className={`font-${row.big ? 'extrabold text-xl' : row.bold ? 'bold' : 'medium'} ${row.color}`} dir="ltr">
                  {fmt(row.val)} ج.م
                </span>
              </div>
            )
          ))}

          <div className={`mt-4 p-4 rounded-xl text-center ${netPositive ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="text-sm text-gray-600 mb-1">صافي الربح النهائي ليوم {fmtDate(closing.date)}</div>
            <div className={`text-3xl font-black ${netPositive ? 'text-green-700' : 'text-red-700'}`} dir="ltr">
              {fmt(closing.net_profit)} ج.م
            </div>
            <div className="text-xs text-gray-400 mt-1">
              ملاحظة: المبيعات الآجلة تُحسب كإيراد حتى لو لم تُحصَّل بعد
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// المكون الرئيسي: قسم صافي الربح
// =============================================
export default function NetProfitSection() {
  const [period, setPeriod] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showDailyClosing, setShowDailyClosing] = useState(false);

  const periodLabels = {
    today: 'اليوم',
    week: 'هذا الأسبوع',
    month: 'هذا الشهر',
    year: 'هذه السنة',
    custom: 'فترة مخصصة',
  };

  const calcProfit = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const params = {};

      if (period === 'custom') {
        if (!customFrom || !customTo) {
          setError('يرجى تحديد تاريخ البداية والنهاية');
          setLoading(false);
          return;
        }
        params.start_date = customFrom;
        params.end_date = customTo;
      } else {
        params.period = period;
      }

      const res = await api.get('/reports/profit', { params });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء حساب الأرباح');
    } finally {
      setLoading(false);
    }
  };

  const summary = data?.summary;
  const hasDailyClosing = data?.dailyClosing !== null && data?.dailyClosing !== undefined;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" dir="rtl">
      {/* ─── Header ─── */}
      <div className="p-5 border-b border-gray-100 bg-gradient-to-l from-emerald-50 to-green-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <TrendingUp size={22} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">صافي الربح / تصفية الأرباح</h2>
              <p className="text-xs text-gray-500">حساب حقيقي متصل بقاعدة البيانات</p>
            </div>
          </div>
          {data && (
            <button
              onClick={calcProfit}
              className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
              تحديث
            </button>
          )}
        </div>
      </div>

      {/* ─── Period Selector ─── */}
      <div className="p-5 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-600 mb-3">اختر الفترة الزمنية:</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(periodLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                period === key
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">من تاريخ</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">إلى تاريخ</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400 outline-none"
              />
            </div>
          </div>
        )}

        <button
          onClick={calcProfit}
          disabled={loading}
          className="mt-4 bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> جاري الحساب...</>
          ) : (
            <><Calculator size={18} /> حساب صافي الربح</>
          )}
        </button>

        {error && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
      </div>

      {/* ─── Results ─── */}
      {data && summary && (
        <div className="p-5 space-y-5">
          {/* Period label */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar size={16} />
            <span>
              الفترة: <strong className="text-gray-800">{periodLabels[period]}</strong>
              {data.period?.start_date && (
                <span className="mr-2">
                  ({fmtDate(data.period.start_date)}
                  {data.period.end_date && data.period.end_date !== data.period.start_date && ` ← ${fmtDate(data.period.end_date)}`})
                </span>
              )}
            </span>
            <span className="mr-2 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {summary.invoiceCount} فاتورة
            </span>
            {summary.itemsWithNoCost > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={11} />
                {summary.itemsWithNoCost} عنصر بدون تكلفة شراء
              </span>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <SummaryCard
              label="إجمالي المبيعات"
              value={summary.totalSales}
              color="blue"
              icon={ShoppingCart}
              sub={`${summary.invoiceCount} فاتورة`}
            />
            <SummaryCard
              label="تكلفة البضاعة المباعة"
              value={summary.totalCOGS}
              color="orange"
              icon={DollarSign}
              sub="من سجلات الشراء الحقيقية"
            />
            <SummaryCard
              label="إجمالي الربح"
              value={summary.grossProfit}
              color="emerald"
              icon={TrendingUp}
              sub="المبيعات - التكلفة"
            />
            <SummaryCard
              label="المصروفات"
              value={summary.totalExpenses}
              color="red"
              icon={TrendingDown}
              sub={`مركبات + عمال + أخرى`}
            />
            <SummaryCard
              label="صافي الربح"
              value={summary.netProfit}
              color={summary.netProfit >= 0 ? 'green' : 'red'}
              icon={summary.netProfit >= 0 ? TrendingUp : TrendingDown}
              sub="الربح الإجمالي - المصروفات"
            />
          </div>

          {/* Expenses breakdown */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <h3 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
              <TrendingDown size={16} />
              تفصيل المصروفات
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500">مصروفات مركبات</div>
                <div className="font-bold text-red-600 mt-1" dir="ltr">{fmt(summary.expenseBreakdown?.vehicleExpenses)} ج.م</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500">مسحوبات عمال</div>
                <div className="font-bold text-red-600 mt-1" dir="ltr">{fmt(summary.expenseBreakdown?.workerWithdrawals)} ج.م</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500">مصروفات أخرى</div>
                <div className="font-bold text-red-600 mt-1" dir="ltr">{fmt(summary.expenseBreakdown?.otherExpenses)} ج.م</div>
              </div>
            </div>
          </div>

          {/* Sales breakdown */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <h3 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
              <ShoppingCart size={16} />
              تفصيل المبيعات
            </h3>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500">إجمالي الفواتير</div>
                <div className="font-bold text-blue-700 mt-1" dir="ltr">{fmt(summary.totalSales)} ج.م</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500">المحصّل</div>
                <div className="font-bold text-emerald-700 mt-1" dir="ltr">{fmt(summary.totalPaid)} ج.م</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500">المتبقي (ديون)</div>
                <div className="font-bold text-red-600 mt-1" dir="ltr">{fmt(summary.totalOutstanding)} ج.م</div>
              </div>
              <div className="bg-white rounded-lg p-3">
                <div className="text-xs text-gray-500">الزارة (خصومات)</div>
                <div className="font-bold text-gray-600 mt-1" dir="ltr">{fmt(summary.totalZara)} ج.م</div>
              </div>
            </div>
          </div>

          {/* Net Profit highlight */}
          <div className={`rounded-2xl p-5 text-center border-2 ${
            summary.netProfit >= 0
              ? 'bg-gradient-to-l from-green-50 to-emerald-50 border-green-200'
              : 'bg-gradient-to-l from-red-50 to-rose-50 border-red-200'
          }`}>
            <div className="text-sm text-gray-500 mb-2">صافي الربح {periodLabels[period]}</div>
            <div className={`text-4xl font-black ${summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`} dir="ltr">
              {fmt(summary.netProfit)} ج.م
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {fmt(summary.totalSales)} − {fmt(summary.totalCOGS)} − {fmt(summary.totalExpenses)} = {fmt(summary.netProfit)} ج.م
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowDetails(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-medium transition-colors border border-indigo-200"
            >
              <FileText size={16} />
              عرض تفاصيل الربح
            </button>
            {hasDailyClosing && (
              <button
                onClick={() => setShowDailyClosing(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-sm font-medium transition-colors border border-purple-200"
              >
                <Calendar size={16} />
                تصفية اليوم
              </button>
            )}
          </div>

          {/* Warning if missing costs */}
          {summary.itemsWithNoCost > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">تنبيه: {summary.itemsWithNoCost} عنصر بدون سعر تكلفة</p>
                <p className="text-xs text-amber-600 mt-1">
                  بعض المنتجات المباعة لا يوجد لها سجل شراء في قاعدة البيانات. تكلفة البضاعة المباعة المحسوبة هي جزئية فقط وتكلفة هذه العناصر لم تُحتسب. يرجى التحقق من سجلات الشراء.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showDetails && data && (
        <ProfitDetailsModal data={data} onClose={() => setShowDetails(false)} />
      )}
      {showDailyClosing && data?.dailyClosing && (
        <DailyClosingModal closing={data.dailyClosing} onClose={() => setShowDailyClosing(false)} />
      )}
    </div>
  );
}

