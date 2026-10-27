import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Printer, FileDown, Calendar, ArrowRight, FileText, Filter, 
  MessageCircle, CheckCircle, Clock, AlertTriangle, Layers, Building, 
  Hash, DollarSign, TrendingUp, TrendingDown, ArrowUpDown, ChevronDown, 
  Check, X, RefreshCw, Share2, Eye, ShieldCheck, Copy, Trash2
} from 'lucide-react';
import api from '../api';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { tafqeet } from '../utils/tafqeet';

export default function BarsalReport({ onClose, defaultParcelId = '' }) {
  const [parcels, setParcels] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedParcelId, setSelectedParcelId] = useState(defaultParcelId || 'all');
  const [selectedVilla, setSelectedVilla] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, outstanding, partial, paid
  const [datePreset, setDatePreset] = useState('all'); // all, today, thisMonth, custom
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [viewMode, setViewMode] = useState('detailed'); // 'detailed' | 'grouped'
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [copiedText, setCopiedText] = useState(false);

  const reportPrintRef = useRef(null);

  // Fetch initial parcels and types
  useEffect(() => {
    fetchParcels();
    fetchTypes();
  }, []);

  const fetchParcels = async () => {
    try {
      const res = await api.get('/barsal/parcels');
      setParcels(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch parcels:', err);
      setParcels([]);
    }
  };

  const fetchTypes = async () => {
    try {
      const res = await api.get('/barsal/types');
      setTypes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch types:', err);
      setTypes([]);
    }
  };

  // Distinct Villas from parcels list
  const uniqueVillas = useMemo(() => {
    const set = new Set();
    parcels.forEach(p => {
      if (p.villa) set.add(p.villa);
    });
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [parcels]);

  // Load report data
  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedParcelId && selectedParcelId !== 'all') {
        params.append('parcel_id', selectedParcelId);
      }
      if (selectedVilla && selectedVilla !== 'all') {
        params.append('villa', selectedVilla);
      }
      if (selectedType && selectedType !== 'all') {
        params.append('type', selectedType);
      }
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);

      const res = await api.get(`/barsal/report-v2?${params.toString()}`);
      setReportData(res.data);
    } catch (err) {
      console.error('Error fetching barsal report:', err);
      alert('حدث خطأ أثناء استخراج تقرير البرسل');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل نهائياً؟')) return;
    try {
      await api.delete(`/barsal/${recordId}`);
      fetchReport();
      fetchParcels();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف السجل');
    }
  };

  const handleDeleteParcel = async (villa, barsal) => {
    if (!window.confirm(`هل أنت متأكد من حذف جميع حركات برسل ${barsal} (فيلا ${villa})؟`)) return;
    try {
      await api.post('/barsal/delete-parcel', { villa, barsal });
      fetchReport();
      fetchParcels();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف البرسل');
    }
  };

  // Auto fetch whenever primary filters change
  useEffect(() => {
    fetchReport();
  }, [selectedParcelId, selectedVilla, selectedType, statusFilter, fromDate, toDate]);

  // Date Preset handler
  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const formatDate = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

    if (preset === 'today') {
      const dateStr = formatDate(today);
      setFromDate(dateStr);
      setToDate(dateStr);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFromDate(formatDate(firstDay));
      setToDate(formatDate(lastDay));
    } else if (preset === 'last30') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setFromDate(formatDate(past));
      setToDate(formatDate(today));
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  // Filter transactions locally by table search
  const filteredTransactions = useMemo(() => {
    if (!reportData || !Array.isArray(reportData.transactions)) return [];
    if (!tableSearch.trim()) return reportData.transactions;

    const q = tableSearch.toLowerCase().trim();
    return reportData.transactions.filter(t => 
      String(t.villa || '').toLowerCase().includes(q) ||
      String(t.barsal || '').toLowerCase().includes(q) ||
      String(t.type || '').toLowerCase().includes(q) ||
      String(t.record_date || '').toLowerCase().includes(q) ||
      String(t.total_amount || '').toLowerCase().includes(q)
    );
  }, [reportData, tableSearch]);

  // Recalculate filtered totals for search results
  const searchTotals = useMemo(() => {
    let quantity = 0;
    let total = 0;
    let paid = 0;
    let net = 0;
    filteredTransactions.forEach(t => {
      quantity += Number(t.quantity) || 0;
      total += Number(t.total_amount) || 0;
      paid += Number(t.paid_amount) || 0;
      net += Number(t.net_amount) || 0;
    });
    return { quantity, total, paid, net };
  }, [filteredTransactions]);

  // Excel Export
  const exportExcel = () => {
    if (!reportData || !Array.isArray(reportData.transactions)) return;

    const titleRow = [['شركة الحاج رفعت لتجارة وتوزيع مواد البناء والجبس']];
    const subTitleRow = [[`كشف حساب وتصفية البرسل والفيلات - ${reportData.parcel?.name || 'تقرير شامل'}`]];
    const periodRow = [[`الفترة: ${fromDate || 'البداية'} إلى ${toDate || 'النهاية'} | تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}`]];
    const emptyRow = [[]];

    const headers = [
      'م', 'التاريخ', 'رقم الفيلا', 'اسم البرسل', 'النوع (البيان)', 
      'الكمية', 'سعر الوحدة', 'إجمالي القيمة', 'المدفوع', 'الصافي المتبقي', 'الرصيد التراكمي', 'حالة السداد'
    ];

    const dataRows = filteredTransactions.map((t, idx) => [
      idx + 1,
      t.record_date ? new Date(t.record_date).toLocaleDateString('ar-EG') : '-',
      t.villa || '-',
      t.barsal || '-',
      t.type || '-',
      Number(t.quantity) || 0,
      Number(t.unit_price) || 0,
      Number(t.total_amount) || 0,
      Number(t.paid_amount) || 0,
      Number(t.net_amount) || 0,
      Number(t.running_net) || 0,
      t.payment_status === 'paid' ? 'خالص بالكامل' : t.payment_status === 'partial' ? 'مسدد جزئياً' : 'غير مسدد'
    ]);

    const totalsRow = [
      'الإجمالي', '', '', '', '',
      searchTotals.quantity,
      '',
      searchTotals.total,
      searchTotals.paid,
      searchTotals.net,
      searchTotals.net,
      ''
    ];

    const wsData = [
      ...titleRow,
      ...subTitleRow,
      ...periodRow,
      ...emptyRow,
      headers,
      ...dataRows,
      totalsRow
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!dir'] = 'rtl';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف الحساب");
    
    const fileName = `كشف_حساب_برسل_${reportData.parcel?.barsal || 'شامل'}_فيلا_${reportData.parcel?.villa || 'الكل'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Dedicated Print Function
  const handlePrint = () => {
    window.print();
  };

  // WhatsApp Message Generator
  const generateWhatsAppMessage = () => {
    if (!reportData) return '';
    const parcelName = reportData.parcel?.name || 'تقرير شامل';
    const totalAmt = Number(reportData.summary?.totalAmount || 0).toLocaleString();
    const totalPaid = Number(reportData.summary?.totalPaid || 0).toLocaleString();
    const totalNet = Number(reportData.summary?.totalNet || 0).toLocaleString();
    const periodText = fromDate || toDate ? `الفترة من ${fromDate || 'البداية'} إلى ${toDate || 'اليوم'}` : 'جميع الحركات المسجلة';

    return `*شركة الحاج رفعت لتجارة وتوزيع مواد البناء والجبس*
📄 *كشف حساب وتصفية البرسل والفيلات*
📍 *البيان:* ${parcelName}
📅 *الفترة:* ${periodText}
----------------------------------
🔹 *إجمالي قيمة التوريدات:* ${totalAmt} ج.م
✅ *إجمالي المبالغ المسددة:* ${totalPaid} ج.م
⚠️ *المتبقي المطلوب سداده:* ${totalNet} ج.م
----------------------------------
📊 *عدد العمليات المسجلة:* ${reportData.summary?.transactionCount || 0} حركة
${tafqeet(reportData.summary?.totalNet || 0)}

نسعد بخدمتكم دائماً 🙏`;
  };

  const handleCopyWhatsAppMessage = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(generateWhatsAppMessage());
    let cleanPhone = whatsAppPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) {
      cleanPhone = '2' + cleanPhone;
    }
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleDownloadImage = async () => {
    if (!reportPrintRef.current) return;
    try {
      const canvas = await html2canvas(reportPrintRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `كشف_حساب_برسل_${reportData?.parcel?.barsal || 'شامل'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء إنشاء الصورة');
    }
  };

  const summary = reportData?.summary || {
    transactionCount: 0,
    totalQuantity: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalNet: 0,
    paidCount: 0,
    partialCount: 0,
    unpaidCount: 0,
    collectionRate: 100,
    villasCount: 0,
    parcelsCount: 0
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 animate-fadeIn" dir="rtl">
      
      {/* Top Application Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 shadow-sm no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Title & Back Button */}
          <div className="flex items-center gap-3">
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                title="العودة لدفتر البرسل"
              >
                <ArrowRight size={22} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                  <FileText size={20} />
                </div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900">
                  تقرير وكشف حساب البرسل والفيلات
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 bg-indigo-100/70 text-indigo-800 text-[11px] font-black rounded-full border border-indigo-200">
                  مستقل عن الخزن
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                تصفية شاملة ومفصلة لعمليات التوريد والمدفوعات والمتبقي لكل فيلا وبرسل
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <MessageCircle size={16} />
              <span>مشاركة واتساب</span>
            </button>

            <button
              onClick={exportExcel}
              disabled={!reportData || filteredTransactions.length === 0}
              className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
            >
              <FileDown size={16} />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={!reportData || filteredTransactions.length === 0}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
            >
              <Printer size={16} />
              <span>طباعة كشف الحساب</span>
            </button>

            <button
              onClick={fetchReport}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-xl transition-all"
              title="تحديث البيانات"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-indigo-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* CONTROLS & FILTER CARD */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4 no-print">
          
          {/* Row 1: Primary Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            
            {/* Scope: Parcel Selector */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                نطاق البرسل المحدد:
              </label>
              <select
                value={selectedParcelId}
                onChange={(e) => {
                  setSelectedParcelId(e.target.value);
                  if (e.target.value !== 'all') {
                    // reset villa filter to avoid contradiction
                    setSelectedVilla('all');
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="all">🌟 جميع الفيلات والبرسل (تقرير شامل)</option>
                {parcels.map(p => (
                  <option key={p.id} value={p.id}>
                    فيلا {p.villa} - برسل {p.barsal} ({p.tx_count} عمليات | متبقي: {Number(p.total_net || 0).toLocaleString()} ج.م)
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Villa */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                تصفية برقم الفيلا:
              </label>
              <select
                value={selectedVilla}
                onChange={(e) => setSelectedVilla(e.target.value)}
                disabled={selectedParcelId !== 'all'}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 transition-all"
              >
                <option value="all">كل الفيلات</option>
                {uniqueVillas.map(v => (
                  <option key={v} value={v}>فيلا {v}</option>
                ))}
              </select>
            </div>

            {/* Filter by Item Type */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                تصفية بنوع البند / الصنف:
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="all">جميع الأصناف والبنود</option>
                {types.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Payment Status Tabs */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                حالة التحصيل والسداد:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                <option value="all">الكل (المسدد وغير المسدد)</option>
                <option value="outstanding">⚠️ متبقي عليه مبالغ للتحصيل</option>
                <option value="partial">⏳ مسدد جزئياً</option>
                <option value="paid">✅ خالص ومسدد بالكامل</option>
                <option value="unpaid">❌ لم يسدد منه أي شيء</option>
              </select>
            </div>
          </div>

          {/* Row 2: Date Filters & Preset Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            
            {/* Quick Date Presets */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => handleDatePreset('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                كل الفترات
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('today')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === 'today' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('thisMonth')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === 'thisMonth' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => handleDatePreset('last30')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  datePreset === 'last30' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                آخر 30 يوم
              </button>
            </div>

            {/* Custom Dates Inputs */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold">من:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-bold">إلى:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => handleDatePreset('all')}
                  className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                  title="مسح التواريخ"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* View Mode Toggle: Detailed vs Grouped */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'detailed' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={14} />
                <span>كشف الحساب التفصيلي</span>
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewMode === 'grouped' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building size={14} />
                <span>ملخص الفيلات ({reportData?.groupedByParcel?.length || 0})</span>
              </button>
            </div>
          </div>
        </div>

        {/* KPI FINANCIAL SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          
          {/* Card 1: Total Billed */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500">إجمالي قيمة التوريدات</span>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <DollarSign size={18} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2" dir="ltr">
              {Number(summary.totalAmount || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
            </div>
            <div className="text-[11px] text-slate-400 font-bold mt-1 flex items-center gap-1">
              <span>إجمالي الكميات:</span>
              <span className="text-blue-700 font-black">{Number(summary.totalQuantity || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Card 2: Total Paid */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500">إجمالي المسدد</span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <CheckCircle size={18} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-2" dir="ltr">
              {Number(summary.totalPaid || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
            </div>
            <div className="text-[11px] text-emerald-600 font-bold mt-1">
              {summary.paidCount || 0} حركة مسددة بالكامل
            </div>
          </div>

          {/* Card 3: Total Net / Remaining (Outstanding) */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-red-200 relative overflow-hidden bg-gradient-to-br from-white to-red-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-red-700">المتبقي للتحصيل</span>
              <div className="p-2 bg-red-100 text-red-700 rounded-xl animate-pulse">
                <AlertTriangle size={18} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-red-700 mt-2" dir="ltr">
              {Number(summary.totalNet || 0).toLocaleString()} <span className="text-xs font-bold text-red-400">ج.م</span>
            </div>
            <div className="text-[11px] text-red-600 font-bold mt-1">
              {Number(summary.unpaidCount || 0) + Number(summary.partialCount || 0)} حركة بها متبقي
            </div>
          </div>

          {/* Card 4: Collection Rate % */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500">نسبة التحصيل</span>
              <span className="text-xs font-black px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg">
                {summary.collectionRate}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 mt-3 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  summary.collectionRate >= 80 ? 'bg-emerald-500' :
                  summary.collectionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, summary.collectionRate))}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mt-2">
              <span>تم تحصيل {summary.collectionRate}%</span>
              <span>متبقي {100 - summary.collectionRate}%</span>
            </div>
          </div>

          {/* Card 5: Scope & Volume */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500">حجم العمليات</span>
              <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                <Building size={18} />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-900 mt-2">
              {summary.transactionCount} <span className="text-xs font-normal text-slate-400">حركة</span>
            </div>
            <div className="text-[11px] text-slate-400 font-bold mt-1">
              تغطي {summary.villasCount || 0} فيلا و {summary.parcelsCount || 0} برسل
            </div>
          </div>

        </div>

        {/* PRINTABLE STATEMENT CONTAINER (Visible on Screen & for Print) */}
        <div ref={reportPrintRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* OFFICIAL COMPANY HEADER (Shows in Print & Clean on Screen) */}
          <div className="p-6 border-b border-slate-200 bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-xs rounded-md">
                    مستند معتمد
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">
                    سجل أعمال وتصفية حسابات
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                  شركة الحاج رفعت
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5">
                  لتجارة وتوزيع مواد البناء والجبس والأسمنت
                </p>
              </div>

              <div className="text-left sm:text-left bg-white/10 p-3.5 rounded-xl border border-white/10 text-xs space-y-1">
                <div>
                  <span className="text-slate-300">البيان: </span>
                  <span className="font-black text-amber-300">{reportData?.parcel?.name || 'تقرير شامل'}</span>
                </div>
                <div>
                  <span className="text-slate-300">الفترة: </span>
                  <span className="font-bold text-white">
                    {fromDate || toDate ? `${fromDate || 'البداية'} إلى ${toDate || 'اليوم'}` : 'جميع الحركات المسجلة'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-300">تاريخ الطباعة: </span>
                  <span className="font-bold text-white" dir="ltr">{new Date().toLocaleDateString('ar-EG')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: DETAILED LEDGER TABLE */}
          {viewMode === 'detailed' && (
            <div className="space-y-4">
              
              {/* Table Search & Instant Filter Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute right-3 top-2.5 text-slate-400" size={17} />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="بحث سريع في النتائج برقم الفيلا، البرسل، الصنف أو التاريخ..."
                    className="w-full pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  {tableSearch && (
                    <button
                      onClick={() => setTableSearch('')}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-bold">
                  عرض {filteredTransactions.length} من أصل {summary.transactionCount} حركة
                </div>
              </div>

              {/* Table Data */}
              {loading ? (
                <div className="py-20 text-center text-slate-400 font-bold">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                  <span>جاري استخراج بيانات كشف الحساب...</span>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-bold space-y-2">
                  <FileText size={48} className="mx-auto text-slate-300" />
                  <p className="text-base text-slate-600">لا توجد عمليات تطابق معايير التصفية المحددة</p>
                  <p className="text-xs text-slate-400">جرب تعديل خيارات الفلترة أو نطاق التاريخ.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-300">
                        <th className="p-3 text-center w-12 border-l border-slate-200">#</th>
                        <th className="p-3 text-center w-24 border-l border-slate-200">التاريخ</th>
                        <th className="p-3 text-center w-20 border-l border-slate-200">الفيلا</th>
                        <th className="p-3 text-center w-24 border-l border-slate-200">البرسل</th>
                        <th className="p-3 border-l border-slate-200">نوع البند / الصنف</th>
                        <th className="p-3 text-center w-20 border-l border-slate-200">الكمية</th>
                        <th className="p-3 text-center w-24 border-l border-slate-200">سعر الوحدة</th>
                        <th className="p-3 text-center w-28 bg-indigo-50/70 border-l border-slate-200 text-indigo-900 font-black">
                          إجمالي القيمة
                        </th>
                        <th className="p-3 text-center w-28 bg-emerald-50/70 border-l border-slate-200 text-emerald-900 font-black">
                          المدفوع
                        </th>
                        <th className="p-3 text-center w-28 bg-red-50/70 border-l border-slate-200 text-red-900 font-black">
                          الصافي المتبقي
                        </th>
                        <th className="p-3 text-center w-32 bg-slate-200/70 border-l border-slate-300 text-slate-900 font-black">
                          الرصيد التراكمي
                        </th>
                        <th className="p-3 text-center w-28 no-print border-l border-slate-200">حالة السداد</th>
                        <th className="p-3 text-center w-20 no-print">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredTransactions.map((t, idx) => {
                        const isPaid = t.payment_status === 'paid';
                        const isPartial = t.payment_status === 'partial';

                        return (
                          <tr 
                            key={t.id || idx}
                            className={`transition-colors ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            } hover:bg-indigo-50/40`}
                          >
                            <td className="p-3 text-center text-slate-400 font-bold border-l border-slate-100">
                              {idx + 1}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700 border-l border-slate-100" dir="ltr">
                              {t.record_date ? new Date(t.record_date).toLocaleDateString('ar-EG') : '-'}
                            </td>
                            <td className="p-3 text-center font-black text-slate-900 border-l border-slate-100">
                              {t.villa || '-'}
                            </td>
                            <td className="p-3 text-center font-black text-indigo-700 border-l border-slate-100">
                              {t.barsal || '-'}
                            </td>
                            <td className="p-3 font-bold text-slate-800 border-l border-slate-100">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 text-[11px] font-bold">
                                {t.type || '-'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-black text-slate-800 border-l border-slate-100" dir="ltr">
                              {Number(t.quantity || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-600 border-l border-slate-100" dir="ltr">
                              {Number(t.unit_price || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-center font-black text-indigo-900 bg-indigo-50/30 border-l border-slate-100" dir="ltr">
                              {Number(t.total_amount || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-center font-black text-emerald-700 bg-emerald-50/30 border-l border-slate-100" dir="ltr">
                              {Number(t.paid_amount || 0).toLocaleString()}
                            </td>
                            <td className={`p-3 text-center font-black border-l border-slate-100 ${
                              Number(t.net_amount || 0) > 0 ? 'text-red-700 bg-red-50/40' : 'text-emerald-700 bg-emerald-50/40'
                            }`} dir="ltr">
                              {Number(t.net_amount || 0).toLocaleString()}
                            </td>
                            <td className="p-3 text-center font-black text-slate-900 bg-slate-100/60 border-l border-slate-200" dir="ltr">
                              {Number(t.running_net || 0).toLocaleString()} ج.م
                            </td>
                            <td className="p-3 text-center no-print">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                isPaid 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                  : isPartial
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-red-100 text-red-800 border border-red-200'
                              }`}>
                                {isPaid ? 'خالص' : isPartial ? 'مسدد جزئياً' : 'غير مسدد'}
                              </span>
                            </td>
                            <td className="p-3 text-center no-print border-l border-slate-100">
                              <button
                                onClick={() => handleDeleteRecord(t.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-lg transition-colors font-bold inline-flex items-center justify-center"
                                title="حذف هذا السجل"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    
                    {/* TABLE TOTALS FOOTER */}
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-900">
                        <td colSpan="5" className="p-3 text-center text-amber-300 font-extrabold border-l border-slate-800">
                          الإجمالي الكلي للعمليات المعروضة ({filteredTransactions.length} حركة)
                        </td>
                        <td className="p-3 text-center font-black border-l border-slate-800" dir="ltr">
                          {searchTotals.quantity.toLocaleString()}
                        </td>
                        <td className="p-3 text-center text-slate-400 border-l border-slate-800">-</td>
                        <td className="p-3 text-center font-black text-amber-300 border-l border-slate-800" dir="ltr">
                          {searchTotals.total.toLocaleString()} ج.م
                        </td>
                        <td className="p-3 text-center font-black text-emerald-400 border-l border-slate-800" dir="ltr">
                          {searchTotals.paid.toLocaleString()} ج.م
                        </td>
                        <td className="p-3 text-center font-black text-red-400 border-l border-slate-800" dir="ltr">
                          {searchTotals.net.toLocaleString()} ج.م
                        </td>
                        <td className="p-3 text-center font-black text-white border-l border-slate-800" dir="ltr">
                          {searchTotals.net.toLocaleString()} ج.م
                        </td>
                        <td className="p-3 no-print border-l border-slate-800"></td>
                        <td className="p-3 no-print"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: GROUPED SUMMARY BY VILLA & BARSAL */}
          {viewMode === 'grouped' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <Building className="text-indigo-600" size={18} />
                  <span>تصفية مجمعة حسب الفيلات والبرسل ({reportData?.groupedByParcel?.length || 0} موقع)</span>
                </h3>
                <span className="text-xs text-slate-400 font-bold">
                  اضغط على أي موقع للانتقال لكشف حسابه التفصيلي
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(reportData?.groupedByParcel || []).map((grp, idx) => {
                  const rate = Number(grp.total_amount) > 0 
                    ? Math.round((Number(grp.total_paid) / Number(grp.total_amount)) * 100) 
                    : 100;
                  const isSettled = Number(grp.total_net) <= 0;

                  return (
                    <div 
                      key={idx}
                      className="bg-slate-50 hover:bg-indigo-50/40 p-4 rounded-xl border border-slate-200 transition-all space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-black text-xs rounded-md">
                              فيلا {grp.villa}
                            </span>
                            <span className="font-extrabold text-slate-800 text-sm">
                              برسل {grp.barsal}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-bold block mt-1">
                            {grp.tx_count} عمليات توريد مسجلة
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          isSettled ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {isSettled ? 'خالص' : 'متبقي'}
                        </span>
                      </div>

                      {/* Numbers Grid */}
                      <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-center text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">الإجمالي</span>
                          <span className="font-extrabold text-slate-900" dir="ltr">
                            {Number(grp.total_amount || 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-600 block font-bold">المدفوع</span>
                          <span className="font-extrabold text-emerald-700" dir="ltr">
                            {Number(grp.total_paid || 0).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-red-600 block font-bold">المتبقي</span>
                          <span className="font-black text-red-700" dir="ltr">
                            {Number(grp.total_net || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                          <span>نسبة السداد:</span>
                          <span className="font-black text-slate-800">{rate}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${rate >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                            style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
                          />
                        </div>
                      </div>

                      {/* Action to Filter by this Villa + Delete */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          onClick={() => {
                            setSelectedVilla(grp.villa);
                            setViewMode('detailed');
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <Eye size={13} />
                          <span>كشف الحساب</span>
                        </button>
                        <button
                          onClick={() => handleDeleteParcel(grp.villa, grp.barsal)}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                          title="حذف البرسل بالكامل"
                        >
                          <Trash2 size={13} />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WRITTEN TAFQEET & SUMMARY BANNER */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
            <div className="font-extrabold text-slate-700 flex items-center gap-2">
              <span className="text-slate-400">تفقيط المبلغ المتبقي:</span>
              <span className="text-red-700 font-black bg-red-50 px-2 py-1 rounded border border-red-200">
                {tafqeet(summary.totalNet || 0)}
              </span>
            </div>

            <div className="text-[11px] text-slate-400 font-bold">
              تصفية حسابات ومطابقة حركة البرسل والفيلات - شركة الحاج رفعت
            </div>
          </div>

          {/* OFFICIAL STAMP & SIGNATURE AREA (Appears on Print) */}
          <div className="p-8 border-t border-slate-200 hidden print:grid grid-cols-3 gap-6 text-center text-xs text-slate-700">
            <div>
              <div className="font-black">إعداد المحاسب المسؤول</div>
              <div className="text-[10px] text-slate-400 mt-0.5">التوقيع والاعتماد</div>
              <div className="mt-12 border-b border-dashed border-slate-400 w-36 mx-auto"></div>
            </div>
            <div>
              <div className="font-black">مراجعة الإدارة المالية</div>
              <div className="text-[10px] text-slate-400 mt-0.5">توقيع المراجع</div>
              <div className="mt-12 border-b border-dashed border-slate-400 w-36 mx-auto"></div>
            </div>
            <div>
              <div className="font-black">استلام العميل / المهندس المشرف</div>
              <div className="text-[10px] text-slate-400 mt-0.5">خاتم الشركة / التوقيع</div>
              <div className="mt-12 border-b border-dashed border-slate-400 w-36 mx-auto"></div>
            </div>
          </div>

        </div>

      </div>

      {/* WHATSAPP SHARE MODAL */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scaleUp border border-slate-100">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <MessageCircle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">مشاركة كشف الحساب عبر واتساب</h3>
                  <p className="text-xs text-slate-400">إرسال ملخص الحساب للعميل أو المشرف مباشرة</p>
                </div>
              </div>
              <button 
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Phone Input */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">
                رقم هاتف المستلم (اختياري - أو اتركه فارغاً لفتح قائمة واتساب):
              </label>
              <input
                type="text"
                placeholder="مثال: 01012345678"
                value={whatsAppPhone}
                onChange={(e) => setWhatsAppPhone(e.target.value)}
                className="w-full border border-slate-200 p-2.5 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                dir="ltr"
              />
            </div>

            {/* Message Preview */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1">معاينة نص الرسالة:</label>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-mono whitespace-pre-line text-slate-800 max-h-48 overflow-y-auto leading-relaxed">
                {generateWhatsAppMessage()}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyWhatsAppMessage}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
              >
                {copiedText ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                <span>{copiedText ? 'تم النسخ بنجاح!' : 'نسخ النص'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadImage}
                className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
              >
                <FileDown size={16} />
                <span>تحميل صورة للواتساب</span>
              </button>

              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all"
              >
                <MessageCircle size={16} />
                <span>إرسال عبر واتساب</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINT CSS STYLES INJECTED */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            font-size: 10px !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

    </div>
  );
}
