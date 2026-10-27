import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Wallet, Edit, Truck, ShoppingCart, Activity, DollarSign, CheckCircle, FileDown, User, Trash2, Landmark, Smartphone } from 'lucide-react';
import api from '../api';
import PaySupplierModal from '../components/PaySupplierModal';
import RecordPurchaseModal from '../components/RecordPurchaseModal';
import PurchaseInvoiceDetailsModal from '../components/PurchaseInvoiceDetailsModal';
import TransportModal from '../components/TransportModal';
import CollectNawlonModal from '../components/CollectNawlonModal';
import EditPurchaseModal from '../components/EditPurchaseModal';
import EditTransactionModal from '../components/EditTransactionModal';
import OpeningBalanceModal from '../components/OpeningBalanceModal';
import AddSupplierModal from '../components/AddSupplierModal';

const safeDate = (d, locale = 'ar-EG') => {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString(locale);
  } catch (e) {
    return String(d || '-');
  }
};

const safeNum = (v) => {
  const n = Number(v);
  return isNaN(n) ? '0' : n.toLocaleString();
};

export default function SupplierDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState(null);
  const [statement, setStatement] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [trips, setTrips] = useState([]);
  const [freightTransactions, setFreightTransactions] = useState([]);
  
  const [activeTab, setActiveTab] = useState('overview');
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  
  const [isPayModalOpen, setPayModalOpen] = useState(false);
  const [isPurchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [isTransportModalOpen, setTransportModalOpen] = useState(false);
  const [isCollectModalOpen, setCollectModalOpen] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [detailsInvoiceId, setDetailsInvoiceId] = useState(null);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [isEditPurchaseOpen, setIsEditPurchaseOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isEditTxOpen, setIsEditTxOpen] = useState(false);
  const [isOBModalOpen, setIsOBModalOpen] = useState(false);
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);

  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSupplierData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (dateFilter.startDate) queryParams.append('startDate', dateFilter.startDate);
      if (dateFilter.endDate) queryParams.append('endDate', dateFilter.endDate);

      const [suppRes, stmtRes, purchRes, tripsRes, freightRes] = await Promise.allSettled([
        api.get(`/suppliers/${id}/summary`),
        api.get(`/suppliers/${id}/statement?${queryParams.toString()}`),
        api.get(`/purchases/supplier/${id}`),
        api.get(`/transport-trips/supplier/${id}`),
        api.get(`/transport-trips/supplier/${id}/freight-transactions`)
      ]);

      if (suppRes.status === 'fulfilled' && suppRes.value?.data) {
        setSupplier(suppRes.value.data);
      } else {
        setError('المورد أو المصنع غير موجود أو تم حذفه');
      }

      if (stmtRes.status === 'fulfilled') setStatement(stmtRes.value.data || []);
      if (purchRes.status === 'fulfilled') setPurchases(purchRes.value.data || []);
      if (tripsRes.status === 'fulfilled') setTrips(tripsRes.value.data || []);
      if (freightRes.status === 'fulfilled') setFreightTransactions(freightRes.value.data || []);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء تحميل بيانات المورد');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePurchase = async (purchaseId, invoiceNum) => {
    const roleLabel = supplier?.type === 'مصنع' ? 'المصنع' : 'المورد';
    const invLabel = invoiceNum ? `رقم (${invoiceNum})` : `رقم (#${purchaseId})`;
    
    if (!window.confirm(`هل أنت متأكد من حذف وإلغاء فاتورة المشتريات ${invLabel}؟\n\n- سيتم إرجاع وحذف كميات البضاعة من رصيد المخزن.\n- سيتم إلغاء أثر أي مبالغ مدفوعة على الفاتورة واستردادها إلى الخزينة.\n- سيتم تعديل وتحديث رصيد وحساب ${roleLabel} تلقائياً.`)) {
      return;
    }

    try {
      const res = await api.delete(`/purchases/${purchaseId}`);
      alert(res.data?.message || `تم حذف الفاتورة ${invLabel} بنجاح وتحديث الحسابات والمخزن.`);
      fetchSupplierData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف الفاتورة');
    }
  };

  const handleDeleteTransaction = async (txId, amount) => {
    const roleLabel = supplier?.type === 'مصنع' ? 'المصنع' : 'المورد';
    const formattedAmount = Number(Math.abs(amount || 0)).toLocaleString();
    
    if (!window.confirm(`هل أنت متأكد من حذف هذه الحركة المالية بقيمة (${formattedAmount} ج.م)؟\n\n- سيتم إلغاء أثر الحركة وتعديل رصيد ${roleLabel}.\n- سيتم تحديث الخزينة والحسابات المرتبطة فوراً.`)) {
      return;
    }

    try {
      const res = await api.delete(`/suppliers/transactions/${txId}`);
      alert(res.data?.message || 'تم حذف الحركة المالية بنجاح وتحديث رصيد الحساب.');
      fetchSupplierData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف الحركة المالية');
    }
  };

  const handleDeleteSupplier = async () => {
    const roleLabel = supplier?.type === 'مصنع' ? 'المصنع' : 'المورد';
    if (!window.confirm(`هل أنت متأكد من حذف ${roleLabel} "${supplier.name}" نهائياً من السيستم؟\n\n- سيتم مسح سجل ${roleLabel} وكافة فواتير المشتريات والحركات المالية المرتبطة به.\n- لا يمكن التراجع عن هذه الخطوة.`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await api.delete(`/suppliers/${id}`);
      alert(res.data?.message || `تم حذف ${roleLabel} بنجاح`);
      navigate('/');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || `حدث خطأ أثناء حذف ${roleLabel}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierData();
  }, [id, dateFilter]);

  if (loading && !supplier) {
    return (
      <div className="p-12 text-center text-gray-500 font-bold" dir="rtl">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3"></div>
        <div>جاري تحميل بيانات المورد...</div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="p-8 text-center bg-white rounded-lg shadow-sm border border-gray-200 my-6" dir="rtl">
        <p className="text-lg font-bold text-red-600 mb-4">{error || 'المورد غير موجود'}</p>
        <Link to="/suppliers" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm inline-block">
          العودة لقائمة الموردين والمصانع
        </Link>
      </div>
    );
  }

  const nawlonRemaining = (supplier.total_nawlon || 0) - (supplier.collected_nawlon || 0);

  const downloadPDF = () => {
    const queryParams = new URLSearchParams();
    if (dateFilter.startDate) queryParams.append('startDate', dateFilter.startDate);
    if (dateFilter.endDate) queryParams.append('endDate', dateFilter.endDate);
    window.open(`${api.defaults.baseURL}/suppliers/${id}/statement/pdf?${queryParams.toString()}`, '_blank');
  };

  const downloadExcel = () => {
    const queryParams = new URLSearchParams();
    if (dateFilter.startDate) queryParams.append('startDate', dateFilter.startDate);
    if (dateFilter.endDate) queryParams.append('endDate', dateFilter.endDate);
    window.open(`${api.defaults.baseURL}/suppliers/${id}/statement/excel?${queryParams.toString()}`, '_blank');
  };

  const renderCustomerTracking = (p) => {
    // 1. Build aggregated customer sales from p.items if present
    const customerMap = new Map();
    if (p.items && Array.isArray(p.items)) {
      p.items.forEach(item => {
        if (item.customer_sales && Array.isArray(item.customer_sales)) {
          item.customer_sales.forEach(cs => {
            const name = cs.customer_name;
            if (name) {
              const current = customerMap.get(name) || { qty: 0, unit: cs.unit || 'طن' };
              current.qty += Number(cs.quantity || cs.base_quantity || 0);
              customerMap.set(name, current);
            }
          });
        }
      });
    }

    if (customerMap.size > 0) {
      return (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex flex-wrap gap-1.5">
            {Array.from(customerMap.entries()).map(([name, data]) => (
              <div 
                key={name} 
                className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-900 border border-emerald-300/80 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs hover:bg-emerald-100/70 transition-colors"
              >
                <span className="flex items-center gap-1 text-emerald-950">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {name}
                </span>
                <span className="bg-emerald-700 text-white text-[10px] px-2 py-0.5 rounded-md font-black" dir="ltr">
                  {Math.round(data.qty * 100) / 100} {data.unit || 'طن'}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 2. Fallback to parsing customer_tracking_summary string
    const summary = p.customer_tracking_summary;
    if (!summary || summary === 'لم يتم البيع منها بعد') {
      return <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-semibold border border-slate-200/60">لم يتم البيع منها بعد</span>;
    }

    if (summary.includes('تم البيع لـ:')) {
      const rawList = summary.replace('تم البيع لـ:', '').trim();
      const parts = rawList.split(/،|,/).map(s => s.trim()).filter(Boolean);

      return (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex flex-wrap gap-1.5">
            {parts.map((part, idx) => {
              const match = part.match(/^(.*?)\s*\((.*?)\)$/);
              const custName = match ? match[1] : part;
              const custQty = match ? match[2] : null;

              return (
                <div 
                  key={idx} 
                  className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-900 border border-emerald-300/80 px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-xs hover:bg-emerald-100/70 transition-colors"
                >
                  <span className="flex items-center gap-1 text-emerald-950">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {custName}
                  </span>
                  {custQty && (
                    <span className="bg-emerald-700 text-white text-[10px] px-2 py-0.5 rounded-md font-black" dir="ltr">
                      {custQty}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="p-1.5 rounded-lg text-[11px] font-bold bg-slate-50 text-slate-700 border border-slate-200">
        {summary}
      </div>
    );
  };

  return (
    <div>
      {/* Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
          <div className="text-sm text-gray-500 mb-1">{supplier.type === "\u0645\u0635\u0646\u0639" ? "الرصيد الحالي" : "المديونية المستحقة"}</div>
          <div className="text-xl font-bold text-red-600" dir="ltr">
            {Number(supplier.balance || 0).toLocaleString()} ج.م
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-gray-500">
          <div className="text-sm text-gray-500 mb-1">إجمالي المشتريات</div>
          <div className="text-xl font-bold text-gray-700" dir="ltr">
            {Number(supplier.total_purchases || 0).toLocaleString()} ج.م
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">{supplier.type === "\u0645\u0635\u0646\u0639" ? "إجمالي المدفوعات للمصنع" : "إجمالي المسدد للمورد"}</div>
          <div className="text-xl font-bold text-green-700" dir="ltr">
            {Number(supplier.type === "\u0645\u0635\u0646\u0639" ? supplier.total_deposits : supplier.total_paid || 0).toLocaleString()} ج.م
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-orange-500">
          <div className="text-sm text-gray-500 mb-1">عدد الأطنان</div>
          <div className="text-xl font-bold text-orange-700" dir="ltr">
            {Number(supplier.total_tons || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-white p-6 rounded-lg shadow-sm mb-6 flex justify-between items-start flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">{supplier.name}</h1>
            <button
              onClick={handleDeleteSupplier}
              className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-xs transition-colors"
              title={`حذف ${supplier.type === 'مصنع' ? 'المصنع' : 'المورد'} نهائياً`}
            >
              <Trash2 size={16} />
              <span>حذف {supplier.type === 'مصنع' ? 'المصنع' : 'المورد'}</span>
            </button>
          </div>
          <div className="text-gray-500 space-x-4 space-x-reverse">
            <span>{supplier.type}</span>
            <span>|</span>
            <span dir="ltr">{supplier.phone}</span>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            {supplier.items && supplier.items.map((item, idx) => {
              // using idx for key since item might be a string now based on backend updates
              const itemName = typeof item === 'string' ? item : item.item_name;
              let colorClasses = "bg-gray-100 text-gray-700 border-gray-200";
              switch(itemName) {
                case 'أسمنت': colorClasses = 'bg-gray-200 text-gray-800 border-gray-300'; break;
                case 'حديد': colorClasses = 'bg-slate-200 text-slate-800 border-slate-300'; break;
                case 'طوب': colorClasses = 'bg-orange-100 text-orange-800 border-orange-200'; break;
                case 'رمل': colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-300'; break;
                case 'زلط': colorClasses = 'bg-stone-200 text-stone-800 border-stone-300'; break;
                case 'مواد بناء أخرى': colorClasses = 'bg-blue-100 text-blue-800 border-blue-200'; break;
              }
              return (
                <span key={idx} className={`px-3 py-1 rounded-full text-xs font-bold border ${colorClasses}`}>
                  {itemName}
                </span>
              );
            })}
          </div>

          {supplier.notes && (
            <div className="mt-3 bg-amber-50 border border-amber-200/90 rounded-xl p-3 text-xs sm:text-sm text-amber-950 flex items-start gap-2 max-w-3xl shadow-2xs">
              <FileDown size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-900">ملاحظات {supplier.type === 'مصنع' ? 'المصنع' : 'المورد'}: </span>
                <span className="leading-relaxed font-semibold">{supplier.notes}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button 
            onClick={handleDeleteSupplier} 
            className="bg-white text-red-600 border border-red-300 hover:bg-red-50 px-3.5 py-2 rounded-lg flex items-center gap-1.5 font-bold shadow-sm transition-colors text-sm"
            title={`حذف ${supplier.type === 'مصنع' ? 'المصنع' : 'المورد'}`}
          >
            <Trash2 size={16} />
            <span>حذف</span>
          </button>
          <button onClick={() => setIsEditSupplierOpen(true)} className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 flex items-center gap-1 font-bold shadow-sm transition-colors">
            <Edit size={16} /> تعديل بيانات {supplier.type === 'مصنع' ? 'المصنع' : 'المورد'}
          </button>
          <button onClick={() => setIsOBModalOpen(true)} className="bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-900 flex items-center gap-1 font-bold transition-colors">
            <FileDown size={16} /> رصيد افتتاحي
          </button>
          {supplier.type === "\u0645\u0635\u0646\u0639" ? (
            <button onClick={() => setPayModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-1 font-bold">
              <DollarSign size={16} /> إضافة رصيد للمصنع
            </button>
          ) : (
            <button onClick={() => setPayModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-1 font-bold">
              <DollarSign size={16} /> تسديد فاتورة
            </button>
          )}
          <button onClick={() => setPurchaseModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-1 font-bold">
            <ShoppingCart size={16} /> فاتورة مشتريات جديدة
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm mb-6 flex w-full border-b overflow-x-auto">
        {['overview', 'purchases', 'statements'].map((tab) => {
          const titles = { overview: 'نظرة عامة', purchases: 'المشتريات', statements: 'كشف الحساب', nawlon: 'النولون', transports: 'النقل' };
          return (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 px-6 py-3 font-semibold whitespace-nowrap text-center ${activeTab === tab ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}>
              {titles[tab]}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm p-6 min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                  <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                    <User size={18} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">معلومات التواصل الأساسية</h3>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">اسم الحساب:</span>
                    <span className="font-bold text-slate-900">{supplier.name}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">نوع الحساب:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      supplier.type === 'مصنع' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {supplier.type || 'مورد'}
                    </span>
                  </div>

                  {supplier.contact_person && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">الشخص المسؤول:</span>
                      <span className="font-semibold text-slate-800">{supplier.contact_person}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">رقم الهاتف:</span>
                    <span className="font-bold text-slate-900" dir="ltr">{supplier.phone || 'غير مسجل'}</span>
                  </div>

                  {supplier.alt_phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">هاتف إضافي:</span>
                      <span className="font-semibold text-slate-700" dir="ltr">{supplier.alt_phone}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">العنوان / المحافظة:</span>
                    <span className="font-medium text-slate-800">{supplier.address || supplier.governorate || 'غير مسجل'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">حالة الحساب:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      supplier.status === 'inactive' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {supplier.status === 'inactive' ? 'غير نشط' : 'نشط'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                  <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
                    <Activity size={18} />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">الملخص الإحصائي والمالي</h3>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">إجمالي حجم المشتريات:</span>
                    <span className="font-bold text-blue-700 text-base" dir="ltr">
                      {Number(supplier.total_purchases || 0).toLocaleString()} ج.م
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">
                      {supplier.type === 'مصنع' ? 'إجمالي المدفوعات للمصنع:' : 'إجمالي المسدد للمورد:'}
                    </span>
                    <span className="font-bold text-emerald-700 text-base" dir="ltr">
                      {Number(supplier.type === 'مصنع' ? supplier.total_deposits : supplier.total_paid || 0).toLocaleString()} ج.م
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">إجمالي الكميات (أطنان):</span>
                    <span className="font-bold text-amber-700 text-base" dir="ltr">
                      {Number(supplier.total_tons || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} طن
                    </span>
                  </div>

                  <div className="flex items-center justify-between bg-amber-50/90 p-3.5 rounded-xl border-2 border-amber-300/80 shadow-sm mt-3">
                    <span className="text-slate-900 font-black text-lg">
                      {supplier.type === 'مصنع' ? 'الرصيد المتاح بالمصنع:' : 'الرصيد النهائي المستحق:'}
                    </span>
                    <span className={`font-black text-2xl ${
                      supplier.type === 'مصنع'
                        ? (supplier.balance >= 0 ? 'text-emerald-600' : 'text-red-600')
                        : (supplier.balance > 0 ? 'text-red-600' : (supplier.balance < 0 ? 'text-emerald-600' : 'text-slate-700'))
                    }`} dir="ltr">
                      {Number(supplier.balance || 0).toLocaleString()} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Supplier Notes */}
              <div className="bg-gradient-to-br from-slate-50 to-amber-50/30 rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                    <div className="p-2 bg-amber-600 text-white rounded-lg shadow-sm">
                      <FileDown size={18} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-base">ملاحظات الحساب</h3>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      توصيات وملاحظات {supplier.type === 'مصنع' ? 'المصنع' : 'المورد'}:
                    </h4>
                    <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-700 min-h-[90px] leading-relaxed">
                      {supplier.notes || `لا توجد ملاحظات مسجلة على هذا ${supplier.type === 'مصنع' ? 'المصنع' : 'المورد'}.`}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                  <span>تاريخ التسجيل:</span>
                  <span className="font-semibold text-slate-700" dir="ltr">
                    {safeDate(supplier.created_at, 'ar-EG')}
                  </span>
                </div>
              </div>

            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                  <h3 className="font-bold text-slate-800 text-base">أحدث فواتير المشتريات</h3>
                </div>
                <button
                  onClick={() => setActiveTab('purchases')}
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                >
                  عرض جميع الفواتير ({purchases.length}) &larr;
                </button>
              </div>

              {purchases.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="p-3">رقم الفاتورة</th>
                        <th className="p-3 text-center">نوع الفاتورة</th>
                        <th className="p-3">تاريخ الفاتورة</th>
                        <th className="p-3">الأصناف والأسعار</th>
                        <th className="p-3">إجمالي الفاتورة</th>
                        <th className="p-3">المبلغ المدفوع</th>
                        <th className="p-3">المتبقي</th>
                        <th className="p-3">الملاحظات وتتبع العملاء</th>
                        <th className="p-3 text-center">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.slice(0, 5).map(p => (
                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-bold text-slate-900">{p.invoice_number || `#${p.id}`}</td>
                          <td className="p-3 text-center">
                            {p.payment_type === 'cash' || (Number(p.remaining_amount || 0) <= 0 && Number(p.paid_amount || 0) >= Number(p.total_amount || 0) && p.payment_type !== 'credit') ? (
                              <div>
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                  نقدي
                                </span>
                                {p.account_name && (
                                  <div className="text-[10px] text-emerald-700 font-bold mt-0.5 truncate" title={p.account_name}>
                                    {p.account_name}
                                  </div>
                                )}
                              </div>
                            ) : p.payment_type === 'balance_deduction' ? (
                              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                                خصم رصيد
                              </span>
                            ) : (
                              <div>
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                  آجل
                                </span>
                                {Number(p.paid_amount || 0) > 0 && p.account_name && (
                                  <div className="text-[10px] text-slate-500 font-bold mt-0.5 truncate" title={`دفعة من: ${p.account_name}`}>
                                    {p.account_name}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-slate-600" dir="ltr">
                            {safeDate(p.purchase_date, 'ar-EG')}
                          </td>
                          <td className="p-3 min-w-[200px] max-w-[340px]">
                            {p.items && p.items.length > 0 ? (
                              <div className="space-y-1.5">
                                {p.items.map((item, idx) => (
                                  <div key={idx} className="bg-slate-50 border border-slate-200/90 rounded-lg p-2 text-xs shadow-2xs">
                                    <div className="flex justify-between items-center gap-1 font-bold text-slate-900 mb-1">
                                      <span className="flex items-center gap-1.5 font-extrabold text-blue-900">
                                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                        {item.item_name || 'صنف'}
                                      </span>
                                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-black text-[11px]" dir="ltr">
                                        {safeNum(item.total_price || (item.quantity * item.unit_price))} ج.م
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-600 font-semibold border-t border-slate-200/70 pt-1">
                                      <span>الكمية: <strong className="text-slate-800">{safeNum(item.quantity)} {item.unit || 'طن'}</strong></span>
                                      <span dir="ltr">السعر: <strong className="text-slate-800">{safeNum(item.unit_price)} ج.م</strong></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="p-3 font-bold text-blue-700" dir="ltr">
                            {safeNum(p.total_amount)} ج.م
                          </td>
                          <td className="p-3 font-bold text-emerald-600" dir="ltr">
                            {safeNum(p.paid_amount)} ج.م
                          </td>
                          <td className="p-3 font-bold text-rose-600" dir="ltr">
                            {safeNum(p.remaining_amount)} ج.م
                          </td>
                          <td className="p-3 text-xs max-w-[320px]">
                            {p.notes && <div className="text-slate-700 font-medium mb-1 truncate" title={p.notes}>{p.notes}</div>}
                            {renderCustomerTracking(p)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center items-center gap-1.5">
                              <button
                                onClick={() => { setDetailsInvoiceId(p.id); setShowInvoiceDetails(true); }}
                                className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-sm"
                              >
                                عرض الفاتورة
                              </button>
                              <button
                                onClick={() => { setEditingPurchase(p); setIsEditPurchaseOpen(true); }}
                                className="bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                              >
                                <Edit size={13} /> تعديل
                              </button>
                              <button
                                onClick={() => handleDeletePurchase(p.id, p.invoice_number)}
                                className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                title="حذف الفاتورة وتحديث حساب المورد"
                              >
                                <Trash2 size={13} /> حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-sm">
                  لا توجد فواتير مشتريات مسجلة لهذا الحساب حتى الآن.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'purchases' && (
          <div>
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3 text-center">نوع الفاتورة</th>
                  <th className="p-3">الخزينة / طريقة السداد</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الأصناف والأسعار</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">المدفوع</th>
                  <th className="p-3">المتبقي</th>
                  <th className="p-3">الملاحظات وتتبع العملاء</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-bold">{p.invoice_number || `#${p.id}`}</td>
                    <td className="p-3 text-center">
                      {p.payment_type === 'cash' || (Number(p.remaining_amount || 0) <= 0 && Number(p.paid_amount || 0) >= Number(p.total_amount || 0) && p.payment_type !== 'credit') ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          نقدي
                        </span>
                      ) : p.payment_type === 'balance_deduction' ? (
                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                          خصم رصيد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                          آجل
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {p.account_name ? (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs whitespace-nowrap ${
                          p.account_name.includes('بنك') || p.account_name.includes('CIB') || p.account_name.includes('الأهلي') || p.account_name.includes('مصر')
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {p.account_name.includes('بنك') || p.account_name.includes('CIB') || p.account_name.includes('الأهلي') || p.account_name.includes('مصر') ? (
                            <Landmark size={13} className="text-blue-600 shrink-0" />
                          ) : (
                            <Wallet size={13} className="text-emerald-600 shrink-0" />
                          )}
                          <span>{p.account_name}</span>
                        </span>
                      ) : p.payment_method && p.payment_method !== 'آجل' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 whitespace-nowrap">
                          <Wallet size={13} className="text-gray-500 shrink-0" />
                          <span>{p.payment_method}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3">{safeDate(p.purchase_date, 'ar-EG')}</td>
                    <td className="p-3 min-w-[220px] max-w-[360px]">
                      {p.items && p.items.length > 0 ? (
                        <div className="space-y-1.5">
                          {p.items.map((item, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200/90 rounded-lg p-2 text-xs shadow-2xs">
                              <div className="flex justify-between items-center gap-1 font-bold text-slate-900 mb-1">
                                <span className="flex items-center gap-1.5 font-extrabold text-blue-900">
                                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                  {item.item_name || 'صنف'}
                                </span>
                                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-black text-[11px]" dir="ltr">
                                  {safeNum(item.total_price || (item.quantity * item.unit_price))} ج.م
                                </span>
                              </div>
                              <div className="flex justify-between text-[11px] text-slate-600 font-semibold border-t border-slate-200/70 pt-1">
                                <span>الكمية: <strong className="text-slate-800">{safeNum(item.quantity)} {item.unit || 'طن'}</strong></span>
                                <span dir="ltr">السعر: <strong className="text-slate-800">{safeNum(item.unit_price)} ج.م</strong></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 font-bold" dir="ltr">{safeNum(p.total_amount)} ج.م</td>
                    <td className="p-3 font-bold text-green-600" dir="ltr">{safeNum(p.paid_amount)} ج.م</td>
                    <td className="p-3 font-bold text-red-600" dir="ltr">{safeNum(p.remaining_amount)} ج.م</td>
                    <td className="p-3 text-xs min-w-[160px] max-w-[320px]">
                      {p.notes && (
                        <div className="bg-amber-50 text-amber-900 border border-amber-200 p-2 rounded-lg font-medium mb-1.5 whitespace-pre-wrap break-words leading-relaxed shadow-2xs">
                          <span className="font-bold text-amber-800">ملاحظة: </span>
                          <span>{p.notes}</span>
                        </div>
                      )}
                      {renderCustomerTracking(p)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setDetailsInvoiceId(p.id); setShowInvoiceDetails(true); }} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm hover:bg-blue-200 font-bold">
                          عرض الفاتورة
                        </button>
                        <button onClick={() => { setEditingPurchase(p); setIsEditPurchaseOpen(true); }} className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1 rounded text-sm font-bold flex items-center gap-1">
                          <Edit size={14} /> تعديل
                        </button>
                        <button onClick={() => handleDeletePurchase(p.id, p.invoice_number)} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded text-sm font-bold flex items-center gap-1" title="حذف الفاتورة وتحديث حساب المورد">
                          <Trash2 size={14} /> حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && <tr><td colSpan="9" className="text-center p-8 text-gray-500">لا توجد مشتريات مسجلة</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {false && (
          <div>
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-lg text-purple-700">سجل النولون والمستحقات</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3">النقلة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">السيارة / السائق</th>
                    <th className="p-3">النولون (المستحق)</th>
                    <th className="p-3">المحصل</th>
                    <th className="p-3">المتبقي</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.filter(t => t.paid_by === 'المصنع' || t.paid_by === 'المورد').map(t => {
                    const remaining = t.nawlon_cost - (t.collected_amount || 0);
                    return (
                    <tr key={t.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-bold">#{t.id}</td>
                      <td className="p-3">{safeDate(t.trip_date, 'ar-EG')}</td>
                      <td className="p-3">
                        <div>{t.vehicle} | {t.plate_number}</div>
                        <div className="text-gray-500 text-xs">{t.driver_name}</div>
                      </td>
                      <td className="p-3 font-bold text-gray-700" dir="ltr">{Number(t.nawlon_cost).toLocaleString()} ج.م</td>
                      <td className="p-3 font-bold text-green-600" dir="ltr">{Number(t.collected_amount || 0).toLocaleString()} ج.م</td>
                      <td className="p-3 font-bold text-red-600" dir="ltr">{remaining.toLocaleString()} ج.م</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          t.payment_status === 'تم التحصيل بالكامل' ? 'bg-green-100 text-green-700' :
                          t.payment_status === 'تم التحصيل جزئيا' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {t.payment_status || 'مستحق'}
                        </span>
                      </td>
                      <td className="p-3">
                        {remaining > 0 ? (
                          <button onClick={() => { setSelectedTrip(t); setCollectModalOpen(true); }} className="text-green-600 hover:bg-green-50 px-2 py-1 rounded border border-green-200 flex items-center gap-1 text-xs font-semibold">
                            <DollarSign size={14} /> تحصيل
                          </button>
                        ) : (
                          <span className="text-gray-400 flex items-center gap-1 text-xs"><CheckCircle size={14} /> مكتمل</span>
                        )}
                      </td>
                    </tr>
                  )})}
                  {trips.filter(t => t.paid_by === 'المصنع' || t.paid_by === 'المورد').length === 0 && <tr><td colSpan="8" className="text-center p-8 text-gray-500">لا يوجد نولون مستحق على المصنع</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'statements' && (
          <div>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <h3 className="text-xl font-bold">كشف حساب المورد</h3>
              
              <div className="flex gap-4 items-center">
                <div className="flex gap-2">
                  <input type="date" className="border rounded p-1 text-sm" value={dateFilter.startDate} onChange={e => setDateFilter({...dateFilter, startDate: e.target.value})} />
                  <input type="date" className="border rounded p-1 text-sm" value={dateFilter.endDate} onChange={e => setDateFilter({...dateFilter, endDate: e.target.value})} />
                </div>
                <button onClick={downloadPDF} className="bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 flex items-center gap-1 text-sm font-bold border border-red-200">
                  <FileDown size={16} /> PDF
                </button>
                <button onClick={downloadExcel} className="bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100 flex items-center gap-1 text-sm font-bold border border-green-200">
                  <FileDown size={16} /> Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">رقم المستند</th>
                    <th className="p-3">الخزينة / طريقة السداد</th>
                    <th className="p-3">البيان والأصناف والأسعار</th>
                    <th className="p-3">{supplier.type === "\u0645\u0635\u0646\u0639" ? "قيمة المشتريات (مخصوم)" : "عليه (مدين)"}</th>
                    <th className="p-3">{supplier.type === "\u0645\u0635\u0646\u0639" ? "المبلغ المودع (إضافة)" : "المدفوع (دائن)"}</th>
                    <th className="p-3">{supplier.type === "\u0645\u0635\u0646\u0639" ? "الرصيد المتاح" : "الرصيد المتبقي"}</th>
                      <th className="p-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map(tx => {
                    let typeName = tx.transaction_type;
                    if (typeName === 'PURCHASE') typeName = 'فاتورة شراء';
                    else if (typeName === 'PAYMENT') typeName = supplier.type === "\u0645\u0635\u0646\u0639" ? 'إيداع رصيد' : 'سداد دفعة';
                    else if (typeName === 'NOLON') typeName = 'نولون';

                    return (
                      <tr key={tx.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-semibold">{safeDate(tx.transaction_date, 'ar-EG')}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            tx.transaction_type === 'PURCHASE' ? 'bg-red-100 text-red-800' : 
                            tx.transaction_type === 'PAYMENT' ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                          }`}>
                            {typeName}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-gray-500" dir="ltr">{tx.purchase_invoice_number || '-'}</td>
                        <td className="p-3">
                          {tx.account_name ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs whitespace-nowrap ${
                              tx.account_name.includes('بنك') || tx.account_name.includes('CIB') || tx.account_name.includes('الأهلي') || tx.account_name.includes('مصر')
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : tx.account_name.includes('محفظة') || tx.account_name.includes('كاش') || tx.account_name.includes('فودافون') || tx.account_name.includes('إنستا')
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {tx.account_name.includes('بنك') || tx.account_name.includes('CIB') || tx.account_name.includes('الأهلي') || tx.account_name.includes('مصر') ? (
                                <Landmark size={14} className="text-blue-600 shrink-0" />
                              ) : tx.account_name.includes('محفظة') || tx.account_name.includes('كاش') || tx.account_name.includes('فودافون') || tx.account_name.includes('إنستا') ? (
                                <Smartphone size={14} className="text-purple-600 shrink-0" />
                              ) : (
                                <Wallet size={14} className="text-emerald-600 shrink-0" />
                              )}
                              <span>{tx.account_name}</span>
                            </span>
                          ) : tx.transaction_type === 'PAYMENT' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 whitespace-nowrap">
                              <Wallet size={13} className="text-gray-500 shrink-0" />
                              <span>الخزينة (النقدي)</span>
                            </span>
                          ) : tx.transaction_type === 'PURCHASE' ? (
                            <span className="text-xs text-gray-400 font-medium">آجل</span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3 text-xs min-w-[220px] max-w-[380px]">
                          {tx.notes && (
                            <div className="font-bold text-slate-800 mb-1 leading-snug">
                              {tx.notes}
                            </div>
                          )}
                          {(() => {
                            const txItems = (tx.items && tx.items.length > 0)
                              ? tx.items
                              : (purchases.find(p => (tx.actual_purchase_id && p.id === tx.actual_purchase_id) || (tx.purchase_invoice_number && (p.invoice_number === tx.purchase_invoice_number || String(p.id) === String(tx.purchase_invoice_number))))?.items || []);
                            
                            if (!txItems || txItems.length === 0) {
                              return !tx.notes ? <span className="text-gray-400">-</span> : null;
                            }

                            return (
                              <div className="space-y-1.5 mt-1.5">
                                {txItems.map((item, idx) => (
                                  <div key={idx} className="bg-blue-50/90 border border-blue-200/90 rounded-lg p-2 text-xs shadow-2xs">
                                    <div className="flex justify-between items-center gap-1 font-bold text-blue-950 mb-1">
                                      <span className="flex items-center gap-1.5 font-extrabold text-blue-900">
                                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                        {item.item_name || 'صنف'}
                                      </span>
                                      <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-black text-[11px]" dir="ltr">
                                        {Number(item.total_price || (item.quantity * item.unit_price)).toLocaleString()} ج.م
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-600 font-semibold border-t border-blue-200/60 pt-1">
                                      <span>الكمية: <strong className="text-slate-900">{Number(item.quantity).toLocaleString()} {item.unit || 'طن'}</strong></span>
                                      <span dir="ltr">السعر: <strong className="text-slate-900">{Number(item.unit_price).toLocaleString()} ج.م</strong></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        {supplier.type === "\u0645\u0635\u0646\u0639" ? (
                            <>
                              <td className="p-3 font-bold text-red-600" dir="ltr">{tx.transaction_type === 'PURCHASE' ? Number(Math.abs(tx.amount)).toLocaleString() : '-'}</td>
                              <td className="p-3 font-bold text-green-600" dir="ltr">{tx.transaction_type === 'PAYMENT' ? Number(Math.abs(tx.amount)).toLocaleString() : '-'}</td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 font-bold text-red-600" dir="ltr">{tx.transaction_type === 'PURCHASE' ? Number(Math.abs(tx.amount)).toLocaleString() : '-'}</td>
                              <td className="p-3 font-bold text-green-600" dir="ltr">{tx.transaction_type === 'PAYMENT' ? Number(Math.abs(tx.amount)).toLocaleString() : '-'}</td>
                            </>
                          )}
                        <td className="p-3 font-bold text-gray-800" dir="ltr">{Number(tx.balance_after).toLocaleString()} ج.م</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 justify-center">
                              {tx.transaction_type === 'PURCHASE' && tx.actual_purchase_id ? (
                                <>
                                  <button onClick={() => { setDetailsInvoiceId(tx.actual_purchase_id); setShowInvoiceDetails(true); }} className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-xs font-bold hover:bg-blue-200">
                                    عرض الفاتورة
                                  </button>
                                  <button 
                                    onClick={() => { 
                                      const purch = purchases.find(p => p.id === tx.actual_purchase_id) || { id: tx.actual_purchase_id, invoice_number: tx.purchase_invoice_number, total_amount: Math.abs(tx.amount) };
                                      setEditingPurchase(purch); 
                                      setIsEditPurchaseOpen(true); 
                                    }} 
                                    className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded text-xs font-bold hover:bg-amber-200 flex items-center gap-1"
                                  >
                                    <Edit size={13} /> تعديل
                                  </button>
                                  <button 
                                    onClick={() => handleDeletePurchase(tx.actual_purchase_id, tx.purchase_invoice_number)} 
                                    className="bg-red-100 text-red-800 px-2.5 py-1 rounded text-xs font-bold hover:bg-red-200 flex items-center gap-1"
                                    title="حذف الفاتورة وتحديث حساب المورد"
                                  >
                                    <Trash2 size={13} /> حذف
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={() => { setEditingTransaction(tx); setIsEditTxOpen(true); }}
                                    className="bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-sm"
                                  >
                                    <Edit size={13} /> تعديل
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteTransaction(tx.id, tx.amount)}
                                    className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-sm"
                                    title="حذف الحركة وتحديث الرصيد"
                                  >
                                    <Trash2 size={13} /> حذف
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                      </tr>
                    )
                  })}
                  {statement.length === 0 && (
                    <tr><td colSpan="9" className="text-center p-8 text-gray-500">لا توجد حركات في هذه الفترة</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {false && (
          <div>
            <div className="flex justify-between mb-4">
              <h3 className="font-bold text-lg">سجل جميع النقلات</h3>
            </div>
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3">رقم النقلة</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">السيارة/السائق</th>
                  <th className="p-3">الكمية</th>
                  <th className="p-3">خط السير</th>
                  <th className="p-3">النولون</th>
                  <th className="p-3">مُحمل على</th>
                </tr>
              </thead>
              <tbody>
                {trips.map(t => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-bold">#{t.id}</td>
                    <td className="p-3 text-sm">{safeDate(t.trip_date, 'ar-EG')}</td>
                    <td className="p-3">
                      <div>{t.vehicle} | {t.plate_number}</div>
                      <div className="text-xs text-gray-500">{t.driver_name} - {t.driver_phone}</div>
                    </td>
                    <td className="p-3">{t.quantity} طن</td>
                    <td className="p-3 text-sm">من: {t.from_location}<br/>إلى: {t.to_location}</td>
                    <td className="p-3 font-bold text-gray-700" dir="ltr">{Number(t.nawlon_cost).toLocaleString()} ج.م</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        t.paid_by === 'المصنع' || t.paid_by === 'المورد' ? 'bg-purple-100 text-purple-800' : 'bg-gray-200 text-gray-800'
                      }`}>
                        {t.paid_by}
                      </span>
                    </td>
                  </tr>
                ))}
                {trips.length === 0 && <tr><td colSpan="7" className="text-center p-8 text-gray-500">لا توجد رحلات نقل</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaySupplierModal supplierType={supplier.type} isOpen={isPayModalOpen} onClose={() => setPayModalOpen(false)} supplier={supplier} onSuccess={fetchSupplierData} />
      <RecordPurchaseModal isOpen={isPurchaseModalOpen} onClose={() => setPurchaseModalOpen(false)} supplier={supplier} onSuccess={fetchSupplierData} />
      <PurchaseInvoiceDetailsModal isOpen={showInvoiceDetails} onClose={() => setShowInvoiceDetails(false)} invoiceId={detailsInvoiceId} onDelete={handleDeletePurchase} />
      <EditPurchaseModal isOpen={isEditPurchaseOpen} onClose={() => setIsEditPurchaseOpen(false)} purchase={editingPurchase} supplier={supplier} onSuccess={fetchSupplierData} />
      <EditTransactionModal isOpen={isEditTxOpen} onClose={() => setIsEditTxOpen(false)} transaction={editingTransaction} supplier={supplier} onSuccess={fetchSupplierData} />
      <OpeningBalanceModal
        isOpen={isOBModalOpen}
        onClose={() => setIsOBModalOpen(false)}
        entityType={supplier.type === 'مصنع' ? 'factory' : 'supplier'}
        entityId={id}
        entityName={supplier.name}
        onSuccess={fetchSupplierData}
      />
      <AddSupplierModal
        isOpen={isEditSupplierOpen}
        onClose={() => setIsEditSupplierOpen(false)}
        supplierToEdit={supplier}
        onSuccess={fetchSupplierData}
      />

    </div>
  );
}
