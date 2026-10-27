import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, FileText, Download, Edit, Edit3, FileDown, MessageCircle, Phone, MapPin, Receipt, Wallet, Calculator, Calendar, User, Percent, Trash2 } from 'lucide-react';
import api from '../api';
import NewCreditSaleModal from '../components/NewCreditSaleModal';
import CollectPaymentModal from '../components/CollectPaymentModal';
import SaleDetailsModal from '../components/SaleDetailsModal';
import EditSaleModal from '../components/EditSaleModal';
import EditCustomerModal from '../components/EditCustomerModal';
import WhatsappInvoiceModal from '../components/WhatsappInvoiceModal';
import OpeningBalanceModal from '../components/OpeningBalanceModal';
import ZaraAdjustmentModal from '../components/ZaraAdjustmentModal';

const safeDate = (d, locale = 'en-GB') => {
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

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, sales, statements
  const [sales, setSales] = useState([]);
  const [statement, setStatement] = useState([]);
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [paymentModalSale, setPaymentModalSale] = useState(null);
  const [zaraModalSale, setZaraModalSale] = useState(null);
  const [viewSaleModalId, setViewSaleModalId] = useState(null); // The sale object to pay
  const [editingSale, setEditingSale] = useState(null);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [isOBModalOpen, setIsOBModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (dateFilter.startDate) queryParams.append('startDate', dateFilter.startDate);
      if (dateFilter.endDate) queryParams.append('endDate', dateFilter.endDate);

      const [custRes, salesRes, statementRes] = await Promise.allSettled([
        api.get(`/customers/${id}`),
        api.get(`/credit-sales/customer/${id}`),
        api.get(`/customers/${id}/account-statement?${queryParams.toString()}`)
      ]);

      if (custRes.status === 'fulfilled' && custRes.value?.data) {
        setCustomer(custRes.value.data);
      } else {
        setError('العميل غير موجود أو تم حذفه');
      }

      if (salesRes.status === 'fulfilled') setSales(salesRes.value.data || []);
      if (statementRes.status === 'fulfilled') setStatement(statementRes.value.data || []);
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء تحميل بيانات العميل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, dateFilter]);

  const downloadPDF = () => {
    const queryParams = new URLSearchParams();
    if (dateFilter.startDate) queryParams.append('startDate', dateFilter.startDate);
    if (dateFilter.endDate) queryParams.append('endDate', dateFilter.endDate);
    window.open(`${api.defaults.baseURL}/customers/${id}/account-statement/pdf?${queryParams.toString()}`, '_blank');
  };

  const downloadExcel = () => {
    const queryParams = new URLSearchParams();
    if (dateFilter.startDate) queryParams.append('startDate', dateFilter.startDate);
    if (dateFilter.endDate) queryParams.append('endDate', dateFilter.endDate);
    window.open(`${api.defaults.baseURL}/customers/${id}/account-statement/excel?${queryParams.toString()}`, '_blank');
  };

  const invoiceRef = useRef(null);
  const [statementData, setStatementData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleWhatsappShare = async () => {
    try {
      setIsGenerating(true);
      const res = await api.get(`/customers/${id}/whatsapp-statement`);
      const data = res.data;
      
      setStatementData(data);
      
      // Allow React to render the invoice first
      
        setTimeout(async () => {
          if (!invoiceRef.current) return;
          
          const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
          
          let phone = data.customer_phone || '';
          if (phone.startsWith('01') && phone.length === 11) {
            phone = '+20' + phone.substring(1);
          } else {
            phone = phone.replace(/[^0-9+]/g, '');
          }

          canvas.toBlob(async (blob) => {
            if (!blob) return;

            try {
              const item = new ClipboardItem({ 'image/png': blob });
              await navigator.clipboard.write([item]);
              alert('تم نسخ الفاتورة كصورة! سيتم فتح واتساب الآن، قم بعمل "لصق" (Paste) لإرسال الفاتورة.');
            } catch (e) {
              console.error('Clipboard copy failed:', e);
              alert('لم نتمكن من النسخ التلقائي. سيتم تحميل الصورة بدلاً من ذلك، ويمكنك إرسالها يدوياً.');
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `فاتورة_${data.customer_name}.png`;
              link.click();
            }

            const textMsg = `مرحباً أستاذ/ة ${data.customer_name}\nمرفق تفاصيل حسابك ${data.type === 'INVOICE' ? 'وفاتورة اليوم' : 'لليوم'}.\nالإجمالي المستحق: ${Number(data.total_amount).toLocaleString()} ج.م\nشكراً لتعاملكم معنا.`;
            const messageText = encodeURIComponent(textMsg);
            const whatsappUrl = `https://wa.me/${phone}?text=${messageText}`;
            window.open(whatsappUrl, '_blank');
            setIsGenerating(false);
            setStatementData(null);
          }, 'image/png');
        }, 500);


    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء إنشاء الفاتورة');
      setIsGenerating(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (window.confirm('هل أنت متأكد من حذف هذا العميل وجميع مبيعاته وحساباته نهائياً؟')) {
      try {
        await api.delete(`/customers/${id}`);
        navigate('/customers');
      } catch (e) {
        alert(e.response?.data?.error || 'حدث خطأ أثناء الحذف');
      }
    }
  };

  const handleDeleteSale = async (saleId, invoiceNum) => {
    const invLabel = invoiceNum ? `رقم ${invoiceNum}` : `رقم #${saleId}`;
    if (!window.confirm(`هل أنت متأكد من حذف / إلغاء الفاتورة ${invLabel}؟\n\n- سيتم إرجاع البضاعة إلى رصيد المخزن.\n- سيتم إلغاء أثر أي مدفوعات مسجلة على الفاتورة من الخزينة.\n- سيتم خصم مديونية الفاتورة من كشف حساب العميل ورصيده الإجمالي.`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/credit-sales/${saleId}`);
      alert(`تم حذف وإلغاء الفاتورة ${invLabel} بنجاح وتحديث كافة الحسابات والمخزن.`);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء إلغاء الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId, amount) => {
    const formattedAmount = Number(Math.abs(amount || 0)).toLocaleString();
    if (!window.confirm(`هل أنت متأكد من حذف هذه الدفعة بقيمة (${formattedAmount} ج.م)؟\n\n- سيتم إلغاء توريد المبلغ من الخزينة / الحساب البنكي.\n- سيتم إعادة المبلغ إلى مديونية العميل.`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/credit-sales/payments/${paymentId}`);
      alert('تم حذف الدفعة بنجاح وتحديث رصيد الخزينة والعميل.');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف الدفعة');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteZara = async (adjId, amount) => {
    const formattedAmount = safeNum(amount);
    if (!window.confirm(`هل أنت متأكد من حذف تسوية الزارة بقيمة (${formattedAmount} ج.م)؟\n\n- سيتم إلغاء أثر الخصم.\n- سيتم إعادة المبلغ تلقائيًا إلى رصيد الفاتورة ومديونية العميل.`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await api.delete(`/customers/${id}/zara/${adjId}`);
      if (res.data?.success) {
        alert('تم حذف تسوية الزارة بنجاح وإعادة احتساب الرصيد.');
        await fetchData();
      }
    } catch (err) {
      console.error('Delete ZARA error:', err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف تسوية الزارة');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !customer) {
    return (
      <div className="p-12 text-center text-gray-500 font-bold" dir="rtl">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3"></div>
        <div>جاري تحميل بيانات العميل...</div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-8 text-center bg-white rounded-lg shadow-sm border border-gray-200 my-6" dir="rtl">
        <p className="text-lg font-bold text-red-600 mb-4">{error || 'العميل غير موجود'}</p>
        <Link to="/customers" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm inline-block">
          العودة لقائمة العملاء
        </Link>
      </div>
    );
  }

  const renderStatus = (status, daysRemaining = null) => {
    if (status === 'PAID') return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">تم السداد</span>;
    if (status === 'OVERDUE') return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">🔴 متأخر</span>;
    if (status === 'ACTIVE' || status === 'PARTIALLY_PAID') {
       return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">🟢 نشط</span>;
    }
    if (status === 'CANCELLED') return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">ملغي</span>;
    return <span>{status}</span>;
  };

  return (
    <div dir="rtl">
      <div className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link to="/customers" className="text-gray-500 hover:text-blue-600 bg-white p-2 rounded-full shadow-sm">
            <ArrowRight size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            {customer.notes && (
              <div className="mt-2 bg-amber-50 border border-amber-200/90 rounded-xl p-2.5 text-xs text-amber-950 flex items-start gap-2 max-w-2xl shadow-2xs">
                <FileText size={15} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900">ملاحظات العميل: </span>
                  <span className="leading-relaxed font-semibold">{customer.notes}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsOBModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 shadow-sm font-bold transition-colors"
          >
            <Wallet size={18} />
            <span>رصيد افتتاحي</span>
          </button>
          <button 
            onClick={() => setIsWhatsappModalOpen(true)}
            className="bg-[#25D366] text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-[#128C7E] shadow-sm font-bold"
          >
            <MessageCircle size={18} />
            <span>مشاركة على واتساب</span>
          </button>
          <button 
            onClick={() => setIsEditModalOpen(true)}
            className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded flex items-center gap-2 hover:bg-gray-50 shadow-sm font-medium"
          >
            <Edit size={18} />
            <span>تعديل</span>
          </button>
          <button 
            onClick={handleDeleteCustomer}
            className="bg-white text-red-600 border border-red-300 px-4 py-2 rounded flex items-center gap-2 hover:bg-red-50 shadow-sm font-medium"
            title="حذف العميل نهائياً"
          >
            <Trash2 size={18} />
            <span>حذف</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border-t-4 border-blue-500">
          <p className="text-gray-500 text-sm font-medium">إجمالي المبيعات الآجلة</p>
          <p className="text-2xl font-bold mt-1" dir="ltr">{Number(customer.total_credit_sales).toLocaleString()} ج.م</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-t-4 border-green-500">
          <p className="text-gray-500 text-sm font-medium">إجمالي المدفوع</p>
          <p className="text-2xl font-bold mt-1 text-green-600" dir="ltr">{Number(customer.total_paid).toLocaleString()} ج.م</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-t-4 border-red-500">
          <p className="text-gray-500 text-sm font-medium">إجمالي المتبقي المستحق</p>
          <p className="text-2xl font-bold mt-1 text-red-600" dir="ltr">{Number(customer.total_outstanding).toLocaleString()} ج.م</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border-t-4 border-orange-500">
          <p className="text-gray-500 text-sm font-medium">المتأخرات</p>
          <p className="text-xl font-bold mt-1 text-orange-600" dir="ltr">{Number(customer.overdue_amount).toLocaleString()} ج.م</p>
          <p className="text-sm text-gray-500">({customer.overdue_sales_count} فواتير متأخرة)</p>
        </div>
      </div>

            {/* Tabs Header */}
      <div className="bg-white rounded-lg shadow-sm mb-6 flex w-full border-b overflow-x-auto">
        {[
          { key: 'overview', label: 'نظرة عامة' },
          { key: 'sales', label: 'المبيعات الآجلة' },
          { key: 'statements', label: 'كشف الحساب' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-6 py-3 font-semibold whitespace-nowrap text-center ${
              activeTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm p-6 min-h-[400px]">
        {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Grid for Contact Info & Financial Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Card 1: Essential Contact Information */}
                <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                    <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                      <User size={18} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-base">معلومات العميل والتواصل</h3>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">اسم العميل:</span>
                      <span className="font-bold text-slate-900">{customer.name}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">رقم الهاتف:</span>
                      <span className="font-bold text-slate-900" dir="ltr">{customer.phone || 'غير مسجل'}</span>
                    </div>

                    {customer.alt_phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">هاتف إضافي:</span>
                        <span className="font-semibold text-slate-700" dir="ltr">{customer.alt_phone}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">العنوان / المحافظة:</span>
                      <span className="font-medium text-slate-800">{customer.address || customer.governorate || 'غير مسجل'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">حد الائتمان:</span>
                      <span className="font-bold text-blue-700" dir="ltr">
                        {customer.credit_limit ? `${Number(customer.credit_limit).toLocaleString()} ج.م` : 'غير محدد'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">حالة الحساب:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        customer.status === 'inactive' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {customer.status === 'inactive' ? 'غير نشط' : 'نشط'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Financial Overview & Key Metrics */}
                <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 rounded-xl p-5 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg shadow-sm">
                      <Wallet size={18} />
                    </div>
                    <h3 className="font-bold text-slate-800 text-base">الملخص المالي والائتماني</h3>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">إجمالي المبيعات الآجلة:</span>
                      <span className="font-bold text-blue-700 text-base" dir="ltr">
                        {Number(customer.total_credit_sales || 0).toLocaleString()} ج.م
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">إجمالي المدفوع والمحصل:</span>
                      <span className="font-bold text-emerald-700 text-base" dir="ltr">
                        {Number(customer.total_paid || 0).toLocaleString()} ج.م
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">الرصيد المتبقي المستحق:</span>
                      <span className="font-black text-rose-600 text-base" dir="ltr">
                        {Number(customer.total_outstanding || 0).toLocaleString()} ج.م
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">قيم المبيعات المتأخرة:</span>
                      <span className="font-bold text-amber-600 text-base" dir="ltr">
                        {Number(customer.overdue_amount || 0).toLocaleString()} ج.م
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">عدد الفواتير الآجلة:</span>
                      <span className="font-bold text-slate-800">{sales.length} فاتورة</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Customer Notes & General Info */}
                <div className="bg-gradient-to-br from-slate-50 to-amber-50/20 rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                      <div className="p-2 bg-amber-600 text-white rounded-lg shadow-sm">
                        <FileText size={18} />
                      </div>
                      <h3 className="font-bold text-slate-800 text-base">ملاحظات الحساب</h3>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">توصيات وملاحظات العميل:</h4>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm text-slate-700 min-h-[90px] leading-relaxed">
                        {customer.notes || 'لا توجد ملاحظات مسجلة على هذا العميل.'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
                    <span>تاريخ تسجيل العميل:</span>
                    <span className="font-semibold text-slate-700" dir="ltr">
                      {customer.created_at ? new Date(customer.created_at).toLocaleDateString('ar-EG') : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Recent Sales Invoices Preview */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                    <h3 className="font-bold text-slate-800 text-base">أحدث فواتير المبيعات الآجلة</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('sales')}
                    className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                  >
                    عرض جميع المبيعات ({sales.length}) &larr;
                  </button>
                </div>

                {sales.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="p-3">رقم الفاتورة</th>
                          <th className="p-3">تاريخ الفاتورة</th>
                          <th className="p-3">الإجمالي</th>
                          <th className="p-3">المدفوع</th>
                          <th className="p-3">المتبقي</th>
                          <th className="p-3">تاريخ الاستحقاق</th>
                          <th className="p-3">الملاحظات</th>
                          <th className="p-3 text-center">التفاصيل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.slice(0, 5).map(sale => (
                          <tr key={sale.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 font-bold text-slate-900">{sale.invoice_number || `#${sale.id}`}</td>
                            <td className="p-3 text-slate-600" dir="ltr">
                              {safeDate(sale.sale_date, 'ar-EG')}
                            </td>
                            <td className="p-3 font-bold text-blue-700" dir="ltr">
                              {safeNum(sale.original_amount || sale.total_amount)} ج.م
                            </td>
                            <td className="p-3 font-bold text-emerald-600" dir="ltr">
                              {safeNum(sale.paid_amount)} ج.م
                            </td>
                            <td className="p-3 font-bold text-rose-600" dir="ltr">
                              {safeNum(sale.remaining_amount)} ج.م
                            </td>
                            <td className="p-3 text-xs text-slate-600" dir="ltr">
                              {safeDate(sale.due_date, 'ar-EG')}
                            </td>
                            <td className="p-3 text-xs text-slate-700 min-w-[140px] max-w-[240px]">
                              {sale.notes ? (
                                <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-1 rounded block break-words whitespace-pre-wrap leading-relaxed font-medium">
                                  {sale.notes}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => setViewSaleModalId(sale.id)}
                                  className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-sm"
                                >
                                  عرض
                                </button>
                                {sale.status !== 'CANCELLED' ? (
                                  <>
                                    {sale.remaining_amount > 0 && (
                                      <>
                                        <button
                                          onClick={() => setPaymentModalSale(sale)}
                                          className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-sm"
                                        >
                                          تحصيل
                                        </button>
                                        <button
                                          onClick={() => setZaraModalSale(sale)}
                                          className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                          title="تسوية خصم زارة"
                                        >
                                          <Percent size={12} />
                                          <span>زارة</span>
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => setEditingSale(sale)}
                                      className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                    >
                                      <Edit3 size={12} />
                                      <span>تعديل</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSale(sale.id, sale.invoice_number)}
                                      className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                      title="حذف / إلغاء الفاتورة"
                                    >
                                      <Trash2 size={12} />
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
                ) : (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    لا توجد فواتير مبيعات مسجلة لهذا العميل حتى الآن.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div>
              <div className="flex justify-end mb-4">
                <button 
                  onClick={() => setIsSaleModalOpen(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
                >
                  <Plus size={20} />
                  <span>فاتورة بيع آجل جديدة</span>
                </button>
              </div>
              <table className="w-full text-right border-collapse">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 font-semibold text-gray-600">رقم الفاتورة</th>
                    <th className="p-3 font-semibold text-gray-600">التاريخ</th>
                    <th className="p-3 font-semibold text-gray-600">الإجمالي</th>
                    <th className="p-3 font-semibold text-gray-600">المدفوع</th>
                    <th className="p-3 font-semibold text-gray-600">المتبقي</th>
                    <th className="p-3 font-semibold text-gray-600">تاريخ الاستحقاق</th>
                    <th className="p-3 font-semibold text-gray-600">الحالة</th>
                    <th className="p-3 font-semibold text-gray-600">الملاحظات</th>
                    <th className="p-3 font-semibold text-gray-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => {
                    const dueDate = sale.due_date ? new Date(sale.due_date) : null;
                    const isOverdue = sale.remaining_amount > 0 && dueDate && new Date() > dueDate;
                    return (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{sale.invoice_number || `INV-${sale.id}`}</td>
                        <td className="p-3" dir="ltr">{safeDate(sale.sale_date, 'en-GB')}</td>
                        <td className="p-3" dir="ltr">{safeNum(sale.original_amount)}</td>
                        <td className="p-3 text-green-600" dir="ltr">{safeNum(sale.paid_amount)}</td>
                        <td className="p-3 font-bold text-red-600" dir="ltr">{safeNum(sale.remaining_amount)}</td>
                        <td className="p-3" dir="ltr">
                          <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                            {safeDate(sale.due_date, 'en-GB')}
                          </span>
                        </td>
                        <td className="p-3">{renderStatus(sale.computed_status)}</td>
                        <td className="p-3 text-xs text-slate-700 min-w-[150px] max-w-[260px]">
                          {sale.notes ? (
                            <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg block break-words whitespace-pre-wrap leading-relaxed font-medium">
                              {sale.notes}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button 
                              onClick={() => setViewSaleModalId(sale.id)}
                              className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-sm hover:bg-blue-200"
                            >
                              عرض الفاتورة
                            </button>
                            {sale.status !== 'CANCELLED' ? (
                              <>
                                {sale.remaining_amount > 0 && (
                                  <>
                                    <button 
                                      onClick={() => setPaymentModalSale(sale)}
                                      className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded text-sm hover:bg-emerald-200 font-medium"
                                    >
                                      تحصيل
                                    </button>
                                    <button 
                                      onClick={() => setZaraModalSale(sale)}
                                      className="bg-purple-100 text-purple-800 hover:bg-purple-200 px-2.5 py-1 rounded text-sm font-medium flex items-center gap-1"
                                      title="تسوية خصم زارة"
                                    >
                                      <Percent size={13} />
                                      <span>خصم زارة</span>
                                    </button>
                                  </>
                                )}
                                <button 
                                  onClick={() => setEditingSale(sale)}
                                  className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded text-sm hover:bg-amber-200 flex items-center gap-1"
                                >
                                  <Edit3 size={13} />
                                  <span>تعديل</span>
                                </button>
                                <button 
                                  onClick={() => handleDeleteSale(sale.id, sale.invoice_number)}
                                  className="bg-rose-100 text-rose-800 px-2.5 py-1 rounded text-sm hover:bg-rose-200 flex items-center gap-1 font-medium"
                                  title="حذف / إلغاء الفاتورة"
                                >
                                  <Trash2 size={13} />
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
                    );
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-gray-500">لا توجد مبيعات آجلة لهذا العميل</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'statements' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">سجل الحركات المالية</h3>
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
              <table className="w-full text-right border-collapse">
                <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-3 font-semibold text-gray-600">التاريخ</th>
                      <th className="p-3 font-semibold text-gray-600">الحركة</th>
                      <th className="p-3 font-semibold text-gray-600">رقم الفاتورة/السداد</th>
                      <th className="p-3 font-semibold text-gray-600">مدين</th>
                      <th className="p-3 font-semibold text-gray-600">دائن</th>
                      <th className="p-3 font-semibold text-gray-600">الرصيد</th>
                      <th className="p-3 font-semibold text-gray-600">الملاحظات</th>
                      <th className="p-3 font-semibold text-gray-600">الإجراءات</th>
                    </tr>
                  </thead>
                <tbody>
                  {statement.map(trx => (
                    <tr key={trx.id} className="border-b hover:bg-gray-50">
                      <td className="p-3" dir="ltr">{safeDate(trx.transaction_date, 'en-GB')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          trx.transaction_type === 'SALE' ? 'bg-red-100 text-red-700' :
                          trx.transaction_type === 'OPENING_BALANCE' ? 'bg-blue-100 text-blue-700' :
                          trx.transaction_type === 'ZARA' ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {trx.transaction_type === 'SALE' ? 'مبيعات' :
                           trx.transaction_type === 'OPENING_BALANCE' ? 'رصيد افتتاحي' :
                           trx.transaction_type === 'PAYMENT' ? 'سداد دفعة' :
                           trx.transaction_type === 'ZARA' ? 'تسوية زارة' : (trx.transaction_type || '-')}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-gray-700" dir="ltr">
                        {trx.invoice_number ? `#${trx.invoice_number}` : (trx.payment_reference || '-')}
                      </td>
                      <td className="p-3 text-red-600 font-medium" dir="ltr">
                        {trx.amount > 0 ? safeNum(trx.amount) : '-'}
                      </td>
                      <td className="p-3 text-green-600 font-medium" dir="ltr">
                        {trx.amount < 0 ? safeNum(Math.abs(trx.amount)) : '-'}
                      </td>
                      <td className="p-3 font-bold" dir="ltr">{safeNum(trx.balance_after)}</td>
                      <td className="p-3 text-xs text-slate-700 min-w-[150px] max-w-[260px]">
                        {trx.notes ? (
                          <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2 py-1 rounded-md block break-words whitespace-pre-wrap leading-relaxed font-medium">
                            {trx.notes}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                          {trx.transaction_type === 'SALE' && trx.credit_sale_id && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setViewSaleModalId(trx.credit_sale_id)}
                                className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm hover:bg-blue-200"
                              >
                                عرض الفاتورة
                              </button>
                              {trx.sale_status !== 'CANCELLED' ? (
                                <>
                                  <button 
                                    onClick={() => setEditingSale({ id: trx.credit_sale_id })}
                                    className="bg-amber-100 text-amber-800 px-3 py-1 rounded text-sm hover:bg-amber-200 flex items-center gap-1"
                                  >
                                    <Edit3 size={14} />
                                    <span>تعديل</span>
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteSale(trx.credit_sale_id, trx.invoice_number)}
                                    className="bg-rose-100 text-rose-800 px-3 py-1 rounded text-sm hover:bg-rose-200 flex items-center gap-1 font-medium"
                                    title="حذف / إلغاء الفاتورة وتحديث الحسابات المرتبطة"
                                  >
                                    <Trash2 size={14} />
                                    <span>حذف</span>
                                  </button>
                                </>
                              ) : (
                                <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded text-xs font-bold border border-rose-200">
                                  ملغاة
                                </span>
                              )}
                            </div>
                          )}
                          {trx.transaction_type === 'PAYMENT' && trx.payment_id && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleDeletePayment(trx.payment_id, trx.amount)}
                                className="bg-rose-100 text-rose-800 px-3 py-1 rounded text-sm hover:bg-rose-200 flex items-center gap-1 font-medium"
                                title="حذف الدفعة وإلغاء أثرها من الخزينة"
                              >
                                <Trash2 size={14} />
                                <span>حذف</span>
                              </button>
                            </div>
                          )}
                          {trx.transaction_type === 'ZARA' && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleDeleteZara(trx.adjustment_id || trx.id, Math.abs(trx.amount))}
                                className="bg-rose-100 text-rose-800 px-3 py-1 rounded text-sm hover:bg-rose-200 flex items-center gap-1 font-medium"
                                title="حذف تسوية الزارة وإعادة احتساب الرصيد"
                              >
                                <Trash2 size={14} />
                                <span>حذف الزارة</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                  ))}
                  {statement.length === 0 && (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-gray-500">لا توجد حركات مالية مسجلة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {isSaleModalOpen && (
        <NewCreditSaleModal 
          customer={customer}
          onClose={() => setIsSaleModalOpen(false)} 
          onSuccess={() => {
            setIsSaleModalOpen(false);
            fetchData();
          }}
        />
      )}

      {viewSaleModalId && (
        <SaleDetailsModal saleId={viewSaleModalId} onClose={() => setViewSaleModalId(null)} />
      )}
      {paymentModalSale && (
        <CollectPaymentModal 
          sale={paymentModalSale}
          onClose={() => setPaymentModalSale(null)}
          onSuccess={() => {
            setPaymentModalSale(null);
            fetchData();
          }}
        />
      )}

      {zaraModalSale && (
        <ZaraAdjustmentModal
          sale={zaraModalSale}
          customer={customer}
          onClose={() => setZaraModalSale(null)}
          onSuccess={() => {
            setZaraModalSale(null);
            fetchData();
          }}
        />
      )}

      {editingSale && (
        <EditSaleModal
          isOpen={!!editingSale}
          onClose={() => setEditingSale(null)}
          sale={editingSale}
          onSuccess={() => {
            setEditingSale(null);
            fetchData();
          }}
        />
      )}

      {isEditModalOpen && (
        <EditCustomerModal 
          customer={customer}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            fetchData();
          }}
        />
      )}

      {isWhatsappModalOpen && (
        <WhatsappInvoiceModal
          customerId={customer.id}
          customerName={customer.name}
          onClose={() => setIsWhatsappModalOpen(false)}
        />
      )}

      <OpeningBalanceModal
        isOpen={isOBModalOpen}
        onClose={() => setIsOBModalOpen(false)}
        entityType="customer"
        entityId={id}
        entityName={customer?.name}
        onSuccess={fetchData}
      />
      </div>
    );
  }
