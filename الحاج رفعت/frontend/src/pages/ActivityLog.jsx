import React, { useState, useEffect } from 'react';
import { Activity, Search, Filter, Eye, AlertCircle, FileText } from 'lucide-react';
import api from '../api';


// Helper to display JSON values nicely
const PrettyJsonDisplay = ({ data, isRoot = true }) => {
  if (!data) return <span className="text-gray-400">-</span>;
  
  if (typeof data !== 'object') {
    let val = String(data);
    if (val === '') return <span className="text-gray-400">-</span>;
    if (val === 'credit') val = 'آجل';
    if (val === 'cash') val = 'نقدي';
    return <span className="font-bold text-gray-800" dir="rtl">{val}</span>;
  }
  
  if (Array.isArray(data)) {
    return (
      <div className="flex flex-col gap-3 w-full mt-2">
        {data.map((item, i) => (
          <div key={i} className="bg-white border border-indigo-100 rounded-lg p-4 shadow-sm relative">
            <div className="absolute -top-3 -right-2 bg-indigo-500 text-white px-2 py-0.5 rounded text-xs font-bold border border-indigo-600 shadow-sm">
              #{i + 1}
            </div>
            <PrettyJsonDisplay data={item} isRoot={false} />
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className={`grid grid-cols-1 gap-3 ${!isRoot ? 'mt-2' : ''}`}>
      {Object.entries(data).map(([key, val]) => {
        if (val === '' || val === null) return null; // hide empty values to keep it clean
        
        // If it's an array (like items), let it take full width
        const isArray = Array.isArray(val);
        
        return (
          <div key={key} className={`flex ${isArray ? 'col-span-1 flex-col bg-slate-50 p-4 rounded-xl border border-slate-200' : 'items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm'}`}>
            <span className={`text-xs font-bold text-gray-500 ${isArray ? 'mb-4 text-slate-700 border-b pb-2 text-base flex items-center gap-2' : ''}`}>
              {translateKey(key)}
            </span>
            <div className={isArray ? 'w-full' : 'text-sm text-left'} dir="ltr">
              <PrettyJsonDisplay data={val} isRoot={false} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const translateKey = (key) => {
  const dictionary = {
    'customer_name': 'اسم العميل',
    'supplier_name': 'اسم المورد/المصنع',
    'worker_name': 'اسم العامل',
    'party_name': 'اسم الطرف',
    'factory_name': 'اسم المصنع',
    'account_name': 'اسم الخزينة/الحساب',
    'payment_date': 'تاريخ الدفع/التحصيل',
    'reference_number': 'رقم المرجع/الإيصال',
    'credit_sale_id': 'رقم فاتورة البيع',
    'purchase_id': 'رقم فاتورة الشراء',
    'recorded_by': 'المسجِل',
    'supplier_id': 'رقم المورد',
    'customer_id': 'رقم العميل',
    'worker_id': 'رقم العامل',
    'invoice_number': 'رقم الفاتورة',
    'purchase_date': 'تاريخ الفاتورة',
    'sale_date': 'تاريخ الفاتورة',
    'location': 'الموقع / النولون',
    'notes': 'الملاحظات',
    'payment_type': 'طريقة الدفع',
    'paid_amount': 'المبلغ المدفوع',
    'total_amount': 'الإجمالي',
    'remaining_amount': 'المتبقي',
    'items': 'الأصناف',
    'item_name': 'اسم الصنف',
    'quantity': 'الكمية',
    'unit': 'الوحدة',
    'unit_price': 'سعر الوحدة',
    'name': 'الاسم',
    'phone': 'رقم التليفون',
    'address': 'العنوان',
    'balance': 'الرصيد',
    'type': 'النوع',
    'status': 'الحالة',
    'amount': 'المبلغ',
    'nawlon_cost': 'تكلفة النولون',
    'driver_name': 'اسم السائق',
    'car_number': 'رقم السيارة',
    'driver_phone': 'تليفون السائق',
    'collection_date': 'تاريخ التحصيل',
    'discount': 'الخصم',
    'nawlon_paid': 'النولون المدفوع',
    'nawlon_remaining': 'النولون المتبقي',
    'payment_status': 'حالة الدفع',
    'factory_paid': 'دفع المصنع',
    'payment_method': 'طريقة الدفع'
  };
  return dictionary[key] || key;
};

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    module: 'all',
    action: 'all',
    from: '',
    to: ''
  });

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: filters.limit || 50,
        ...filters
      });
      const res = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(res.data.data);
      setPagination(res.data.pagination);
      setSummary(res.data.summary);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [filters.module, filters.action, filters.from, filters.to]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const parseJSON = (str) => {
    if (!str) return null;
    try { return JSON.parse(str); } catch (e) { return null; }
  };

  return (
    <div className="p-4 md:p-8" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="text-indigo-600" /> سجل النشاطات (Audit Log)
          </h1>
          <p className="text-gray-500 mt-1">سجل كامل لجميع العمليات التي تمت داخل النظام</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">إجمالي العمليات</p>
            <p className="text-2xl font-bold text-gray-800">{summary.total_actions}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">عمليات اليوم</p>
            <p className="text-2xl font-bold text-indigo-600">{summary.today_actions}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">العمليات المالية</p>
            <p className="text-2xl font-bold text-emerald-600">{summary.financial_actions}</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 mb-1">عمليات المستخدمين</p>
            <p className="text-2xl font-bold text-purple-600">{summary.user_actions}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <form onSubmit={handleSearch} className="p-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="بحث بالوصف، المستخدم، العملية..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className="w-full pl-4 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <select 
            value={filters.module} 
            onChange={(e) => setFilters({...filters, module: e.target.value})}
            className="border rounded-lg px-3 py-2"
          >
            <option value="all">كل الأقسام</option>
            <option value="العملاء">العملاء</option>
            <option value="الموردين">الموردين والمصانع</option>
            <option value="المبيعات">المبيعات</option>
            <option value="المشتريات">المشتريات</option>
            <option value="المصروفات">المصروفات العامة</option>
            <option value="العمال">العمال والموظفين</option>
            <option value="مصروفات أخرى">مصروفات أخرى</option>
            <option value="المخزن">المخزن والأصناف</option>
            <option value="الخزينة">الخزينة والحسابات</option>
            <option value="تصفية العربيات">تصفية العربيات</option>
            <option value="البرسل">البرسل</option>
            <option value="الخدمات">الخدمات</option>
            <option value="السيارات والجرارات">السيارات والجرارات</option>
            <option value="الفترات المالية">الفترات المالية</option>
            <option value="إعدادات النظام">إعدادات النظام</option>
          </select>

          <input type="date" className="border rounded-lg px-3 py-2" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} title="من تاريخ" />
          <input type="date" className="border rounded-lg px-3 py-2" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} title="إلى تاريخ" />
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b">
              <tr>
                <th className="p-4 font-semibold">التاريخ والوقت</th>
                <th className="p-4 font-semibold">المستخدم</th>
                <th className="p-4 font-semibold">العملية</th>
                <th className="p-4 font-semibold">القسم</th>
                <th className="p-4 font-semibold w-1/3">التفاصيل</th>
                <th className="p-4 font-semibold">الحالة</th>
                <th className="p-4 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">جاري التحميل...</td></tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-gray-500">
                    <AlertCircle className="mx-auto mb-3 text-gray-400" size={40} />
                    لا توجد نشاطات مسجلة
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4 text-gray-600 whitespace-nowrap" dir="ltr">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                    <td className="p-4 font-medium text-gray-800">{log.user_name}</td>
                    <td className="p-4 font-medium text-indigo-700">{log.action}</td>
                    <td className="p-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{log.module}</span></td>
                    <td className="p-4 text-gray-600 truncate max-w-xs">{log.description}</td>
                    <td className="p-4">
                      {log.status === 'SUCCESS' ? 
                        <span className="text-emerald-600 font-bold">نجاح</span> : 
                        <span className="text-red-600 font-bold">فشل</span>
                      }
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Eye size={16} /> عرض التفاصيل
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center bg-gray-50">
            <button 
              disabled={pagination.page === 1}
              onClick={() => fetchLogs(pagination.page - 1)}
              className="px-4 py-2 bg-white border rounded shadow-sm disabled:opacity-50"
            >
              السابق
            </button>
            <span className="text-gray-600">الصفحة {pagination.page} من {pagination.totalPages}</span>
            <button 
              disabled={pagination.page === pagination.totalPages}
              onClick={() => fetchLogs(pagination.page + 1)}
              className="px-4 py-2 bg-white border rounded shadow-sm disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
              <h2 className="text-lg font-bold flex items-center gap-2"><FileText size={20}/> تفاصيل الحركة (#{selectedLog.id})</h2>
              <button onClick={() => setSelectedLog(null)} className="hover:bg-slate-700 p-1 rounded text-gray-300">✕</button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div><span className="text-xs text-gray-500 block">التاريخ والوقت</span><span className="font-bold">{new Date(selectedLog.created_at).toLocaleString('ar-EG')}</span></div>
                <div><span className="text-xs text-gray-500 block">المستخدم</span><span className="font-bold">{selectedLog.user_name}</span></div>
                <div><span className="text-xs text-gray-500 block">العملية</span><span className="font-bold text-indigo-700">{selectedLog.action}</span></div>
                <div><span className="text-xs text-gray-500 block">القسم</span><span className="font-bold">{selectedLog.module}</span></div>
                <div><span className="text-xs text-gray-500 block">العنصر</span><span className="font-bold">{selectedLog.entity_type} {selectedLog.entity_id ? `(#${selectedLog.entity_id})` : ''}</span></div>
                <div><span className="text-xs text-gray-500 block">الحالة</span><span className="font-bold text-emerald-600">نجاح</span></div>
              </div>

              <div className="mb-6">
                <span className="text-xs text-gray-500 block mb-1">وصف العملية</span>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-gray-800">{selectedLog.description}</div>
              </div>

              {(selectedLog.old_values || selectedLog.new_values) && (
                <div>
                  <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">تفاصيل القيم المعدلة</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedLog.old_values && (
                      <div className="bg-red-50 border border-red-100 p-3 rounded-lg">
                        <span className="text-xs text-red-600 font-bold block mb-2">القيمة السابقة</span>
                        <div className="mt-2" dir="rtl"><PrettyJsonDisplay data={parseJSON(selectedLog.old_values)} /></div>
                      </div>
                    )}
                    {selectedLog.new_values && (
                      <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg">
                        <span className="text-xs text-emerald-600 font-bold block mb-2">القيمة الجديدة</span>
                        <div className="mt-2" dir="rtl"><PrettyJsonDisplay data={parseJSON(selectedLog.new_values)} /></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-gray-50 text-left">
              <button onClick={() => setSelectedLog(null)} className="bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded shadow-sm hover:bg-gray-50 font-medium">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
