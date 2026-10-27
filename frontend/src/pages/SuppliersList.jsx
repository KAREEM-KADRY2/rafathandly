import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Phone, ShoppingBag, Wallet, FileText, Edit, Trash2 } from 'lucide-react';
import api from '../api';
import AddSupplierModal from '../components/AddSupplierModal';
import OpeningBalanceModal from '../components/OpeningBalanceModal';

export default function SuppliersList() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState(null);
  const [obModalSupplier, setObModalSupplier] = useState(null);

  const handleDeleteSupplier = async (supplier) => {
    const roleLabel = supplier.type === 'مصنع' ? 'المصنع' : 'المورد';
    if (!window.confirm(`هل أنت متأكد من حذف ${roleLabel} "${supplier.name}" نهائياً من السيستم؟\n\n- سيتم مسح سجل ${roleLabel} وكافة فواتير المشتريات والحركات المالية المرتبطة به.`)) {
      return;
    }
    try {
      await api.delete(`/suppliers/${supplier.id}`);
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.error || `حدث خطأ أثناء حذف ${roleLabel}`);
    }
  };

  const fetchSuppliers = async (page = currentPage, search = searchTerm) => {
    try {
      const res = await api.get('/suppliers', {
        params: { page, limit: itemsPerPage, search }
      });
      if (res.data && Array.isArray(res.data.items)) {
        setSuppliers(res.data.items);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setSuppliers(res.data);
        setTotalCount(res.data.length);
        setTotalPages(Math.ceil(res.data.length / itemsPerPage) || 1);
      } else {
        setSuppliers([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
      setTotalCount(0);
      setTotalPages(1);
    }
  };

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchSuppliers(currentPage, searchTerm);
      return;
    }
    const timer = setTimeout(() => {
      fetchSuppliers(currentPage, searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage, searchTerm]);

  const filteredSuppliers = suppliers;
  const paginatedSuppliers = suppliers;


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">الموردين والمصانع</h1>
        <button
          onClick={() => { setSupplierToEdit(null); setIsModalOpen(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm sm:text-base"
        >
          <Plus size={18} />
          إضافة مورد/مصنع
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-lg shadow-sm">
        <div className="relative">
          <input
            type="text"
            placeholder="بحث بالاسم أو النوع..."
            className="w-full pr-10 pl-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-right"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
        </div>
      </div>

      {/* ===== MOBILE CARDS (hidden on md+) ===== */}
      <div className="flex flex-col gap-3 md:hidden">
        {filteredSuppliers.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500 shadow-sm">لا يوجد موردين حتى الآن</div>
        ) : (
          filteredSuppliers.map(supplier => (
            <div key={supplier.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              {/* Top row: name + type badge */}
              <div className="flex justify-between items-start mb-3">
                <p className="font-bold text-gray-800 text-base">{supplier.name}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${supplier.type === 'مصنع' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {supplier.type}
                </span>
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-sm text-gray-600">
                {supplier.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400 flex-shrink-0" />
                    <span dir="ltr">{supplier.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className="text-gray-400 flex-shrink-0" />
                  <span>المشتريات: <span className="font-bold text-gray-800" dir="ltr">{Number(supplier.total_purchases || 0).toLocaleString()} ج.م</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className="text-gray-400 flex-shrink-0" />
                  <span>عدد الأطنان: <span className="font-bold text-orange-600" dir="ltr">{Number(supplier.total_tons || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} طن</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet size={14} className="text-gray-400 flex-shrink-0" />
                  <span>الرصيد: <span className={`font-bold ${supplier.balance < 0 ? 'text-red-500' : supplier.balance > 0 ? 'text-green-600' : 'text-gray-500'}`} dir="ltr">{Number(supplier.balance).toLocaleString()} ج.م</span></span>
                </div>
                {supplier.notes && (
                  <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-2 text-xs text-amber-900 mt-1">
                    <span className="font-bold text-amber-800">ملاحظة: </span>
                    <span>{supplier.notes}</span>
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => handleDeleteSupplier(supplier)}
                  className="bg-red-50 text-red-600 font-semibold py-2 px-3 rounded-lg hover:bg-red-100 text-sm flex items-center justify-center gap-1 border border-red-200"
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => { setSupplierToEdit(supplier); setIsModalOpen(true); }}
                  className="flex-1 text-center bg-amber-50 text-amber-800 font-semibold py-2 rounded-lg hover:bg-amber-100 text-sm flex items-center justify-center gap-1 border border-amber-200"
                >
                  <Edit size={14} /> تعديل
                </button>
                <Link
                  to={`/suppliers/${supplier.id}`}
                  className="flex-1 text-center bg-blue-50 text-blue-700 font-semibold py-2 rounded-lg hover:bg-blue-100 text-sm"
                >
                  عرض التفاصيل
                </Link>
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
              <th className="p-4 font-semibold text-gray-600">اسم المصنع / المورد</th>
              <th className="p-4 font-semibold text-gray-600">النوع</th>
              <th className="p-4 font-semibold text-gray-600">رقم الهاتف</th>
              <th className="p-4 font-semibold text-gray-600">المشتريات</th>
              <th className="p-4 font-semibold text-gray-600">عدد الأطنان</th>
              <th className="p-4 font-semibold text-gray-600">رصيد المصنع</th>
              <th className="p-4 font-semibold text-gray-600">الملاحظات</th>
              <th className="p-4 font-semibold text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSuppliers.map(supplier => (
              <tr key={supplier.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{supplier.name}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs ${supplier.type === 'مصنع' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {supplier.type}
                  </span>
                </td>
                <td className="p-4" dir="ltr">{supplier.phone}</td>
                <td className="p-4 font-bold text-gray-700" dir="ltr">{Number(supplier.total_purchases || 0).toLocaleString()}</td>
                <td className="p-4 font-bold text-orange-600" dir="ltr">{Number(supplier.total_tons || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="p-4 font-bold" dir="ltr">
                  <span className={supplier.type === "مصنع" ? (supplier.balance < 0 ? "text-red-500" : "text-green-600") : (supplier.balance > 0 ? "text-red-500" : "text-green-600")}>
                    {Number(supplier.balance).toLocaleString()} ج.م
                  </span>
                </td>
                <td className="p-4 text-xs text-slate-700 max-w-[200px]" title={supplier.notes || ''}>
                  {supplier.notes ? (
                    <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-1 rounded-md block break-words whitespace-pre-wrap leading-relaxed">
                      {supplier.notes}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="p-4 flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteSupplier(supplier)}
                    className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-2.5 py-1 rounded-md flex items-center gap-1 text-xs font-bold shadow-sm"
                    title="حذف المصنع / المورد نهائياً"
                  >
                    <Trash2 size={14} />
                    حذف
                  </button>
                  <button
                    onClick={() => { setSupplierToEdit(supplier); setIsModalOpen(true); }}
                    className="bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 px-2.5 py-1 rounded-md flex items-center gap-1 text-xs font-bold shadow-sm"
                    title="تعديل بيانات المصنع / المورد"
                  >
                    <Edit size={14} />
                    تعديل
                  </button>
                  <button
                    onClick={() => setObModalSupplier(supplier)}
                    className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-2.5 py-1 rounded-md flex items-center gap-1 text-xs font-bold shadow-sm"
                    title="رصيد افتتاحي"
                  >
                    <FileText size={14} />
                    رصيد افتتاحي
                  </button>
                  <Link to={`/suppliers/${supplier.id}`} className="text-blue-600 hover:underline font-medium text-xs">
                    عرض التفاصيل
                  </Link>
                </td>
              </tr>
            ))}
            {paginatedSuppliers.length === 0 && (
              <tr>
                <td colSpan="7" className="p-8 text-center text-gray-500">لا يوجد موردين حتى الآن</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center text-sm font-semibold">
            <span className="text-gray-600">
              عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredSuppliers.length)} من إجمالي {filteredSuppliers.length} مورد / مصنع
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


      <AddSupplierModal
        isOpen={isModalOpen}
        supplierToEdit={supplierToEdit}
        onClose={() => { setIsModalOpen(false); setSupplierToEdit(null); }}
        onSuccess={() => { setIsModalOpen(false); setSupplierToEdit(null); fetchSuppliers(currentPage, searchTerm); }}
      />

      {obModalSupplier && (
        <OpeningBalanceModal
          isOpen={!!obModalSupplier}
          onClose={() => setObModalSupplier(null)}
          entityType={obModalSupplier.type === 'مصنع' ? 'factory' : 'supplier'}
          entityId={obModalSupplier.id}
          entityName={obModalSupplier.name}
          onSuccess={fetchSuppliers}
        />
      )}
    </div>
  );
}
