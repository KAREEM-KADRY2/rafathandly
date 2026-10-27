import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, Calendar, Filter, FileText, Download, Printer, Eye, X, Search, 
  CheckCircle, XCircle, DollarSign, Activity, Wrench, Fuel, TrendingUp, TrendingDown, RefreshCw
} from 'lucide-react';
import api from '../api';

export default function VehicleReportView({ initialVehicleId }) {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || '');
  const [vehicleSearch, setVehicleSearch] = useState('');
  
  const [periodType, setPeriodType] = useState('monthly');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [tripSearch, setTripSearch] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');

  // Fetch list of vehicles
  useEffect(() => {
    api.get('/vehicles')
      .then(res => {
        const vList = Array.isArray(res.data) ? res.data : [];
        setVehicles(vList);
        if (!selectedVehicleId && vList.length > 0) {
          setSelectedVehicleId(vList[0].id.toString());
        }
      })
      .catch(err => console.error('Error fetching vehicles:', err));
  }, []);

  useEffect(() => {
    if (initialVehicleId) {
      setSelectedVehicleId(initialVehicleId.toString());
    }
  }, [initialVehicleId]);

  // Fetch report data when selected vehicle or period changes
  const fetchReport = async (vId = selectedVehicleId) => {
    if (!vId) return;
    try {
      setLoading(true);
      const params = { periodType };
      if (periodType === 'custom') {
        if (fromDate) params.fromDate = fromDate;
        if (toDate) params.toDate = toDate;
      }
      const res = await api.get(`/vehicles/${vId}/report`, { params });
      setReportData(res.data);
    } catch (err) {
      console.error('Error fetching report:', err);
      alert('حدث خطأ أثناء تحميل بيانات التقرير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedVehicleId) {
      fetchReport(selectedVehicleId);
    }
  }, [selectedVehicleId, periodType]);

  const handleApplyFilter = () => {
    fetchReport(selectedVehicleId);
  };

  const handleDownloadPDF = async () => {
    if (!selectedVehicleId) return;
    try {
      setDownloadingPdf(true);
      const params = new URLSearchParams({ periodType });
      if (periodType === 'custom') {
        if (fromDate) params.append('fromDate', fromDate);
        if (toDate) params.append('toDate', toDate);
      }
      
      const response = await api.get(`/vehicles/${selectedVehicleId}/report/pdf?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `تقرير_عربية_${reportData?.vehicle?.name || selectedVehicleId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('حدث خطأ أثناء تحميل ملف PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredVehicles = (Array.isArray(vehicles) ? vehicles : []).filter(v => {
    const vName = String(v?.name || '').toLowerCase();
    const vPlate = String(v?.plate_number || '').toLowerCase();
    const vDriver = String(v?.driver || '').toLowerCase();
    const term = String(vehicleSearch || '').toLowerCase();
    return vName.includes(term) || vPlate.includes(term) || vDriver.includes(term);
  });

  const filteredTrips = (reportData?.trips || []).filter(t => {
    if (!tripSearch) return true;
    const term = tripSearch.toLowerCase();
    return (
      (t.customer_name || '').toLowerCase().includes(term) ||
      (t.supplier_name || '').toLowerCase().includes(term) ||
      (t.from_location || '').toLowerCase().includes(term) ||
      (t.to_location || '').toLowerCase().includes(term) ||
      (t.transaction_type || '').toLowerCase().includes(term)
    );
  });

  const filteredExpenses = (reportData?.expenses || []).filter(e => {
    if (!expenseSearch) return true;
    const term = expenseSearch.toLowerCase();
    return (
      (e.expense_type || '').toLowerCase().includes(term) ||
      (e.description || '').toLowerCase().includes(term) ||
      (e.notes || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-600" />
              تقرير العربية الشامل
            </h2>
            <p className="text-gray-500 text-sm mt-1">عرض وتحليل حركة الإيرادات، المصروفات، والأداء التشغيلي للمركبة</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsPreviewOpen(true)}
              disabled={!reportData}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <Eye size={18} />
              معاينة التقرير
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={!reportData || downloadingPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              <Download size={18} />
              {downloadingPdf ? 'جاري التحميل...' : 'تحميل التقرير PDF'}
            </button>
          </div>
        </div>

        {/* 2. Selectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
          {/* Vehicle Selector */}
          <div className="lg:col-span-4 space-y-1">
            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1">
              <Truck size={14} className="text-blue-600" />
              اختر المركبة:
            </label>
            <select
              value={selectedVehicleId}
              onChange={e => setSelectedVehicleId(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
            >
              <option value="">-- اختر مركبة --</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.type || 'عربية'}) {v.plate_number ? `- ${v.plate_number}` : ''} {v.driver ? `(${v.driver})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Period Selector Buttons */}
          <div className="lg:col-span-5 space-y-1">
            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1">
              <Calendar size={14} className="text-blue-600" />
              الفترة الزمانية:
            </label>
            <div className="flex flex-wrap gap-1 bg-white p-1 rounded-lg border border-gray-300 shadow-sm">
              {[
                { id: 'daily', label: 'يومي' },
                { id: 'weekly', label: 'أسبوعي' },
                { id: 'monthly', label: 'شهري' },
                { id: 'yearly', label: 'سنوي' },
                { id: 'custom', label: 'مخصص' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriodType(p.id)}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                    periodType === p.id 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs & Fetch Button */}
          {periodType === 'custom' ? (
            <div className="lg:col-span-3 flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-0.5">من:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-500 mb-0.5">إلى:</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none"
                />
              </div>
              <button
                onClick={handleApplyFilter}
                className="bg-blue-600 text-white p-2 rounded-lg font-bold text-xs hover:bg-blue-700 transition-colors mt-4"
                title="تطبيق الفلتر"
              >
                <Filter size={16} />
              </button>
            </div>
          ) : (
            <div className="lg:col-span-3 flex justify-end">
              <button
                onClick={handleApplyFilter}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                تحديث التقرير
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500 font-bold">
          جاري استخراج وحساب تقرير العربية...
        </div>
      )}

      {!loading && reportData && (
        <>
          {/* 3. Vehicle Info Banner */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl shadow-md p-5 border border-slate-700">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div>
                <div className="text-slate-400 text-xs font-medium">اسم العربية</div>
                <div className="text-lg font-extrabold text-blue-400 truncate">{reportData.vehicle.name}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-medium">نوع العربية</div>
                <div className="text-base font-bold text-white">{reportData.vehicle.type || 'عربية'}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-medium">رقم اللوحة</div>
                <div className="text-base font-bold text-white">{reportData.vehicle.plate_number || '-'}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-medium">السائق</div>
                <div className="text-base font-bold text-white">{reportData.vehicle.driver || '-'}</div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-medium">فترة التقرير</div>
                <div className="text-xs font-bold text-emerald-400">
                  {reportData.period.fromDate} إلى {reportData.period.toDate}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-xs font-medium">تاريخ الاستخراج</div>
                <div className="text-xs font-bold text-slate-300">{reportData.period.created_at}</div>
              </div>
            </div>
          </div>

          {/* 4. Financial Summary */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <DollarSign size={20} className="text-emerald-600" />
              الملخص المالي
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-between">
                <div className="text-xs font-bold text-blue-600 mb-1">إجمالي إيرادات النقل</div>
                <div className="text-2xl font-black text-blue-900" dir="ltr">
                  {Number(reportData.financials.totalTransportRevenue).toLocaleString()} <span className="text-xs font-bold text-blue-600">ج.م</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100 flex flex-col justify-between">
                <div className="text-xs font-bold text-red-600 mb-1">إجمالي المصروفات</div>
                <div className="text-2xl font-black text-red-900" dir="ltr">
                  {Number(reportData.financials.totalExpenses).toLocaleString()} <span className="text-xs font-bold text-red-600">ج.م</span>
                </div>
              </div>

              <div className={`bg-white p-4 rounded-xl shadow-sm border flex flex-col justify-between ${
                reportData.financials.netResult >= 0 ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 bg-rose-50/20'
              }`}>
                <div className={`text-xs font-bold mb-1 ${reportData.financials.netResult >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  صافي نتيجة العربية
                </div>
                <div className={`text-2xl font-black ${reportData.financials.netResult >= 0 ? 'text-emerald-800' : 'text-rose-800'}`} dir="ltr">
                  {Number(reportData.financials.netResult).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 flex flex-col justify-between">
                <div className="text-xs font-bold text-amber-600 mb-1 flex items-center gap-1">
                  <Fuel size={14} /> الوقود / السولار
                </div>
                <div className="text-xl font-bold text-amber-900" dir="ltr">
                  {Number(reportData.financials.totalFuel).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-purple-100 flex flex-col justify-between">
                <div className="text-xs font-bold text-purple-600 mb-1 flex items-center gap-1">
                  <Wrench size={14} /> الصيانة والإصلاح
                </div>
                <div className="text-xl font-bold text-purple-900" dir="ltr">
                  {Number(reportData.financials.totalMaintenance).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <div className="text-xs font-bold text-gray-600 mb-1">مصروفات إضافية أخرى</div>
                <div className="text-xl font-bold text-gray-800" dir="ltr">
                  {Number(reportData.financials.totalOtherExpenses).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Operational Summary */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Activity size={20} className="text-blue-600" />
              الملخص التشغيلي
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-slate-600 mb-1">عدد الرحلات</div>
                <div className="text-2xl font-black text-slate-800">{reportData.operationals.totalTrips}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-slate-600 mb-1">الكميات المنقولة</div>
                <div className="text-2xl font-black text-slate-800">{reportData.operationals.totalQuantity}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-slate-600 mb-1">متوسط قيمة الرحلة</div>
                <div className="text-xl font-black text-slate-800" dir="ltr">{Math.round(reportData.operationals.avgTripValue).toLocaleString()} ج.م</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-slate-600 mb-1">عدد أيام العمل</div>
                <div className="text-2xl font-black text-slate-800">{reportData.operationals.workDaysCount} يوم</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-emerald-700 mb-1">رحلات مكتملة</div>
                <div className="text-2xl font-black text-emerald-900">{reportData.operationals.completedTrips}</div>
              </div>
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-rose-700 mb-1">رحلات ملغاة</div>
                <div className="text-2xl font-black text-rose-900">{reportData.operationals.cancelledTrips}</div>
              </div>
            </div>
          </div>

          {/* 6. Trips Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden space-y-3 p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Truck size={18} className="text-blue-600" />
                تفاصيل رحلات النقل ({filteredTrips.length})
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="بحث في الرحلات..."
                  value={tripSearch}
                  onChange={e => setTripSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-2.5 text-center">#</th>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">الجهة (عميل / مورد)</th>
                    <th className="p-2.5">من</th>
                    <th className="p-2.5">إلى</th>
                    <th className="p-2.5">نوع الحمولة</th>
                    <th className="p-2.5 text-center">الكمية</th>
                    <th className="p-2.5 text-center">سعر النقل</th>
                    <th className="p-2.5 text-center bg-blue-50 text-blue-800">إجمالي النولون</th>
                    <th className="p-2.5 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTrips.map((t, idx) => {
                    const totalNawlon = t.calc_method === 'per_ton' ? ((t.nawlon_cost || 0) * (t.quantity || 1)) : (t.nawlon_cost || 0);
                    return (
                      <tr key={t.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 text-center font-bold text-gray-500">{idx + 1}</td>
                        <td className="p-2.5 font-semibold text-gray-700">{t.trip_date ? String(t.trip_date).split('T')[0] : '-'}</td>
                        <td className="p-2.5 font-bold text-gray-800">{t.customer_name || t.supplier_name || 'غير محدد'}</td>
                        <td className="p-2.5 text-gray-600">{t.from_location || '-'}</td>
                        <td className="p-2.5 text-gray-600">{t.to_location || '-'}</td>
                        <td className="p-2.5 font-medium text-gray-700">{t.transaction_type || 'نقل'}</td>
                        <td className="p-2.5 text-center font-bold">{t.quantity || 0}</td>
                        <td className="p-2.5 text-center font-medium" dir="ltr">{Number(t.nawlon_cost || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-center font-extrabold text-blue-700 bg-blue-50/50" dir="ltr">{Number(totalNawlon).toLocaleString()}</td>
                        <td className="p-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.status === 'cancelled' || t.status === 'ملغاة' 
                              ? 'bg-rose-100 text-rose-800' 
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {t.status === 'cancelled' || t.status === 'ملغاة' ? 'ملغاة' : 'مكتملة'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTrips.length === 0 && (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-gray-400 font-bold">
                        لا توجد رحلات مطابقة للبحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 7. Expenses Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden space-y-3 p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Wrench size={18} className="text-purple-600" />
                تفاصيل المصروفات المباشرة ({filteredExpenses.length})
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="بحث في المصروفات..."
                  value={expenseSearch}
                  onChange={e => setExpenseSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                    <th className="p-2.5 text-center">#</th>
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">نوع المصروف</th>
                    <th className="p-2.5">البيان / الوصف</th>
                    <th className="p-2.5 text-center bg-red-50 text-red-800">المبلغ</th>
                    <th className="p-2.5">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredExpenses.map((e, idx) => (
                    <tr key={e.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 text-center font-bold text-gray-500">{idx + 1}</td>
                      <td className="p-2.5 font-semibold text-gray-700">{e.expense_date ? String(e.expense_date).split('T')[0] : '-'}</td>
                      <td className="p-2.5 font-bold text-purple-800">{e.expense_type || 'مصروف'}</td>
                      <td className="p-2.5 text-gray-700">{e.description || '-'}</td>
                      <td className="p-2.5 text-center font-extrabold text-red-700 bg-red-50/50" dir="ltr">{Number(e.amount || 0).toLocaleString()} ج.م</td>
                      <td className="p-2.5 text-gray-500">{e.notes || '-'}</td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-gray-400 font-bold">
                        لا توجد مصروفات مباشرة مطابقة للبحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 8. Print Preview Modal */}
      {isPreviewOpen && reportData && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Top Bar */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center print:hidden">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Eye size={20} className="text-blue-400" />
                معاينة التقرير قبل الطباعة
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Download size={14} /> تحميل PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer size={14} /> طباعة
                </button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body - Printable Document */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-right bg-white print:p-0" dir="rtl">
              {/* Executive Header Banner */}
              <div className="bg-slate-900 text-white p-5 rounded-xl flex justify-between items-center border-b-4 border-blue-500 shadow-sm">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-white">تقرير التصفية الحسابية - {reportData.vehicle.name}</h1>
                  <p className="text-xs text-slate-400 mt-1">{reportData.companyName} | الفترة: من {reportData.period.fromDate} إلى {reportData.period.toDate}</p>
                </div>
                <div className="text-left">
                  <div className="bg-blue-900/50 border border-blue-400 text-blue-300 px-3 py-1 rounded-full font-extrabold text-sm inline-block mb-1">
                    🚛 {reportData.vehicle.name} ({reportData.vehicle.type || 'عربية'})
                  </div>
                  <div className="text-[11px] text-slate-300">تاريخ الاستخراج: {reportData.period.created_at}</div>
                </div>
              </div>

              {/* 2. كروت ملخص العربية الحسابية */}
              <div>
                <h4 className="font-bold text-xs text-slate-800 mb-2.5 flex items-center gap-2">
                  <span className="w-1 h-3.5 bg-emerald-600 rounded-full inline-block"></span>
                  مؤشرات الأداء المالي الحسابية
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white border-r-4 border-r-blue-600 border border-slate-200 p-3 rounded-lg shadow-2xs">
                    <div className="text-xs font-bold text-slate-600 mb-1">إجمالي إيرادات النقل</div>
                    <div className="text-base font-black text-blue-800" dir="ltr">{Number(reportData.financials.totalTransportRevenue).toLocaleString()} <span className="text-xs font-medium text-slate-500">ج.م</span></div>
                  </div>
                  <div className="bg-white border-r-4 border-r-red-600 border border-slate-200 p-3 rounded-lg shadow-2xs">
                    <div className="text-xs font-bold text-slate-600 mb-1">إجمالي المصروفات</div>
                    <div className="text-base font-black text-red-800" dir="ltr">{Number(reportData.financials.totalExpenses).toLocaleString()} <span className="text-xs font-medium text-slate-500">ج.م</span></div>
                  </div>
                  <div className={`border-r-4 border border-slate-200 p-3 rounded-lg shadow-2xs ${
                    reportData.financials.netResult >= 0 ? 'border-r-emerald-600 bg-emerald-50/50' : 'border-r-rose-600 bg-rose-50/50'
                  }`}>
                    <div className={`text-xs font-bold mb-1 ${reportData.financials.netResult >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>صافي نتيجة العربية</div>
                    <div className={`text-base font-black ${reportData.financials.netResult >= 0 ? 'text-emerald-800' : 'text-rose-800'}`} dir="ltr">{Number(reportData.financials.netResult).toLocaleString()} <span className="text-xs font-medium">ج.م</span></div>
                  </div>
                  <div className="bg-white border-r-4 border-r-amber-500 border border-slate-200 p-3 rounded-lg shadow-2xs">
                    <div className="text-xs font-bold text-slate-600 mb-1">مصروفات الوقود والسولار</div>
                    <div className="text-base font-bold text-amber-800" dir="ltr">{Number(reportData.financials.totalFuel).toLocaleString()} <span className="text-xs font-medium text-slate-500">ج.م</span></div>
                  </div>
                  <div className="bg-white border-r-4 border-r-purple-600 border border-slate-200 p-3 rounded-lg shadow-2xs">
                    <div className="text-xs font-bold text-slate-600 mb-1">مصروفات الصيانة والإصلاح</div>
                    <div className="text-base font-bold text-purple-800" dir="ltr">{Number(reportData.financials.totalMaintenance).toLocaleString()} <span className="text-xs font-medium text-slate-500">ج.م</span></div>
                  </div>
                  <div className="bg-white border-r-4 border-r-slate-600 border border-slate-200 p-3 rounded-lg shadow-2xs">
                    <div className="text-xs font-bold text-slate-600 mb-1">مصروفات إضافية أخرى</div>
                    <div className="text-base font-bold text-slate-800" dir="ltr">{Number(reportData.financials.totalOtherExpenses).toLocaleString()} <span className="text-xs font-medium text-slate-500">ج.م</span></div>
                  </div>
                </div>
              </div>

              {/* 3. جدول التحليل التفصيلي */}
              <div>
                <h4 className="font-bold text-xs text-slate-800 mb-2.5 flex items-center gap-2">
                  <span className="w-1 h-3.5 bg-slate-900 rounded-full inline-block"></span>
                  جدول تحليل وتوزيع النتائج المالية
                </h4>
                <table className="w-full text-right border-collapse text-xs border border-slate-300 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold">
                      <th className="p-2.5 border border-slate-700 text-center">إجمالي إيرادات النقل</th>
                      <th className="p-2.5 border border-slate-700 text-center">إجمالي المصروفات</th>
                      <th className="p-2.5 border border-slate-700 text-center">وقود / سولار</th>
                      <th className="p-2.5 border border-slate-700 text-center">صيانة وإصلاح</th>
                      <th className="p-2.5 border border-slate-700 text-center">مصروفات أخرى</th>
                      <th className="p-2.5 border border-slate-700 text-center">صافي نتيجة العربية</th>
                      <th className="p-2.5 border border-slate-700 text-center">عدد الرحلات</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200 text-center font-medium">
                      <td className="p-2.5 border border-slate-300 font-bold text-blue-700" dir="ltr">{Number(reportData.financials.totalTransportRevenue).toLocaleString()} ج.م</td>
                      <td className="p-2.5 border border-slate-300 font-bold text-red-700" dir="ltr">{Number(reportData.financials.totalExpenses).toLocaleString()} ج.م</td>
                      <td className="p-2.5 border border-slate-300" dir="ltr">{Number(reportData.financials.totalFuel).toLocaleString()} ج.م</td>
                      <td className="p-2.5 border border-slate-300" dir="ltr">{Number(reportData.financials.totalMaintenance).toLocaleString()} ج.م</td>
                      <td className="p-2.5 border border-slate-300" dir="ltr">{Number(reportData.financials.totalOtherExpenses).toLocaleString()} ج.م</td>
                      <td className={`p-2.5 border border-slate-300 font-extrabold ${
                        reportData.financials.netResult >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                      }`} dir="ltr">
                        {Number(reportData.financials.netResult).toLocaleString()} ج.م
                      </td>
                      <td className="p-2.5 border border-slate-300 font-bold">{reportData.operationals.totalTrips} رحلة</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* توقيعات الاعتماد الرسمي */}
              <div className="flex justify-between pt-6 border-t border-dashed border-slate-300 text-center">
                <div className="w-40">
                  <div className="text-xs font-bold text-slate-600 mb-6">إعداد الحسابات</div>
                  <div className="border-b border-slate-400 w-32 mx-auto"></div>
                </div>
                <div class="w-40">
                  <div className="text-xs font-bold text-slate-600 mb-6">مراجعة إدارة الحركة</div>
                  <div className="border-b border-slate-400 w-32 mx-auto"></div>
                </div>
                <div className="w-40">
                  <div className="text-xs font-bold text-slate-600 mb-6">يعتمد المدير العام</div>
                  <div className="border-b border-slate-400 w-32 mx-auto"></div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400">
                نظام إدارة الحسابات والنقل - تم الاستخراج آلياً من {reportData.companyName} بتاريخ {reportData.period.created_at}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
