import React, { useState, useEffect, useRef } from 'react';
import { FileStack, Search, Plus, Trash2, Edit, Save, X, RotateCcw, CheckCircle, FileText } from 'lucide-react';
import api from '../api';
import BarsalReport from '../components/BarsalReport';

export default function BarsalList() {
  const [records, setRecords] = useState([]);
  const [existingBarsalNames, setExistingBarsalNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editRecord, setEditRecord] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [selectedReportParcelId, setSelectedReportParcelId] = useState('all');
  const formRef = useRef(null);

  const initialFormData = {
    record_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    villa: '',
    barsal: '',
    type: '',
    quantity: '',
    unit_price: '',
    paid_amount: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!showReport) {
      fetchRecords();
      fetchBarsalNames();
    }
  }, [showReport]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await api.get('/barsal');
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء جلب بيانات البرسل');
    } finally {
      setLoading(false);
    }
  };

  const fetchBarsalNames = async () => {
    try {
      const res = await api.get('/barsal/names');
      if (Array.isArray(res.data)) {
        setExistingBarsalNames(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditClick = (record) => {
    setEditRecord(record);
    setFormData({
      record_date: record.record_date ? record.record_date.split(' ')[0] : new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
      villa: record.villa || '',
      barsal: record.barsal || '',
      type: record.type || '',
      quantity: record.quantity ? String(record.quantity) : '',
      unit_price: record.unit_price ? String(record.unit_price) : '',
      paid_amount: record.paid_amount ? String(record.paid_amount) : ''
    });
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCancelEdit = () => {
    setEditRecord(null);
    setFormData(initialFormData);
  };

  const qtyNum = parseFloat(formData.quantity) || 0;
  const priceNum = parseFloat(formData.unit_price) || 0;
  const calculatedTotal = qtyNum * priceNum;
  const paidNum = parseFloat(formData.paid_amount) || 0;
  const calculatedNet = calculatedTotal - paidNum;

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        total_amount: calculatedTotal,
        paid_amount: paidNum,
        net_amount: calculatedNet
      };

      if (editRecord) {
        await api.put(`/barsal/${editRecord.id}`, payload);
      } else {
        await api.post('/barsal', payload);
      }

      // Reset form but keep today's date & last entered barsal name for quick entry
      const lastBarsal = formData.barsal;
      setEditRecord(null);
      setFormData({
        ...initialFormData,
        barsal: lastBarsal
      });

      fetchRecords();
      fetchBarsalNames();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'حدث خطأ أثناء حفظ السجل');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    try {
      await api.delete(`/barsal/${id}`);
      fetchRecords();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
    }
  };

  const searchLower = (searchTerm || '').toLowerCase();
  const filteredRecords = (Array.isArray(records) ? records : []).filter(r => 
    !searchLower ||
    (r.villa || '').toLowerCase().includes(searchLower) ||
    (r.barsal || '').toLowerCase().includes(searchLower) ||
    (r.type || '').toLowerCase().includes(searchLower)
  );

  const calculateTotals = () => {
    let totalAmount = 0, paidAmount = 0, netAmount = 0;
    
    filteredRecords.forEach(r => {
      totalAmount += Number(r.total_amount) || 0;
      paidAmount += Number(r.paid_amount) || 0;
      netAmount += Number(r.net_amount) || 0;
    });

    return { count: filteredRecords.length, totalAmount, paidAmount, netAmount };
  };

  const totals = calculateTotals();

  if (showReport) {
    return (
      <BarsalReport 
        defaultParcelId={selectedReportParcelId} 
        onClose={() => {
          setShowReport(false);
          setSelectedReportParcelId('all');
        }} 
      />
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <FileStack className="text-indigo-600" size={28} />
            حساب البرسل (مستقل)
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-bold">دفتر تسجيل وتصفية حركات الفيلات والبرسل مستقل عن الخزن</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              setSelectedReportParcelId('all');
              setShowReport(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-sm shadow-indigo-600/20 transition-all text-sm"
          >
            <FileText size={18} />
            <span>تقرير وكشف حساب البرسل</span>
          </button>
        </div>
      </div>

      {/* INLINE FORM BOX (Single-Line Compact Row) */}
      <div ref={formRef} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Plus className="text-indigo-600" size={18} />
            {editRecord ? `تعديل عملية برسل #${editRecord.id}` : 'تسجيل عملية برسل جديدة'}
          </h2>
          {editRecord && (
            <button 
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={13} /> إلغاء التعديل
            </button>
          )}
        </div>

        <form onSubmit={handleSubmitForm}>
          <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2.5 items-end bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">التاريخ</label>
              <input 
                required 
                type="date" 
                className="w-full border border-slate-300 p-2 rounded-lg bg-white font-bold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
                value={formData.record_date} 
                onChange={e => setFormData({...formData, record_date: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">الفيلا</label>
              <input 
                type="text" 
                placeholder="رقم / اسم الفيلا" 
                className="w-full border border-slate-300 p-2 rounded-lg bg-white font-bold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
                value={formData.villa} 
                onChange={e => setFormData({...formData, villa: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">البرسل</label>
              <input 
                type="text" 
                placeholder="اسم / رقم البرسل" 
                list="barsal-names-list"
                className="w-full border border-slate-300 p-2 rounded-lg bg-white font-bold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
                value={formData.barsal} 
                onChange={e => setFormData({...formData, barsal: e.target.value})} 
              />
              <datalist id="barsal-names-list">
                {existingBarsalNames.map((name, idx) => (
                  <option key={idx} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">النوع</label>
              <input 
                type="text" 
                placeholder="طوب، رمل..." 
                className="w-full border border-slate-300 p-2 rounded-lg bg-white font-bold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">الكمية</label>
              <input 
                type="number" 
                step="any" 
                min="0"
                placeholder="0"
                className="w-full border border-slate-300 p-2 rounded-lg bg-white font-extrabold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-center" 
                dir="ltr"
                value={formData.quantity} 
                onChange={e => setFormData({...formData, quantity: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">السعر</label>
              <input 
                type="number" 
                step="any" 
                min="0"
                placeholder="0"
                className="w-full border border-slate-300 p-2 rounded-lg bg-white font-extrabold text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm text-center" 
                dir="ltr"
                value={formData.unit_price} 
                onChange={e => setFormData({...formData, unit_price: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-indigo-700 mb-1">الإجمالي</label>
              <div className="w-full bg-indigo-50 border border-indigo-200 p-2 rounded-lg font-black text-xs text-indigo-900 text-center shadow-inner h-[38px] flex items-center justify-center" dir="ltr">
                {calculatedTotal.toLocaleString()}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-emerald-700 mb-1">المدفوع</label>
              <input 
                type="number" 
                step="any" 
                min="0"
                placeholder="0"
                className="w-full border border-emerald-300 p-2 rounded-lg bg-emerald-50/60 font-extrabold text-xs text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm text-center" 
                dir="ltr"
                value={formData.paid_amount} 
                onChange={e => setFormData({...formData, paid_amount: e.target.value})} 
              />
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-700 mb-1">الصافي</label>
              <div className={`w-full p-2 rounded-lg font-black text-xs text-center border h-[38px] flex items-center justify-center ${calculatedNet >= 0 ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950' : 'bg-rose-100/80 border-rose-300 text-rose-950'}`} dir="ltr">
                {calculatedNet.toLocaleString()}
              </div>
            </div>

            <div>
              <button 
                type="submit" 
                disabled={saving}
                className="w-full h-[38px] bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg shadow transition-all flex items-center justify-center gap-1.5 text-xs disabled:opacity-50 active:scale-95"
              >
                <Save size={15} />
                {saving ? '...' : (editRecord ? 'تحديث' : 'حفظ')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-100 p-4 rounded-2xl text-center shadow-sm">
          <div className="text-xs text-slate-500 font-extrabold mb-1">إجمالي العمليات</div>
          <div className="text-xl font-black text-slate-800" dir="ltr">{totals.count}</div>
        </div>
        <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl text-center shadow-sm">
          <div className="text-xs text-indigo-700 font-extrabold mb-1">إجمالي الإجمالي</div>
          <div className="text-xl font-black text-indigo-900" dir="ltr">{totals.totalAmount.toLocaleString()}</div>
        </div>
        <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-2xl text-center shadow-sm">
          <div className="text-xs text-emerald-700 font-extrabold mb-1">إجمالي المدفوع</div>
          <div className="text-xl font-black text-emerald-900" dir="ltr">{totals.paidAmount.toLocaleString()}</div>
        </div>
        <div className={`border p-4 rounded-2xl text-center shadow-sm ${totals.netAmount >= 0 ? 'bg-emerald-100/70 border-emerald-200' : 'bg-rose-100/70 border-rose-200'}`}>
          <div className={`text-xs font-extrabold mb-1 ${totals.netAmount >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>إجمالي الصافي</div>
          <div className={`text-2xl font-black ${totals.netAmount >= 0 ? 'text-emerald-950' : 'text-rose-950'}`} dir="ltr">{totals.netAmount.toLocaleString()}</div>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-3 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="بحث بالفيلا، البرسل، أو النوع..." 
            className="w-full pr-10 border border-slate-200 p-2.5 rounded-xl font-bold text-sm text-slate-800 focus:ring-2 focus:ring-indigo-100 outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* RECORDS TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold">جاري تحميل البيانات...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs font-black">
                  <th className="p-4 font-black">التاريخ</th>
                  <th className="p-4 font-black">الفيلا</th>
                  <th className="p-4 font-black">البرسل</th>
                  <th className="p-4 font-black">النوع</th>
                  <th className="p-4 font-black text-center">الكمية</th>
                  <th className="p-4 font-black text-center">السعر</th>
                  <th className="p-4 font-black text-center bg-indigo-50/50">الإجمالي</th>
                  <th className="p-4 font-black text-center bg-emerald-50/50">المدفوع</th>
                  <th className="p-4 font-black text-center bg-slate-100">الصافي</th>
                  <th className="p-4 font-black text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map(r => {
                  const isPositive = r.net_amount >= 0;
                  const isEditingThis = editRecord && editRecord.id === r.id;

                  return (
                    <tr 
                      key={r.id} 
                      className={`border-b border-slate-100 transition-colors text-sm ${
                        isEditingThis ? 'bg-amber-50/80 font-bold border-amber-200' : 'hover:bg-indigo-50/30'
                      }`}
                    >
                      <td className="p-4 text-slate-600 font-bold">{new Date(r.record_date).toLocaleDateString('ar-EG')}</td>
                      <td className="p-4 font-extrabold text-slate-900">{r.villa || '-'}</td>
                      <td className="p-4 font-extrabold text-slate-900">{r.barsal || '-'}</td>
                      <td className="p-4 text-slate-700 font-bold">{r.type || '-'}</td>
                      <td className="p-4 text-center font-black">{r.quantity}</td>
                      <td className="p-4 text-center text-slate-700 font-bold" dir="ltr">{Number(r.unit_price).toLocaleString()}</td>
                      <td className="p-4 text-center font-black text-indigo-700 bg-indigo-50/30" dir="ltr">{Number(r.total_amount).toLocaleString()}</td>
                      <td className="p-4 text-center font-black text-emerald-700 bg-emerald-50/30" dir="ltr">{Number(r.paid_amount).toLocaleString()}</td>
                      <td className={`p-4 text-center font-black ${isPositive ? 'text-emerald-700 bg-emerald-50/40' : 'text-rose-700 bg-rose-50/40'}`} dir="ltr">
                        {Number(r.net_amount).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => {
                              setSelectedReportParcelId(r.id);
                              setShowReport(true);
                            }}
                            className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors font-bold" 
                            title="كشف حساب هذا البرسل"
                          >
                            <FileText size={18} />
                          </button>
                          <button 
                            onClick={() => handleEditClick(r)} 
                            className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors font-bold" 
                            title="تعديل"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(r.id)} 
                            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors font-bold" 
                            title="حذف"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan="10" className="p-12 text-center text-slate-400 text-base font-bold">لا توجد سجلات برسل مطابقة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
