import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Edit2, Trash2, Filter, Calendar, Printer } from 'lucide-react';
import api from '../api';
import AddWorkerModal from '../components/AddWorkerModal';
import AddWithdrawalModal from '../components/AddWithdrawalModal';
import DailyAttendanceModal from '../components/DailyAttendanceModal';
import AddLeaveModal from '../components/AddLeaveModal';
import OpeningBalanceModal from '../components/OpeningBalanceModal';
import WorkerStatementModal from '../components/WorkerStatementModal';

export default function WorkerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total: 0 });
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [activeTab, setActiveTab] = useState('attendance');
  
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isOBModalOpen, setIsOBModalOpen] = useState(false);
  const [isEditWorkerOpen, setIsEditWorkerOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [editingWithdrawal, setEditingWithdrawal] = useState(null);
  
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });

  const fetchData = async () => {
    try {
      const wRes = await api.get(`/workers?all=true`);
      const list = Array.isArray(wRes.data) ? wRes.data : (wRes.data?.items || []);
      const foundWorker = list.find(w => String(w?.id) === String(id));
      setWorker(foundWorker || { notFound: true });

      if (!foundWorker) return;
      
      let queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const [wdRes, sumRes, attRes, leavesRes, mSumRes] = await Promise.allSettled([
        api.get(`/workers/${id}/withdrawals?${queryParams.toString()}`),
        api.get(`/workers/${id}/summary`),
        api.get(`/workers/${id}/attendance/advanced`),
        api.get(`/workers/${id}/leaves`),
        api.get(`/workers/${id}/attendance/summary?month=${new Date().getMonth()+1}&year=${new Date().getFullYear()}`)
      ]);

      if (wdRes.status === 'fulfilled') setWithdrawals(Array.isArray(wdRes.value?.data) ? wdRes.value.data : (wdRes.value?.data?.items || []));
      if (sumRes.status === 'fulfilled') setSummary(sumRes.value?.data || { count: 0, total: 0 });
      if (attRes.status === 'fulfilled') setAttendance(Array.isArray(attRes.value?.data) ? attRes.value.data : (attRes.value?.data?.items || []));
      if (leavesRes.status === 'fulfilled') setLeaves(Array.isArray(leavesRes.value?.data) ? leavesRes.value.data : (leavesRes.value?.data?.items || []));
      if (mSumRes.status === 'fulfilled') setMonthlySummary(mSumRes.value?.data || null);
    } catch (e) {
      console.error('Error loading worker page:', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, filters]);

  const handleDeleteWithdrawal = async (wId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المسحوبات؟')) return;
    try {
      await api.delete(`/workers/withdrawals/${wId}`);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleDeleteAttendance = async (attId) => {
    if (!window.confirm('هل أنت متأكد من حذف سجل الحضور هذا؟')) return;
    try {
      await api.delete(`/workers/attendance/${attId}`);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleDeleteLeave = async (lId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الإجازة؟')) return;
    try {
      await api.delete(`/workers/leaves/${lId}`);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
    }
  };

  const handleDeleteWorker = async () => {
    if (window.confirm(`هل أنت متأكد من حذف العامل "${worker.name}" نهائياً؟ سيتم حذف بيانات العامل وكافة مسحوباته وسجلاته.`)) {
      try {
        await api.delete(`/workers/${id}`);
        navigate('/expenses/workers');
      } catch (error) {
        alert(error.response?.data?.error || 'حدث خطأ أثناء حذف العامل');
      }
    }
  };

  if (!worker) return <div className="text-center p-8 font-bold text-gray-600">جاري تحميل بيانات العامل...</div>;
  if (worker.notFound) {
    return (
      <div className="p-8 text-center text-red-600 font-bold space-y-4">
        <p>لم يتم العثور على بيانات هذا العامل</p>
        <Link to="/expenses/workers" className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">العودة لقائمة العمال</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/expenses/workers" className="p-2 bg-white rounded-lg shadow hover:bg-gray-50">
            <ArrowRight size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">ملف العامل: {worker.name}</h1>
        </div>
        
        <div className="flex gap-2 no-print">
            <button onClick={() => setIsEditWorkerOpen(true)} className="bg-amber-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-amber-700 font-bold shadow-sm">
                <Edit2 size={18} /> تعديل بيانات العامل
            </button>
            <button onClick={() => setIsOBModalOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-bold shadow-sm">
                <Calendar size={18} /> رصيد افتتاحي
            </button>
            <button onClick={() => setIsStatementOpen(true)} className="bg-[#1a2b4c] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-950 font-bold shadow-sm">
                <Printer size={18} /> طباعة ملف العامل
            </button>
            <button onClick={() => setIsAttendanceModalOpen(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 font-bold shadow-sm">
                <Calendar size={18} /> تسجيل حضور وغياب
            </button>
            <button onClick={handleDeleteWorker} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 font-bold shadow-sm" title="حذف العامل نهائياً">
                <Trash2 size={18} /> حذف العامل
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <p className="text-gray-500 mb-2 font-bold">بيانات العامل</p>
          <div className="space-y-1 text-sm">
            <p><span className="font-semibold text-gray-500">الاسم:</span> <span className="font-bold text-gray-900">{worker.name}</span></p>
            <p><span className="font-semibold text-gray-500">الوظيفة:</span> <span className="font-bold text-gray-800">{worker.job_title || '-'}</span></p>
            <p><span className="font-semibold text-gray-500">الراتب الأساسي:</span> <span className="font-bold text-blue-700" dir="ltr">{(worker.monthly_salary || 0).toLocaleString()} ج.م</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 flex flex-col justify-center items-center">
          <p className="text-gray-500 mb-1 font-bold text-sm">الرصيد الافتتاحي (سابق)</p>
          <p className={`text-2xl font-black ${(summary.financials?.opening_balance_type === 'debit') ? 'text-amber-600' : 'text-emerald-600'}`} dir="ltr">
            {(summary.financials?.opening_balance_amount || 0).toLocaleString()} ج.م
          </p>
          <p className="text-xs text-gray-500 mt-1 font-bold">
            {summary.financials?.opening_balance_amount > 0 ? (summary.financials?.opening_balance_type === 'debit' ? '(سلفة عليه)' : '(مستحق له)') : 'غير مسجل'}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-center items-center">
          <p className="text-gray-500 mb-1 font-bold text-sm">حضور الشهر الجاري</p>
          <p className="text-3xl font-bold text-blue-600">{monthlySummary?.present || monthlySummary?.working_days || 0}</p>
          <p className="text-xs text-gray-400 mt-1 font-bold">يوم</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 flex flex-col justify-center items-center">
          <p className="text-gray-500 mb-1 font-bold text-sm">إجمالي المسحوبات</p>
          <p className="text-3xl font-bold text-red-600">{(summary.financials?.total_withdrawn || summary.total_withdrawn || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1 font-bold">ج.م</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-100 flex flex-col justify-center items-center">
          <p className="text-gray-500 mb-1 font-bold text-sm">صافي مستحق العامل</p>
          <p className={`text-2xl font-black ${(summary.financials?.remaining_salary ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} dir="ltr">
            {(summary.financials?.remaining_salary ?? 0).toLocaleString()} ج.م
          </p>
          <p className="text-[11px] text-gray-400 mt-1 font-bold truncate max-w-full" title={summary.financials?.status_message}>
            {summary.financials?.status_message || ''}
          </p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-gray-200 no-print">
        <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 font-bold ${activeTab === 'attendance' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>الحضور والانصراف</button>
        <button onClick={() => setActiveTab('leaves')} className={`px-4 py-2 font-bold ${activeTab === 'leaves' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>الإجازات</button>
        <button onClick={() => setActiveTab('withdrawals')} className={`px-4 py-2 font-bold ${activeTab === 'withdrawals' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>المسحوبات</button>
      </div>

      {activeTab === 'attendance' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 className="font-bold text-lg text-gray-800">سجل الحضور والغياب</h2>
                <button onClick={() => setIsAttendanceModalOpen(true)} className="bg-emerald-600 text-white px-3.5 py-2 rounded-lg flex items-center gap-1.5 hover:bg-emerald-700 text-sm font-bold shadow-sm">
                    <Plus size={16} /> تسجيل حضور جديد
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                    <thead className="bg-gray-100 text-gray-700 font-bold">
                        <tr>
                            <th className="p-3 border-b">التاريخ</th>
                            <th className="p-3 border-b">الحالة</th>
                            <th className="p-3 border-b">ملاحظات</th>
                            <th className="p-3 border-b text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(!Array.isArray(attendance) || attendance.length === 0) ? (
                            <tr><td colSpan="4" className="p-6 text-center text-gray-500 font-bold">لا يوجد سجلات حضور مسجلة لهذا العامل</td></tr>
                        ) : (Array.isArray(attendance) ? attendance : []).map(a => (
                            <tr key={a.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-bold text-gray-800">{a.date}</td>
                                <td className="p-3">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        a.status === 'حاضر' ? 'bg-green-100 text-green-700 border border-green-200' : 
                                        a.status === 'إجازة' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 
                                        a.status === 'نصف يوم' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                        a.status === 'عطلة' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                        'bg-red-100 text-red-700 border border-red-200'
                                    }`}>{a.status}</span>
                                </td>
                                <td className="p-3 text-gray-600">{a.notes || '-'}</td>
                                <td className="p-3 text-center">
                                    <button onClick={() => handleDeleteAttendance(a.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="حذف سجل الحضور">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h2 className="font-bold text-lg text-gray-800">سجل الإجازات</h2>
                <button onClick={() => setIsLeaveModalOpen(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 text-sm font-bold">
                    <Plus size={16} /> إضافة إجازة
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                    <thead className="bg-gray-100 text-gray-700 font-bold">
                        <tr>
                            <th className="p-3 border-b">نوع الإجازة</th>
                            <th className="p-3 border-b">من تاريخ</th>
                            <th className="p-3 border-b">إلى تاريخ</th>
                            <th className="p-3 border-b">عدد الأيام</th>
                            <th className="p-3 border-b">السبب</th>
                            <th className="p-3 border-b text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(!Array.isArray(leaves) || leaves.length === 0) ? (
                            <tr><td colSpan="6" className="p-6 text-center text-gray-500 font-bold">لا يوجد إجازات مسجلة</td></tr>
                        ) : (Array.isArray(leaves) ? leaves : []).map(l => (
                            <tr key={l.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-bold text-purple-700">{l.leave_type}</td>
                                <td className="p-3">{l.start_date}</td>
                                <td className="p-3">{l.end_date}</td>
                                <td className="p-3 font-bold">{l.days}</td>
                                <td className="p-3">{l.reason || '-'}</td>
                                <td className="p-3 flex justify-center">
                                    <button onClick={() => handleDeleteLeave(l.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'withdrawals' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b flex flex-wrap justify-between items-center gap-4 bg-gray-50">
                <h2 className="font-bold text-lg text-gray-800">المسحوبات المالية</h2>
                <div className="flex gap-2 items-center">
                    <div className="flex gap-2 items-center bg-white p-1 rounded-lg border">
                        <Filter size={16} className="text-gray-400 ml-2" />
                        <input type="date" className="border-none bg-transparent text-sm outline-none" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
                        <span className="text-gray-300">|</span>
                        <input type="date" className="border-none bg-transparent text-sm outline-none" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
                    </div>
                    <button onClick={() => { setEditingWithdrawal(null); setIsWithdrawalModalOpen(true); }} className="bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 text-sm font-bold">
                        <Plus size={16} /> سحب جديد
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                    <thead className="bg-gray-100 text-gray-700 font-bold">
                        <tr>
                            <th className="p-3 border-b">التاريخ</th>
                            <th className="p-3 border-b">النوع</th>
                            <th className="p-3 border-b">المبلغ</th>
                            <th className="p-3 border-b">البيان</th>
                            <th className="p-3 border-b text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(!Array.isArray(withdrawals) || withdrawals.length === 0) ? (
                            <tr><td colSpan="5" className="p-6 text-center text-gray-500 font-bold">لا يوجد مسحوبات مسجلة</td></tr>
                        ) : (Array.isArray(withdrawals) ? withdrawals : []).map((w, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="p-3">{w.withdrawal_date ? new Date(w.withdrawal_date).toLocaleDateString('ar-EG') : '-'}</td>
                                <td className="p-3">{w.withdrawal_type}</td>
                                <td className="p-3 font-bold text-red-600">{Number(w.amount || 0).toLocaleString()} ج.م</td>
                                <td className="p-3">{w.description || '-'}</td>
                                <td className="p-3 flex justify-center gap-2">
                                    <button onClick={() => { setEditingWithdrawal(w); setIsWithdrawalModalOpen(true); }} className="text-amber-600 hover:bg-amber-50 p-1.5 rounded transition-colors" title="تعديل السحب"><Edit2 size={16}/></button>
                                    <button onClick={() => handleDeleteWithdrawal(w.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="حذف السحب"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      <DailyAttendanceModal isOpen={isAttendanceModalOpen} onClose={() => setIsAttendanceModalOpen(false)} workerId={id} onSuccess={fetchData} />
      <AddWithdrawalModal isOpen={isWithdrawalModalOpen} onClose={() => { setIsWithdrawalModalOpen(false); setEditingWithdrawal(null); }} workerId={id} withdrawal={editingWithdrawal} onSuccess={fetchData} />
      <AddWorkerModal isOpen={isEditWorkerOpen} onClose={() => setIsEditWorkerOpen(false)} workerToEdit={worker} onSuccess={fetchData} />
      <AddLeaveModal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} workerId={id} onSuccess={fetchData} />
      <OpeningBalanceModal
        isOpen={isOBModalOpen}
        onClose={() => setIsOBModalOpen(false)}
        entityType="worker"
        entityId={id}
        entityName={worker?.name}
        onSuccess={fetchData}
      />
      <WorkerStatementModal
        isOpen={isStatementOpen}
        onClose={() => setIsStatementOpen(false)}
        workerId={id}
      />
    </div>
  );
}
