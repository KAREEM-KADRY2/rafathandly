import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Filter, CheckCircle, Printer, XCircle, AlertTriangle, Users, List, Edit3, Trash2 } from 'lucide-react';
import api from '../api';
import NewSaleModal from '../components/NewSaleModal';
import SaleDetailsModal from '../components/SaleDetailsModal';
import EditSaleModal from '../components/EditSaleModal';
import PaymentModal from '../components/PaymentModal';
import NetProfitSection from '../components/NetProfitSection';

function CustomerTransactionsModal({ customerId, customerName, onClose, onOpenDetails }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSale, setEditingSale] = useState(null);

  const handleDeleteSale = async (saleId, invoiceNum) => {
    const invLabel = invoiceNum ? `رقم ${invoiceNum}` : `رقم #${saleId}`;
    if (!window.confirm(`هل أنت متأكد من حذف / إلغاء الفاتورة ${invLabel}؟\n\n- سيتم إرجاع البضاعة إلى رصيد المخزن.\n- سيتم إلغاء أثر أي مدفوعات مسجلة على الفاتورة من الخزينة.\n- سيتم خصم مديونية الفاتورة من كشف حساب العميل ورصيده الإجمالي.`)) {
      return;
    }

    try {
      await api.delete(`/sales/${saleId}`);
      alert(`تم حذف وإلغاء الفاتورة ${invLabel} بنجاح وتحديث كافة الحسابات والمخزن.`);
      await fetchTransactions();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء إلغاء الفاتورة');
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchTransactions();
    }
  }, [customerId]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/sales/customer/${customerId}`);
      setTransactions(Array.isArray(res.data) ? res.data : (res.data?.transactions || []));
    } catch (error) {
      console.error('Error fetching customer transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">مكتمل / مسدد</span>;
      case 'PARTIALLY_PAID': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">مدفوع جزئياً</span>;
      case 'CONFIRMED': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">مؤكد</span>;
      case 'OVERDUE': return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"><AlertTriangle size={12}/> متأخر</span>;
      case 'CANCELLED': return <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">ملغي</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{status}</span>;
    }
  };

  const totalSales = transactions.reduce((sum, t) => sum + (t.original_amount || 0), 0);
  const totalPaid = transactions.reduce((sum, t) => sum + (t.paid_amount || 0), 0);
  const totalRemaining = transactions.reduce((sum, t) => sum + (t.remaining_amount || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" dir="rtl">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">تعاملات العميل: {customerName}</h2>
            <p className="text-sm text-gray-500 mt-1">عرض جميع فواتير وحركات العميل</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <XCircle className="text-gray-500" size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500">عدد الفواتير</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{transactions.length}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
              <p className="text-sm text-blue-600">إجمالي المسحوبات</p>
              <p className="text-xl font-bold text-blue-800 mt-1" dir="ltr">{totalSales.toLocaleString()} ج.م</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
              <p className="text-sm text-emerald-600">إجمالي المدفوعات</p>
              <p className="text-xl font-bold text-emerald-800 mt-1" dir="ltr">{totalPaid.toLocaleString()} ج.م</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
              <p className="text-sm text-red-600">المتبقي (المديونية)</p>
              <p className="text-xl font-bold text-red-800 mt-1" dir="ltr">{totalRemaining.toLocaleString()} ج.م</p>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500">جاري تحميل المعاملات...</div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">لا توجد معاملات لهذا العميل</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="p-4 font-semibold text-sm">رقم الفاتورة</th>
                    <th className="p-4 font-semibold text-sm">التاريخ</th>
                    <th className="p-4 font-semibold text-sm">النوع</th>
                    <th className="p-4 font-semibold text-sm">الإجمالي</th>
                    <th className="p-4 font-semibold text-sm">المدفوع</th>
                    <th className="p-4 font-semibold text-sm">المتبقي</th>
                    <th className="p-4 font-semibold text-sm">الحالة</th>
                    <th className="p-4 font-semibold text-sm">الملاحظات</th>
                    <th className="p-4 font-semibold text-sm text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium">#{t.invoice_number || t.id}</td>
                      <td className="p-4 text-gray-600 text-sm">{t.sale_date}</td>
                      <td className="p-4 text-sm">{t.sale_type === 'cash' ? 'نقدي' : 'آجل'}</td>
                      <td className="p-4 font-bold" dir="ltr">{t.original_amount?.toLocaleString()} ج.م</td>
                      <td className="p-4 text-emerald-600" dir="ltr">{t.paid_amount?.toLocaleString()} ج.م</td>
                      <td className="p-4 text-red-600 font-bold" dir="ltr">{t.remaining_amount?.toLocaleString()} ج.م</td>
                      <td className="p-4">{getStatusBadge(t.computed_status)}</td>
                      <td className="p-4 text-xs text-slate-700 min-w-[150px] max-w-[260px]">
                        {t.notes ? (
                          <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg block break-words whitespace-pre-wrap leading-relaxed font-medium">
                            {t.notes}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onOpenDetails(t)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                          >
                            <Eye size={16} />
                            <span>عرض التفاصيل</span>
                          </button>
                          {t.status !== 'CANCELLED' ? (
                            <>
                              <button
                                onClick={() => setEditingSale(t)}
                                className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                              >
                                <Edit3 size={16} />
                                <span>تعديل</span>
                              </button>
                              <button
                                onClick={() => handleDeleteSale(t.id, t.invoice_number)}
                                className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
                                title="حذف / إلغاء الفاتورة"
                              >
                                <Trash2 size={16} />
                                <span>حذف</span>
                              </button>
                            </>
                          ) : (
                            <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded text-xs font-bold border border-rose-200">
                              ملغاة
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingSale && (
        <EditSaleModal
          isOpen={!!editingSale}
          onClose={() => setEditingSale(null)}
          sale={editingSale}
          onSuccess={() => {
            setEditingSale(null);
            fetchTransactions();
          }}
        />
      )}
    </div>
  );
}

export default function SalesList() {
  const [groupedSales, setGroupedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchGroupedSales();
  }, [dateFrom, dateTo, filterType, filterStatus]);

  const fetchGroupedSales = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sales/grouped', {
        params: {
          dateFrom,
          dateTo,
          filterType,
          filterStatus
        }
      });
      setGroupedSales(Array.isArray(res.data) ? res.data : (res.data?.groups || []));
    } catch (error) {
      console.error('Error fetching grouped sales:', error);
      setGroupedSales([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTransactions = (customer) => {
    setSelectedCustomer(customer);
    setIsTransactionsModalOpen(true);
  };

  const handleOpenSaleDetails = (sale) => {
    setSelectedSale(sale);
    setIsDetailsModalOpen(true);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Local search filter
  const searchLower = (searchTerm || '').toLowerCase();
  const filteredGroups = (Array.isArray(groupedSales) ? groupedSales : []).filter(g => 
    !searchLower ||
    (g.customer_name || '').toLowerCase().includes(searchLower) ||
    (g.customer_phone || '').includes(searchLower)
  );

  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage) || 1;
  const paginatedGroups = filteredGroups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalSales = filteredGroups.reduce((acc, g) => acc + (g.total_sales || 0), 0);

  const totalCashSales = filteredGroups.reduce((acc, g) => acc + (g.total_cash_sales || 0), 0);
  const totalCreditSales = filteredGroups.reduce((acc, g) => acc + (g.total_credit_sales || 0), 0);
  const totalPaid = filteredGroups.reduce((acc, g) => acc + (g.total_paid || 0), 0);
  const totalRemaining = filteredGroups.reduce((acc, g) => acc + (g.total_remaining || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header section */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">المبيعات المجمعة</h1>
          <p className="text-gray-500 mt-1">عرض وإدارة فواتير المبيعات مجمعة حسب العميل</p>
        </div>
        <button
          onClick={() => setIsNewModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 font-medium shadow-sm shadow-blue-200"
        >
          <Plus size={20} />
          <span>فاتورة بيع جديدة</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">عدد العملاء</p>
          <p className="text-xl font-bold text-gray-800">{filteredGroups.length}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100">
          <p className="text-sm text-blue-600 mb-1">إجمالي مبيعات الآجل</p>
          <p className="text-xl font-bold text-blue-800" dir="ltr">{totalCreditSales.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-100">
          <p className="text-sm text-emerald-600 mb-1">إجمالي مبيعات النقدي</p>
          <p className="text-xl font-bold text-emerald-800" dir="ltr">{totalCashSales.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-indigo-50 p-4 rounded-xl shadow-sm border border-indigo-100">
          <p className="text-sm text-indigo-600 mb-1">إجمالي التحصيلات</p>
          <p className="text-xl font-bold text-indigo-800" dir="ltr">{totalPaid.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100">
          <p className="text-sm text-red-600 mb-1">المتبقي (ديون خارجية)</p>
          <p className="text-xl font-bold text-red-800" dir="ltr">{totalRemaining.toLocaleString()} ج.م</p>
        </div>
      </div>

      {/* Filters section */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4 text-gray-700">
          <Filter size={20} />
          <h3 className="font-bold">تصفية وبحث</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
              <input type="text" placeholder="بحث باسم العميل..." className="w-full border p-2 pr-10 rounded-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div>
            <select className="w-full border p-2 rounded-lg" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">كل أنواع الفواتير</option>
              <option value="cash">نقدي</option>
              <option value="credit">آجل</option>
            </select>
          </div>
          <div>
            <select className="w-full border p-2 rounded-lg" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="PAID">مكتمل / مسدد</option>
              <option value="PARTIALLY_PAID">مدفوع جزئياً</option>
              <option value="CONFIRMED">مؤكد</option>
              <option value="OVERDUE">متأخر</option>
              <option value="CANCELLED">ملغي</option>
            </select>
          </div>
          <div>
            <input type="date" className="w-full border p-2 rounded-lg text-sm" placeholder="من تاريخ" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <input type="date" className="w-full border p-2 rounded-lg text-sm" placeholder="إلى تاريخ" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              جاري تحميل بيانات العملاء...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
              <Users size={48} className="text-gray-300 mb-4" />
              <p className="text-lg">لا يوجد عملاء مطابقين للبحث</p>
            </div>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="p-4 font-semibold text-sm">العميل</th>
                  <th className="p-4 font-semibold text-sm">الهاتف</th>
                  <th className="p-4 font-semibold text-sm text-center">عدد الفواتير</th>
                  <th className="p-4 font-semibold text-sm">إجمالي المسحوبات</th>
                  <th className="p-4 font-semibold text-sm">المدفوع</th>
                  <th className="p-4 font-semibold text-sm">المتبقي</th>
                  <th className="p-4 font-semibold text-sm text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedGroups.map(group => (
                  <tr key={group.customer_id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-800">{group.customer_name}</td>
                    <td className="p-4 text-sm text-gray-600">{group.customer_phone || '-'}</td>
                    <td className="p-4 text-center">
                      <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                        {group.transactions_count}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-800" dir="ltr">{(group.total_sales || 0).toLocaleString()} ج.م</td>
                    <td className="p-4 font-bold text-emerald-600" dir="ltr">{(group.total_paid || 0).toLocaleString()} ج.م</td>
                    <td className="p-4 font-bold text-red-600" dir="ltr">{(group.total_remaining || 0).toLocaleString()} ج.م</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleOpenTransactions(group)}
                        className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors inline-flex items-center gap-2"
                      >
                        <List size={16} />
                        <span>عرض التعاملات</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center text-sm font-semibold">
            <span className="text-gray-600">
              عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredGroups.length)} من إجمالي {filteredGroups.length} عميل
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                السابق
              </button>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded font-bold">
                صفحة {currentPage} من {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>


      {/* ─────────────────────────────────────────────────── */}
      {/* قسم صافي الربح / تصفية الأرباح                      */}
      {/* ─────────────────────────────────────────────────── */}
      <NetProfitSection />

      {isNewModalOpen && (
        <NewSaleModal
          onClose={() => setIsNewModalOpen(false)}
          onSuccess={() => {
            setIsNewModalOpen(false);
            fetchGroupedSales();
          }}
        />
      )}

      {isTransactionsModalOpen && selectedCustomer && (
        <CustomerTransactionsModal
          customerId={selectedCustomer.customer_id}
          customerName={selectedCustomer.customer_name}
          onClose={() => {
            setIsTransactionsModalOpen(false);
            fetchGroupedSales();
          }}
          onOpenDetails={handleOpenSaleDetails}
        />
      )}

      {isDetailsModalOpen && selectedSale && (
        <SaleDetailsModal
          saleId={selectedSale.id}
          onClose={() => {
            setIsDetailsModalOpen(false);
            // Optionally refresh parent modal data if payment was made inside details
          }}
        />
      )}
    </div>
  );
}
