import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Package, ArrowUpRight, ArrowDownRight, Activity, Edit2, Trash2 } from 'lucide-react';
import api from '../api';
import EditItemModal from '../components/EditItemModal';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [item, setItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteItem = async () => {
    if (!item) return;
    const confirm = window.confirm(`هل أنت متأكد من حذف الصنف "${item.name}" نهائياً من المخزن؟`);
    if (!confirm) return;

    try {
      setDeleting(true);
      await api.delete(`/inventory/items/${id}`);
      navigate('/warehouse');
    } catch (err) {
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف الصنف');
    } finally {
      setDeleting(false);
    }
  };
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary'); // summary, movements, purchases, sales

  useEffect(() => {
    fetchItemData();
  }, [id]);

  const fetchItemData = async () => {
    try {
      setLoading(true);
      const [itemRes, movRes, purRes, salRes] = await Promise.all([
        api.get(`/inventory/items/${id}`),
        api.get(`/inventory/items/${id}/movements`),
        api.get(`/inventory/items/${id}/purchases`),
        api.get(`/inventory/items/${id}/sales`)
      ]);
      setItem(itemRes.data || null);
      setMovements(Array.isArray(movRes.data) ? movRes.data : (movRes.data?.items || []));
      setPurchases(Array.isArray(purRes.data) ? purRes.data : (purRes.data?.items || []));
      setSales(Array.isArray(salRes.data) ? salRes.data : (salRes.data?.items || []));
    } catch (error) {
      console.error("Error fetching product details", error);
      setMovements([]);
      setPurchases([]);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '-';
    }
  };

  const getMovementLabel = (type) => {
    switch (type) {
      case 'IN': return 'دخول (شراء)';
      case 'OUT': return 'خروج (بيع)';
      case 'ADJUST_IN': return 'تسوية إضافة';
      case 'ADJUST_OUT': return 'تسوية خصم';
      default: return type;
    }
  };

  if (loading) return <div className="p-8 text-center font-bold">جاري التحميل...</div>;
  if (!item) return <div className="p-8 text-center text-red-500 font-bold">لم يتم العثور على الصنف</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/warehouse')} className="text-gray-500 hover:text-gray-800 p-2 bg-white rounded-lg shadow-sm">
            <ArrowRight size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">تفاصيل الصنف: {item.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {movements.length === 0 && (
            <button
              onClick={handleDeleteItem}
              disabled={deleting}
              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              <Trash2 size={18} />
              {deleting ? 'جاري الحذف...' : 'حذف الصنف'}
            </button>
          )}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Edit2 size={18} />
            تعديل إعدادات والتحويلات
          </button>
        </div>
      </div>

      {isEditModalOpen && (
        <EditItemModal
          item={item}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            fetchItemData();
          }}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <div className="p-6 border-b border-gray-200 flex flex-wrap gap-8 items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-bold">الرصيد الحالي</p>
              <p className="text-2xl font-bold text-gray-800">{item.current_stock} <span className="text-sm font-normal text-gray-500">{item.unit}</span></p>
            </div>
          </div>
          
          <div className="h-12 w-px bg-gray-300 hidden sm:block"></div>
          
          <div>
            <p className="text-sm text-gray-500 font-bold flex items-center gap-1"><ArrowUpRight size={16} className="text-green-500"/> إجمالي الداخل</p>
            <p className="text-lg font-bold text-green-600">{item.total_in} {item.unit}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 font-bold flex items-center gap-1"><ArrowDownRight size={16} className="text-red-500"/> إجمالي الخارج</p>
            <p className="text-lg font-bold text-red-600">{item.total_out} {item.unit}</p>
          </div>

          {item.secondary_unit && item.conversion_factor && (
            <>
              <div className="h-12 w-px bg-gray-300 hidden sm:block"></div>
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                <p className="text-xs text-blue-600 font-bold">معامل التحويل المسجل:</p>
                <p className="text-sm font-black text-blue-900 mt-0.5">1 {item.unit} = {item.conversion_factor} {item.secondary_unit}</p>
              </div>
            </>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex w-full border-b border-gray-200 bg-white overflow-x-auto">
          <button 
            className={`flex-1 px-4 py-3 font-bold text-center text-sm border-b-2 transition-colors ${activeTab === 'summary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            onClick={() => setActiveTab('summary')}
          >
            ملخص
          </button>
          <button 
            className={`flex-1 px-4 py-3 font-bold text-center text-sm border-b-2 transition-colors ${activeTab === 'movements' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            onClick={() => setActiveTab('movements')}
          >
            حركة الصنف
          </button>
          <button 
            className={`flex-1 px-4 py-3 font-bold text-center text-sm border-b-2 transition-colors ${activeTab === 'purchases' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            onClick={() => setActiveTab('purchases')}
          >
            المشتريات
          </button>
          <button 
            className={`flex-1 px-4 py-3 font-bold text-center text-sm border-b-2 transition-colors ${activeTab === 'sales' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            onClick={() => setActiveTab('sales')}
          >
            المبيعات
          </button>
        </div>

        <div className="p-0">
          {activeTab === 'summary' && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Activity size={22} className="text-blue-600" />
                  الملخص والنظرة العامة للصنف
                </h3>
                <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full font-medium">
                  تاريخ التسجيل: {formatDate(item.created_at)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total In */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">إجمالي الوارد (الداخل)</span>
                    <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm">
                      <ArrowUpRight size={20} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-black text-emerald-900">{item.total_in || 0}</span>
                    <span className="text-sm font-bold text-emerald-700 mr-2">{item.unit}</span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-2 font-medium">إجمالي الكميات التي تم توريدها أو إضافتها للمخزن</p>
                </div>

                {/* Total Out */}
                <div className="bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg">إجمالي الصادر (الخارج)</span>
                    <div className="p-2 bg-rose-500 text-white rounded-xl shadow-sm">
                      <ArrowDownRight size={20} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-black text-rose-900">{item.total_out || 0}</span>
                    <span className="text-sm font-bold text-rose-700 mr-2">{item.unit}</span>
                  </div>
                  <p className="text-xs text-rose-600 mt-2 font-medium">إجمالي الكميات التي تم بيعها أو سحبها من المخزن</p>
                </div>

                {/* Current Stock */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg">الرصيد المتبقي حالياً</span>
                    <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
                      <Package size={20} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-black text-blue-950">{item.current_stock || 0}</span>
                    <span className="text-sm font-bold text-blue-700 mr-2">{item.unit}</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-2 font-medium">الكمية المتوفرة الفعلية بالمخزن حالياً</p>
                </div>
              </div>

              {/* Conversion Factor & Secondary Unit Summary Box */}
              {item.secondary_unit && item.conversion_factor && (
                <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-indigo-900 flex items-center gap-2">
                        معامل التحويل والوحدات الفرعية
                      </h4>
                      <p className="text-sm text-indigo-700 font-medium">
                        الوحدة الأساسية: <strong className="text-indigo-900">{item.unit}</strong> | الوحدة الفرعية: <strong className="text-indigo-900">{item.secondary_unit}</strong>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="bg-white px-4 py-2 rounded-xl border border-indigo-100 shadow-xs">
                        <span className="text-xs text-gray-500 font-bold block">معامل التحويل:</span>
                        <span className="text-sm font-black text-indigo-800">1 {item.unit} = {item.conversion_factor} {item.secondary_unit}</span>
                      </div>
                      <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-xs">
                        <span className="text-xs text-indigo-100 font-bold block">الرصيد بالوحدة الفرعية:</span>
                        <span className="text-sm font-black">
                          {((item.current_stock || 0) * (item.conversion_factor || 1)).toLocaleString()} {item.secondary_unit}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'movements' && (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-bold text-sm">
                  <tr>
                    <th className="p-4">التاريخ</th>
                    <th className="p-4">نوع الحركة</th>
                    <th className="p-4">الكمية</th>
                    <th className="p-4">الجهة</th>
                    <th className="p-4">المرجع</th>
                    <th className="p-4">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(movements) ? movements : []).map(m => (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 text-sm whitespace-nowrap">{formatDate(m.movement_date)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          String(m.movement_type || '').includes('IN') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {getMovementLabel(m.movement_type)}
                        </span>
                      </td>
                      <td className={`p-4 font-bold ${String(m.movement_type || '').includes('IN') ? 'text-green-600' : 'text-red-600'}`}>
                        {String(m.movement_type || '').includes('IN') ? '+' : '-'}{m.quantity} {m.unit}
                      </td>
                      <td className="p-4">
                        {m.supplier_name ? `مورد: ${m.supplier_name}` : m.customer_name ? `عميل: ${m.customer_name}` : '-'}
                      </td>
                      <td className="p-4 text-sm text-gray-500">{m.reference_type} #{m.reference_id || '-'}</td>
                      <td className="p-4 text-sm text-gray-500 max-w-xs truncate">{m.notes || '-'}</td>
                    </tr>
                  ))}
                  {(!Array.isArray(movements) || movements.length === 0) && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-500 font-bold">لا توجد حركات مسجلة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'purchases' && (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-bold text-sm">
                  <tr>
                    <th className="p-4">المورد / المصنع</th>
                    <th className="p-4">إجمالي الكمية المشتراة</th>
                    <th className="p-4">تاريخ آخر شراء</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(purchases) ? purchases : []).map((p, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 font-medium">{p.supplier_name || 'غير معروف'}</td>
                      <td className="p-4 text-green-600 font-bold">{p.total_quantity} {item.unit}</td>
                      <td className="p-4 text-sm text-gray-600">{formatDate(p.last_purchase_date)}</td>
                    </tr>
                  ))}
                  {(!Array.isArray(purchases) || purchases.length === 0) && (
                    <tr>
                      <td colSpan="3" className="p-8 text-center text-gray-500 font-bold">لا توجد مشتريات من هذا الصنف</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 font-bold text-sm">
                  <tr>
                    <th className="p-4">العميل</th>
                    <th className="p-4">إجمالي الكمية المباعة</th>
                    <th className="p-4">تاريخ آخر بيع</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(sales) ? sales : []).map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 font-medium">{s.customer_name || 'غير معروف'}</td>
                      <td className="p-4 text-red-600 font-bold">{s.total_quantity} {item.unit}</td>
                      <td className="p-4 text-sm text-gray-600">{formatDate(s.last_sale_date)}</td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-8 text-center text-gray-500 font-bold">لا توجد مبيعات من هذا الصنف</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
