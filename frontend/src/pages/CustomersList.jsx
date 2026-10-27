import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone, AlertTriangle, Trash2, Calendar, Share2, FileText, Edit } from 'lucide-react';
import api from '../api';
import AddCustomerModal from '../components/AddCustomerModal';
import EditCustomerModal from '../components/EditCustomerModal';
import WhatsappInvoiceModal from '../components/WhatsappInvoiceModal';
import OpeningBalanceModal from '../components/OpeningBalanceModal';

const safeDate = (d, locale = 'en-GB') => {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString(locale);
  } catch (e) {
    return String(d || '-');
  }
};

export default function CustomersList() {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [whatsappModalCustomer, setWhatsappModalCustomer] = useState(null);
  const [obModalCustomer, setObModalCustomer] = useState(null);

  const fetchCustomers = async (page = currentPage, search = searchTerm) => {
    try {
      const res = await api.get('/customers', {
        params: { page, limit: itemsPerPage, search }
      });
      if (res.data && Array.isArray(res.data.items)) {
        setCustomers(res.data.items);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setCustomers(res.data);
        setTotalCount(res.data.length);
        setTotalPages(Math.ceil(res.data.length / itemsPerPage) || 1);
      } else {
        setCustomers([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
      setTotalCount(0);
      setTotalPages(1);
    }
  };

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchCustomers(currentPage, searchTerm);
      return;
    }
    const timer = setTimeout(() => {
      fetchCustomers(currentPage, searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage, searchTerm]);

  const filteredCustomers = customers;
  const paginatedCustomers = customers;


  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا العميل وجميع مبيعاته وحساباته نهائياً؟')) {
      try {
        await api.delete(`/customers/${id}`);
        fetchCustomers(currentPage, searchTerm);
      } catch (e) {
        alert(e.response?.data?.error || 'حدث خطأ أثناء الحذف');
      }
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">العملاء</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm sm:text-base font-bold shadow-sm"
        >
          <Plus size={18} />
          إضافة عميل
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-lg shadow-sm">
        <div className="relative">
          <input
            type="text"
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full pr-10 pl-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-right"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
        </div>
      </div>

      {/* ===== MOBILE CARDS (hidden on md+) ===== */}
      <div className="flex flex-col gap-3 md:hidden">
        {filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500 shadow-sm">لا يوجد عملاء حتى الآن</div>
        ) : (
          filteredCustomers.map(customer => (
            <div key={customer.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              {/* Name + overdue badge */}
              <div className="flex justify-between items-start mb-3">
                <p className="font-bold text-gray-800 text-base">{customer.name}</p>
                {customer.overdue_sales_count > 0 && (
                  <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    <AlertTriangle size={11} />
                    {customer.overdue_sales_count} متأخرة
                  </span>
                )}
              </div>

              {/* Info grid 2 cols */}
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                {customer.phone && (
                  <div className="flex items-center gap-1 text-gray-500 col-span-2">
                    <Phone size={13} className="flex-shrink-0" />
                    <span dir="ltr">{customer.phone}</span>
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-gray-400 text-xs mb-0.5">إجمالي الآجل</p>
                  <p className="font-bold text-gray-700 text-sm" dir="ltr">{Number(customer.total_credit_sales || 0).toLocaleString()}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <p className="text-red-400 text-xs mb-0.5">المتبقي عليه</p>
                  <p className="font-bold text-red-600 text-sm" dir="ltr">{Number(customer.total_outstanding || 0).toLocaleString()}</p>
                </div>
                {customer.nearest_due_date && (
                  <div className="flex items-center gap-1 text-gray-500 col-span-2 text-xs">
                    <Calendar size={12} className="flex-shrink-0" />
                    <span>أقرب استحقاق: <span dir="ltr">{safeDate(customer.nearest_due_date, 'en-GB')}</span></span>
                  </div>
                )}
                {customer.notes && (
                  <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-2 text-xs text-amber-900 col-span-2 mt-1">
                    <span className="font-bold text-amber-800">ملاحظة: </span>
                    <span>{customer.notes}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setEditingCustomer(customer)}
                  className="bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold flex-1"
                  title="تعديل بيانات العميل"
                >
                  <Edit size={15} />
                  تعديل
                </button>

                <button
                  onClick={() => setObModalCustomer(customer)}
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold flex-1"
                  title="رصيد افتتاحي"
                >
                  <FileText size={15} />
                  رصيد افتتاحي
                </button>

                <button
                  onClick={() => setWhatsappModalCustomer(customer)}
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold flex-1"
                >
                  <Share2 size={15} />
                  واتساب
                </button>

                <Link
                  to={`/customers/${customer.id}`}
                  className="text-center bg-blue-50 text-blue-700 font-semibold py-2 px-3 rounded-lg hover:bg-blue-100 text-xs flex-1"
                >
                  عرض التفاصيل
                </Link>

                <button
                  onClick={() => handleDelete(customer.id)}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg border border-red-100"
                  title="حذف العميل"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ===== DESKTOP TABLE (hidden on mobile) ===== */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-semibold text-gray-600">اسم العميل</th>
              <th className="p-4 font-semibold text-gray-600">رقم الهاتف</th>
              <th className="p-4 font-semibold text-gray-600">إجمالي الآجل</th>
              <th className="p-4 font-semibold text-gray-600">المدفوع</th>
              <th className="p-4 font-semibold text-gray-600">المتبقي</th>
              <th className="p-4 font-semibold text-gray-600">المتأخر</th>
              <th className="p-4 font-semibold text-gray-600">أقرب استحقاق</th>
              <th className="p-4 font-semibold text-gray-600">الملاحظات</th>
              <th className="p-4 font-semibold text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.map(customer => (
              <tr key={customer.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{customer.name}</td>
                <td className="p-4" dir="ltr">{customer.phone}</td>
                <td className="p-4" dir="ltr">{Number(customer.total_credit_sales || 0).toLocaleString()} ج.م</td>
                <td className="p-4 text-green-600" dir="ltr">{Number(customer.total_paid || 0).toLocaleString()} ج.م</td>
                <td className="p-4 font-bold text-red-600" dir="ltr">{Number(customer.total_outstanding || 0).toLocaleString()} ج.م</td>
                <td className="p-4">
                  {customer.overdue_sales_count > 0 ? (
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                      {customer.overdue_sales_count} متأخرة
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="p-4" dir="ltr">
                  {safeDate(customer.nearest_due_date, 'en-GB')}
                </td>
                <td className="p-4 text-xs text-slate-700 max-w-[200px]" title={customer.notes || ''}>
                  {customer.notes ? (
                    <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-1 rounded-md block break-words whitespace-pre-wrap leading-relaxed">
                      {customer.notes}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="p-4 flex gap-2 items-center">
                  <button
                    onClick={() => setEditingCustomer(customer)}
                    className="bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 px-2.5 py-1.5 rounded-md flex items-center gap-1 text-xs font-bold shadow-sm"
                    title="تعديل بيانات العميل"
                  >
                    <Edit size={14} />
                    تعديل
                  </button>
                  <button
                    onClick={() => setObModalCustomer(customer)}
                    className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-2.5 py-1.5 rounded-md flex items-center gap-1 text-xs font-bold shadow-sm"
                    title="رصيد افتتاحي"
                  >
                    <FileText size={14} />
                    رصيد افتتاحي
                  </button>
                  <button
                    onClick={() => setWhatsappModalCustomer(customer)}
                    className="bg-[#25D366] text-white hover:bg-[#128C7E] px-3 py-1.5 rounded-md flex items-center gap-1 text-xs font-bold shadow-sm"
                    title="مشاركة على واتساب"
                  >
                    <Share2 size={14} />
                    مشاركة على واتساب
                  </button>
                  <Link to={`/customers/${customer.id}`} className="text-blue-600 hover:underline font-medium text-xs">
                    عرض التفاصيل
                  </Link>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                    title="حذف العميل"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {paginatedCustomers.length === 0 && (
              <tr>
                <td colSpan="8" className="p-8 text-center text-gray-500">لا يوجد عملاء حتى الآن</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center text-sm font-semibold">
            <span className="text-gray-600">
              عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} من إجمالي {totalCount} عميل
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


      {isModalOpen && (
        <AddCustomerModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            setSearchTerm('');
            setCurrentPage(1);
            fetchCustomers();
          }}
        />
      )}

      {whatsappModalCustomer && (
        <WhatsappInvoiceModal
          customerId={whatsappModalCustomer.id}
          customerName={whatsappModalCustomer.name}
          onClose={() => setWhatsappModalCustomer(null)}
        />
      )}

      {obModalCustomer && (
        <OpeningBalanceModal
          isOpen={!!obModalCustomer}
          onClose={() => setObModalCustomer(null)}
          entityType="customer"
          entityId={obModalCustomer.id}
          entityName={obModalCustomer.name}
          onSuccess={fetchCustomers}
        />
      )}

      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={() => {
            setEditingCustomer(null);
            fetchCustomers(currentPage, searchTerm);
          }}
        />
      )}
    </div>
  );
}
