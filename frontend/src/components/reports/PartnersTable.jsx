import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, TrendingDown, RotateCcw, DollarSign, Wallet, Percent, 
  ExternalLink, Eye, ArrowUpRight, ArrowDownLeft, Calendar, FileText
} from 'lucide-react';

const formatCurrency = (val) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(val || 0);

const PartnersTable = ({ data }) => {
  const [activeTab, setActiveTab] = useState('partners'); // 'partners' or 'transactions'
  const [filterPartner, setFilterPartner] = useState('all');

  const partnersList = Array.isArray(data?.partners) ? data.partners : (Array.isArray(data) ? data : []);
  const transactionsList = Array.isArray(data?.transactions) ? data.transactions : [];

  const filteredTransactions = transactionsList.filter(t => {
    if (filterPartner === 'all') return true;
    return String(t.partner_id) === String(filterPartner);
  });

  const getTransactionTypeBadge = (type) => {
    switch (type) {
      case 'withdrawal':
        return (
          <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <ArrowUpRight size={13} /> سحب مسحوبات
          </span>
        );
      case 'withdrawal_return':
        return (
          <span className="px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <RotateCcw size={13} /> رد مسحوبات
          </span>
        );
      case 'capital_contribution':
        return (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <ArrowDownLeft size={13} /> زيادة رأس مال
          </span>
        );
      case 'payment':
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
            <DollarSign size={13} /> دفعة للشركة
          </span>
        );
      case 'profit_distribution':
        return (
          <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
            توزيع أرباح
          </span>
        );
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">{type}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs header */}
      <div className="flex flex-wrap items-center justify-between p-4 bg-gray-50 border-b border-gray-100 gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('partners')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'partners'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <Users size={16} />
            <span>ملخص الشركاء والمسحوبات ({partnersList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'transactions'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <FileText size={16} />
            <span>سجل الحركات التفصيلي ({transactionsList.length})</span>
          </button>
        </div>

        {activeTab === 'transactions' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">تصفية حسب الشريك:</label>
            <select
              value={filterPartner}
              onChange={(e) => setFilterPartner(e.target.value)}
              className="border border-gray-300 rounded-md p-1.5 text-xs bg-white focus:ring-blue-500 font-medium"
            >
              <option value="all">كل الشركاء</option>
              {partnersList.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'partners' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600">الشريك</th>
                <th className="px-4 py-3.5 text-center font-bold text-gray-600">نسبة الشراكة</th>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600">رأس المال</th>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600 text-red-700">إجمالي المسحوبات</th>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600 text-teal-700">المسترد للخزينة</th>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600 text-amber-700">صافي المسحوبات</th>
                <th className="px-4 py-3.5 text-center font-bold text-gray-600">عدد الحركات</th>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600 text-indigo-800">رأس المال المحفوظ (ثابت)</th>
                <th className="px-4 py-3.5 text-center font-bold text-gray-600">الحالة</th>
                <th className="px-4 py-3.5 text-center font-bold text-gray-600">إجراءات</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {partnersList.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3.5 whitespace-nowrap font-bold text-gray-900">
                    <Link to={`/partners/${row.id}`} className="hover:text-blue-600 flex items-center gap-1.5" title="عرض صفحة الشريك">
                      {row.name}
                      <ExternalLink size={13} className="text-gray-400" />
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-center">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-black rounded-lg text-xs border border-blue-100">
                      {row.percentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-right font-semibold text-gray-700" dir="ltr">
                    {formatCurrency(row.capital_contribution)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-right font-bold text-red-600" dir="ltr">
                    {formatCurrency(row.total_withdrawals)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-right font-bold text-teal-600" dir="ltr">
                    {formatCurrency(row.total_returned)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-right font-black text-amber-600 bg-amber-50/40" dir="ltr">
                    {formatCurrency(row.net_withdrawals)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-center text-xs font-semibold text-gray-500">
                    {row.transactions_count || 0} حركة
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-right font-black text-indigo-900" dir="ltr">
                    {formatCurrency(row.current_balance)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {row.is_active ? 'نشط' : 'مؤرشف'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-center">
                    <Link
                      to={`/partners/${row.id}`}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md text-xs font-bold transition-all inline-flex items-center gap-1"
                    >
                      <Eye size={13} />
                      <span>كشف الحساب</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {partnersList.length === 0 && (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-gray-400">
                    لا يوجد شركاء مسجلين
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600">التاريخ</th>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600">الشريك</th>
                <th className="px-4 py-3.5 text-center font-bold text-gray-600">نوع الحركة</th>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600">المبلغ</th>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600">طريقة الدفع / الخزينة</th>
                <th className="px-4 py-3.5 text-right font-bold text-gray-600">البيان والملاحظات</th>
                <th className="px-4 py-3.5 text-center font-bold text-gray-600">الحالة</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((tx, idx) => (
                <tr key={tx.id || idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-600" dir="ltr">
                    {new Date(tx.transaction_date).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-900">
                    {tx.partner_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {getTransactionTypeBadge(tx.transaction_type)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-black" dir="ltr">
                    <span className={tx.transaction_type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}>
                      {tx.transaction_type === 'withdrawal' ? '-' : '+'} {Number(tx.amount || 0).toLocaleString()} ج.م
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                    {tx.account_name ? `${tx.account_name} (${tx.payment_method})` : (tx.payment_method || 'نقدي')}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate" title={tx.description || tx.notes}>
                    {tx.description || tx.notes || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      tx.status === 'cancelled'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {tx.status === 'cancelled' ? 'ملغاة' : 'نشطة'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                    لا توجد حركات مسجلة في هذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PartnersTable;
