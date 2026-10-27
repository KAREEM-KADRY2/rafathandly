import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Edit2, Calendar, FileText, Printer, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import AddWorkerModal from '../components/AddWorkerModal';
import DailyAttendanceModal from '../components/DailyAttendanceModal';
import OpeningBalanceModal from '../components/OpeningBalanceModal';
import WorkerStatementModal from '../components/WorkerStatementModal';

export default function WorkersList() {
  const [workers, setWorkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState(null);
  const [obModalWorker, setObModalWorker] = useState(null);
  const [statementWorkerId, setStatementWorkerId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  const fetchWorkers = async (page = currentPage, search = searchTerm) => {
    try {
      const res = await api.get('/workers', {
        params: { page, limit: itemsPerPage, search }
      });
      if (res.data && Array.isArray(res.data.items)) {
        setWorkers(res.data.items);
        setTotalCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setWorkers(res.data);
        setTotalCount(res.data.length);
        setTotalPages(Math.ceil(res.data.length / itemsPerPage) || 1);
      } else {
        setWorkers([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
      setWorkers([]);
      setTotalCount(0);
      setTotalPages(1);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchWorkers(currentPage, searchTerm);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [currentPage, searchTerm]);

  const handleEdit = (worker) => {
    setWorkerToEdit(worker);
    setIsModalOpen(true);
  };

  const handleDeleteWorker = async (worker) => {
    if (window.confirm(`هل أنت متأكد من حذف العامل "${worker.name}" نهائياً؟ سيتم حذف بيانات العامل وكافة مسحوباته وسجلاته.`)) {
      try {
        await api.delete(`/workers/${worker.id}`);
        fetchWorkers(currentPage, searchTerm);
      } catch (error) {
        console.error('Error deleting worker:', error);
        alert(error.response?.data?.error || 'حدث خطأ أثناء حذف العامل');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إدارة العمال</h1>
          <p className="text-gray-500 mt-1">إدارة المسحوبات والمصروفات الخاصة بالعمال</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsAttendanceModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
          >
            <Calendar size={20} />
            <span>حضور وغياب العمال</span>
          </button>
          <button 
            onClick={() => { setWorkerToEdit(null); setIsModalOpen(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={20} />
            <span>إضافة عامل</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative">
          <input
            type="text"
            placeholder="ابحث باسم العامل أو رقم الهاتف..."
            className="w-full border p-3 pl-10 rounded-lg bg-gray-50 focus:bg-white transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-3 text-gray-400" size={20} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 font-semibold text-gray-600">اسم العامل</th>
              <th className="p-4 font-semibold text-gray-600">رقم الهاتف</th>
              <th className="p-4 font-semibold text-gray-600">الوظيفة</th>
              <th className="p-4 font-semibold text-gray-600">الراتب الشهري</th>
              <th className="p-4 font-semibold text-gray-600">الرصيد الافتتاحي (سابق)</th>
              <th className="p-4 font-semibold text-gray-600">ملاحظات</th>
              <th className="p-4 font-semibold text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(workers) ? workers : []).map((worker) => (
              <tr key={worker.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-4 font-medium">{worker.name}</td>
                <td className="p-4" dir="ltr">{worker.phone}</td>
                <td className="p-4">{worker.job_title}</td>
                <td className="p-4">{worker.monthly_salary ? parseFloat(worker.monthly_salary).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) : '-'}</td>
                <td className="p-4">
                  {worker.opening_balance_amount > 0 ? (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      worker.opening_balance_type === 'debit' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`} dir="ltr">
                      {Number(worker.opening_balance_amount).toLocaleString()} ج.م ({worker.opening_balance_type === 'debit' ? 'سلفة عليه' : 'مستحق له'})
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="p-4 text-gray-500">{worker.notes}</td>
                <td className="p-4">
                  <div className="flex gap-2 items-center">
                    <button onClick={() => setObModalWorker(worker)} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-md flex items-center gap-1 text-xs font-bold" title="رصيد افتتاحي">
                      <FileText size={14} />
                      رصيد افتتاحي
                    </button>
                    <Link to={`/expenses/workers/${worker.id}`} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg" title="عرض الملف">
                      <Eye size={18} />
                    </Link>
                    <button onClick={() => setStatementWorkerId(worker.id)} className="text-[#1a2b4c] hover:bg-blue-50 p-2 rounded-lg" title="طباعة كشف حساب وملف العامل">
                      <Printer size={18} />
                    </button>
                    <button onClick={() => handleEdit(worker)} className="text-green-600 hover:bg-green-50 p-2 rounded-lg" title="تعديل">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDeleteWorker(worker)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="حذف العامل">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!Array.isArray(workers) || workers.length === 0) && (
              <tr>
                <td colSpan="7" className="p-8 text-center text-gray-500">
                  {searchTerm ? 'لا يوجد عمال مطابقين للبحث' : 'لا يوجد عمال مسجلين حتى الآن'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center text-sm font-semibold">
            <span className="text-gray-600">
              عرض {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} من إجمالي {totalCount} عامل
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

      <AddWorkerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchWorkers}
        worker={workerToEdit}
      />
      <DailyAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        onSuccess={fetchWorkers}
      />
      {obModalWorker && (
        <OpeningBalanceModal
          isOpen={!!obModalWorker}
          onClose={() => setObModalWorker(null)}
          entityType="worker"
          entityId={obModalWorker.id}
          entityName={obModalWorker.name}
          onSuccess={fetchWorkers}
        />
      )}
      <WorkerStatementModal
        isOpen={!!statementWorkerId}
        workerId={statementWorkerId}
        onClose={() => setStatementWorkerId(null)}
      />
    </div>
  );
}
