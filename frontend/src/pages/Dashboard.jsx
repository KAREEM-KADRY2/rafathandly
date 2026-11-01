import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, 
  Wallet, AlertCircle, ShoppingCart, Truck, Activity,
  Clock, CheckCircle, AlertTriangle
} from 'lucide-react';
import api from '../api';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/dashboard/summary');
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء تحميل بيانات لوحة التحكم');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Cairo' };
    return new Date().toLocaleDateString('ar-EG', options);
  };

  const formatCurrency = (amount) => {
    const val = Number(amount);
    if (isNaN(val) || amount === undefined || amount === null) return '0.00 ج.م';
    return val.toLocaleString('en-US') + ' ج.م';
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Activity className="animate-spin mb-4" size={32} />
        <p>جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <AlertTriangle size={48} className="mb-4" />
        <p className="text-lg mb-4">{error}</p>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!data) return null;

  const todaySummary = data?.todaySummary || {};
  const treasury = data?.treasury || {};
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
  const recentOperations = Array.isArray(data?.recentOperations) ? data.recentOperations : [];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">الصفحة الرئيسية</h1>
          <p className="text-gray-500 mt-1">{formatDate()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Today's Summary & Treasury (span 2 on large screens) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. ملخص اليوم */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Activity className="text-blue-600" size={20} />
              <h2 className="text-lg font-bold text-gray-800">ملخص اليوم</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Sales (Accrual) */}
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                  <p className="text-sm text-blue-600 font-medium mb-1 flex items-center gap-1">
                    <TrendingUp size={16} /> إجمالي المبيعات
                  </p>
                  <p className="text-2xl font-bold text-blue-900" dir="ltr">{formatCurrency(todaySummary.sales)}</p>
                </div>
                {/* Collections (Cash In) */}
                <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-sm text-green-600 font-medium mb-1 flex items-center gap-1">
                    <DollarSign size={16} /> التحصيل
                  </p>
                  <p className="text-2xl font-bold text-green-900" dir="ltr">{formatCurrency(todaySummary.collections)}</p>
                </div>
                {/* Net Cash Flow */}
                <div className={`p-4 rounded-lg border ${todaySummary.netCashMovement >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                  <p className={`text-sm font-medium mb-1 flex items-center gap-1 ${todaySummary.netCashMovement >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {todaySummary.netCashMovement >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} 
                    صافي حركة النقدية
                  </p>
                  <p className={`text-2xl font-bold ${todaySummary.netCashMovement >= 0 ? 'text-emerald-900' : 'text-red-900'}`} dir="ltr">
                    {formatCurrency(todaySummary.netCashMovement)}
                  </p>
                </div>
                {/* Purchases (Accrual) */}
                <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                  <p className="text-sm text-purple-600 font-medium mb-1 flex items-center gap-1">
                    <ShoppingCart size={16} /> إجمالي المشتريات
                  </p>
                  <p className="text-2xl font-bold text-purple-900" dir="ltr">{formatCurrency(todaySummary.purchases)}</p>
                </div>
                {/* Supplier Payments (Cash Out) */}
                <div className="p-4 rounded-lg bg-orange-50 border border-orange-100">
                  <p className="text-sm text-orange-600 font-medium mb-1 flex items-center gap-1">
                    <Truck size={16} /> مدفوعات الموردين
                  </p>
                  <p className="text-2xl font-bold text-orange-900" dir="ltr">{formatCurrency(todaySummary.supplierPayments)}</p>
                </div>
                {/* Expenses (Cash Out) */}
                <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-sm text-red-600 font-medium mb-1 flex items-center gap-1">
                    <CreditCard size={16} /> المصروفات
                  </p>
                  <p className="text-2xl font-bold text-red-900" dir="ltr">{formatCurrency(todaySummary.expenses)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. الخزنة */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="text-emerald-600" size={20} />
                <h2 className="text-lg font-bold text-gray-800">الخزنة والأرصدة</h2>
              </div>
              <Link to="/treasury" className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                إدارة الخزنة والحسابات ←
              </Link>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {(Array.isArray(treasury.accounts) && treasury.accounts.length > 0 ? treasury.accounts : [
                  { id: 1, name: 'الكاش (الصندوق)', balance: treasury.cash },
                  { id: 2, name: 'CIB', balance: 0 },
                  { id: 3, name: 'البنك الأهلي', balance: treasury.nbe },
                  { id: 4, name: 'بنك مصر', balance: treasury.bankMisr },
                  { id: 5, name: 'المحافظ الإلكترونية', balance: treasury.wallets },
                ]).map(acc => (
                  <div key={acc.id || acc.name} className="text-center p-3 border rounded-lg hover:shadow-md transition-shadow bg-gray-50/50">
                    <p className="text-xs font-semibold text-gray-500 mb-1 truncate">{acc.name}</p>
                    <p className={`text-base font-bold ${Number(acc.balance || 0) < 0 ? 'text-red-600' : 'text-gray-800'}`} dir="ltr">
                      {formatCurrency(acc.balance)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800 text-white p-4 rounded-lg flex justify-between items-center">
                <span className="font-bold">إجمالي الرصيد المتاح:</span>
                <span className="text-xl font-bold tracking-wider" dir="ltr">{formatCurrency(treasury.total)}</span>
              </div>
            </div>
          </section>

          {/* 4. آخر العمليات */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="text-indigo-600" size={20} />
                <h2 className="text-lg font-bold text-gray-800">آخر العمليات</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              {recentOperations.length > 0 ? (
                <table className="w-full text-right">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="p-4 font-semibold text-sm">التاريخ</th>
                      <th className="p-4 font-semibold text-sm">العملية</th>
                      <th className="p-4 font-semibold text-sm">البيان</th>
                      <th className="p-4 font-semibold text-sm">المبلغ</th>
                      <th className="p-4 font-semibold text-sm">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOperations.map((op, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-sm text-gray-500 whitespace-nowrap">{op.date}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium inline-block
                            ${op.type === 'بيع' ? 'bg-blue-100 text-blue-700' : ''}
                            ${op.type === 'تحصيل' ? 'bg-green-100 text-green-700' : ''}
                            ${op.type === 'شراء' ? 'bg-purple-100 text-purple-700' : ''}
                            ${op.type === 'دفع مورد' ? 'bg-orange-100 text-orange-700' : ''}
                            ${op.type === 'مصروف' ? 'bg-red-100 text-red-700' : ''}
                            ${!['بيع','تحصيل','شراء','دفع مورد','مصروف'].includes(op.type) ? 'bg-gray-100 text-gray-700' : ''}
                          `}>
                            {op.type}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-800">{op.description}</td>
                        <td className="p-4 font-bold text-gray-800" dir="ltr">{formatCurrency(op.amount)}</td>
                        <td className="p-4">
                          <span className={`flex items-center gap-1 text-xs font-medium
                            ${['active', 'مكتمل'].includes(String(op.status || '').toLowerCase()) ? 'text-green-600' : 'text-gray-500'}
                          `}>
                            {['active', 'مكتمل'].includes(String(op.status || '').toLowerCase()) ? <CheckCircle size={14}/> : <AlertCircle size={14}/>}
                            {String(op.status || '').toLowerCase() === 'active' ? 'نشط' : (op.status || '-')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  لا توجد عمليات مسجلة
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Right Column: Alerts */}
        <div className="space-y-6">
          
          {/* 3. التنبيهات */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto sticky top-6">
            <div className="px-6 py-4 border-b border-gray-100 bg-red-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-red-600" size={20} />
                <h2 className="text-lg font-bold text-red-900">التنبيهات المهمة</h2>
                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full mr-2">
                  {alerts.length}
                </span>
              </div>
              <div className="flex gap-2">
                <a href={`${import.meta.env.VITE_API_URL || '/api'}/reports/overdue/pdf`} target="_blank" rel="noreferrer" className="px-3 py-1 bg-white text-red-700 text-xs font-bold rounded border border-red-200 hover:bg-red-50 transition-colors">
                  تحميل PDF
                </a>
                <a href={`${import.meta.env.VITE_API_URL || '/api'}/reports/overdue/excel`} target="_blank" rel="noreferrer" className="px-3 py-1 bg-white text-green-700 text-xs font-bold rounded border border-green-200 hover:bg-green-50 transition-colors">
                  تحميل Excel
                </a>
              </div>
            </div>
            <div className="p-0 max-h-[800px] overflow-y-auto">
              {alerts.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {alerts.map((alert, i) => (
                    (alert.type === 'overdue_customer' || alert.type === 'due_soon') ? (
                      <Link 
                        key={i} 
                        to={alert.link || '#'} 
                        className={`block p-4 hover:bg-gray-50 transition-colors border-l-4 ${alert.type === 'overdue_customer' ? 'border-red-500' : 'border-orange-400'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            <AlertTriangle size={20} className={alert.type === 'overdue_customer' ? "text-red-600" : "text-orange-500"} />
                          </div>
                          <div className="w-full">
                            <p className={`text-sm font-bold mb-2 flex items-center gap-1 ${alert.type === 'overdue_customer' ? 'text-red-700' : 'text-orange-700'}`}>
                              ⚠ {alert.title}
                            </p>
                            <div className="flex flex-col gap-1 text-sm bg-gray-50 p-3 rounded border border-gray-100">
                              <div className="flex flex-wrap justify-between items-center gap-2">
                                <span className="font-bold text-gray-800 text-base">العميل: {alert.customerName}</span>
                                <span className="text-gray-500 text-xs">فاتورة #{alert.invoiceNumber}</span>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-gray-600">المبلغ المتبقي:</span>
                                <span className="font-bold text-lg text-red-600" dir="ltr">{formatCurrency(alert.remainingAmount)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs mt-1 pt-1 border-t border-gray-200">
                                <span className="text-gray-500">الاستحقاق: <span dir="ltr">{alert.dueDate}</span></span>
                                {alert.overdueDays && (
                                  <span className="text-red-600 font-bold">متأخر: {alert.overdueDays} أيام</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <Link 
                        key={i} 
                        to={alert.link || '#'} 
                        className="block p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 p-1.5 rounded-full shrink-0
                            ${alert.type === 'low_stock' ? 'bg-yellow-100 text-yellow-600' : ''}
                            ${alert.type === 'out_of_stock' ? 'bg-red-100 text-red-600' : ''}
                            ${!['low_stock','out_of_stock'].includes(alert.type) ? 'bg-gray-100 text-gray-600' : ''}
                          `}>
                            <AlertTriangle size={16} />
                          </div>
                          <div>
                            <p className={`text-sm font-bold mb-1
                              ${alert.type === 'out_of_stock' ? 'text-red-700' : 'text-gray-800'}
                            `}>
                              {alert.title}
                            </p>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {alert.message}
                            </p>
                          </div>
                        </div>
                      </Link>
                    )
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                  <p>لا توجد أي تنبيهات حالياً</p>
                  <p className="text-xs mt-1">كل الأمور تسير على ما يرام!</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
