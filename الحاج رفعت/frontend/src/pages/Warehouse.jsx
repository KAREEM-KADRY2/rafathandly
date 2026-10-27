import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, AlertTriangle, AlertCircle, ArrowUpRight, ArrowDownRight, Search, PlusCircle, Edit2, Trash2 } from 'lucide-react';
import api from '../api';
import InventoryAdjustmentModal from '../components/InventoryAdjustmentModal';
import InventoryPasswordModal from '../components/InventoryPasswordModal';
import AddItemModal from '../components/AddItemModal';
import EditItemModal from '../components/EditItemModal';

export default function Warehouse() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [filterStatus, setFilterStatus] = useState('all'); // all, low, empty

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [verifiedPassword, setVerifiedPassword] = useState('');
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsRes, summaryRes] = await Promise.all([
        api.get('/inventory/items'),
        api.get('/inventory/summary')
      ]);
      setItems(Array.isArray(itemsRes.data) ? itemsRes.data : (itemsRes.data?.items || []));
      setSummary(summaryRes.data || null);
    } catch (error) {
      console.error("Error fetching inventory", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!item || !item.id) return;
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف الصنف "${item.name}" نهائياً من المخزن؟`);
    if (!confirmDelete) return;

    try {
      setDeleteLoadingId(item.id);
      setFeedbackMessage(null);
      const res = await api.delete(`/inventory/items/${item.id}`);
      setFeedbackMessage({ type: 'success', text: res.data?.message || `تم حذف الصنف "${item.name}" بنجاح` });
      await fetchData();
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err) {
      const msg = err.response?.data?.error || 'حدث خطأ أثناء حذف الصنف';
      setFeedbackMessage({ type: 'error', text: msg });
      setTimeout(() => setFeedbackMessage(null), 7000);
    } finally {
      setDeleteLoadingId(null);
    }
  };

  const itemList = Array.isArray(items) ? items : [];
  const filteredItems = itemList.filter(item => {
    const itemName = String(item?.name || '').toLowerCase();
    const term = String(searchTerm || '').toLowerCase();
    const matchesSearch = itemName.includes(term);
    let matchesStatus = true;
    if (filterStatus === 'low') matchesStatus = item?.status === 'مخزون منخفض';
    if (filterStatus === 'empty') matchesStatus = item?.status === 'نفد المخزون';
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  if (loading) return <div className="text-center p-8 font-bold">جاري التحميل...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-800">المخزن وإدارة الأصناف والتحويلات</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsAddItemModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <PlusCircle size={20} />
            إضافة صنف وتحويلات
          </button>
          <button 
            onClick={() => setIsPasswordModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <PlusCircle size={20} />
            تسوية مخزون
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className={`p-4 rounded-xl font-bold flex items-center justify-between shadow-sm transition-all ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <span className="text-emerald-600 text-lg">✓</span>
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button 
            onClick={() => setFeedbackMessage(null)}
            className="text-gray-400 hover:text-gray-600 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {isAddItemModalOpen && (
        <AddItemModal 
          isOpen={isAddItemModalOpen}
          onClose={() => setIsAddItemModalOpen(false)}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}
      {isPasswordModalOpen && (
        <InventoryPasswordModal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          onSuccess={(pwd) => {
            setVerifiedPassword(pwd);
            setIsPasswordModalOpen(false);
            setIsAdjustmentModalOpen(true);
          }}
        />
      )}
      {isAdjustmentModalOpen && (
        <InventoryAdjustmentModal 
          isOpen={isAdjustmentModalOpen} 
          onClose={() => {
            setIsAdjustmentModalOpen(false);
            setVerifiedPassword('');
          }} 
          items={items}
          onSuccess={fetchData}
          password={verifiedPassword}
        />
      )}
      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setEditingItem(null);
            fetchData();
          }}
        />
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg text-blue-600">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-bold">عدد الأصناف</p>
              <p className="text-xl font-bold">{summary.total_items}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-lg text-orange-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-bold">مخزون منخفض</p>
              <p className="text-xl font-bold">{summary.low_stock_count}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-lg text-red-600">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-bold">نفد المخزون</p>
              <p className="text-xl font-bold">{summary.out_of_stock_count}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-gray-500 flex items-center gap-1"><ArrowUpRight size={16} className="text-green-500"/> إجمالي الدخول</span>
              <span className="font-bold">{summary.total_in}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold">
              <span className="text-gray-500 flex items-center gap-1"><ArrowDownRight size={16} className="text-red-500"/> إجمالي الخروج</span>
              <span className="font-bold">{summary.total_out}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث عن صنف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filterStatus === 'all' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterStatus('low')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filterStatus === 'low' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
            >
              مخزون منخفض
            </button>
            <button
              onClick={() => setFilterStatus('empty')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filterStatus === 'empty' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
            >
              نفد المخزون
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200 font-bold text-sm">
              <tr>
                <th className="p-4">الصنف</th>
                <th className="p-4">الوحدة الأساسية والتحويل</th>
                <th className="p-4">إجمالي الداخل</th>
                <th className="p-4">إجمالي الخارج</th>
                <th className="p-4">المتبقي بالمخزن</th>
                <th className="p-4">الحالة</th>
                <th className="p-4">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-black text-gray-900">{item.name}</td>
                  <td className="p-4">
                    <div className="font-bold text-gray-800">{item.unit || '-'}</div>
                    {item.secondary_unit && item.conversion_factor && (
                      <div className="text-xs text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded-md mt-1 w-fit border border-blue-200 shadow-sm">
                        1 {item.unit} = {item.conversion_factor} {item.secondary_unit}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-green-600 font-bold">{item.total_in}</td>
                  <td className="p-4 text-red-600 font-bold">{item.total_out}</td>
                  <td className="p-4 font-black text-blue-900 text-base">{item.current_stock}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      item.status === 'متوفر' ? 'bg-green-100 text-green-700 border border-green-200' :
                      item.status === 'مخزون منخفض' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                      'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        <Edit2 size={14} />
                        تعديل التحويل
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        disabled={deleteLoadingId === item.id}
                        className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 disabled:opacity-50"
                        title="حذف الصنف"
                      >
                        <Trash2 size={14} />
                        {deleteLoadingId === item.id ? 'جاري الحذف...' : 'حذف'}
                      </button>
                      <Link
                        to={`/warehouse/${item.id}`}
                        className="text-gray-600 hover:text-gray-900 font-bold text-xs"
                      >
                        التفاصيل &larr;
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-500 font-bold">
                    لا توجد أصناف مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center text-sm font-semibold">
            <span className="text-gray-600">
              عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredItems.length)} من إجمالي {filteredItems.length} صنف
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

    </div>
  );
}
