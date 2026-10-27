import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import AddOtherExpenseModal from '../components/AddOtherExpenseModal';

export default function OtherExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total: 0 });
  const [groupedSummary, setGroupedSummary] = useState([]);
  const [names, setNames] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    expense_name: 'الكل'
  });

  const fetchExpenses = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.expense_name !== 'الكل') queryParams.append('expense_name', filters.expense_name);

      const [listRes, summaryRes, namesRes] = await Promise.all([
        api.get(`/other-expenses?${queryParams.toString()}`),
        api.get(`/other-expenses/summary?${queryParams.toString()}`),
        api.get('/other-expenses/names')
      ]);
      setExpenses(listRes.data || []);
      setSummary(summaryRes.data?.overall || { count: 0, total: 0 });
      setGroupedSummary(summaryRes.data?.grouped || []);
      setNames(namesRes.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const handleEdit = (expense) => {
    setExpenseToEdit(expense);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المصروف نهائياً؟')) {
      try {
        await api.delete(`/other-expenses/${id}`);
        fetchExpenses();
      } catch (error) {
        alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
      }
    }
  };

  const handleDateFilterPreset = (preset) => {
    const today = new Date();
    let start = '';
    let end = today.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

    if (preset === 'today') {
      start = end;
    } else if (preset === 'week') {
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
      start = firstDay.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
      end = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      start = firstDay.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
      end = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
    }

    setFilters({ ...filters, startDate: start, endDate: end });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">مصروفات أخرى</h1>
          <p className="text-gray-500 mt-1">مصروفات الشركة العامة (كهرباء، مياه، أدوات، إلخ...)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/expenses" className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">الرجوع للمصروفات</Link>
          <button 
            onClick={() => { setExpenseToEdit(null); setIsModalOpen(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus size={20} />
            <span>إضافة مصروف</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
          <p className="text-gray-500 text-sm mb-1">إجمالي المصروفات الأخرى (للفترة)</p>
          <p className="text-3xl font-bold text-blue-600">{summary.total?.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
          <p className="text-gray-500 text-sm mb-1">عدد العمليات</p>
          <p className="text-3xl font-bold text-gray-800">{summary.count}</p>
        </div>
      </div>

      {groupedSummary.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {groupedSummary.map(g => (
            <div key={g.expense_name} 
              className="bg-white min-w-[150px] p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center cursor-pointer hover:bg-gray-50"
              onClick={() => setFilters({...filters, expense_name: g.expense_name})}
            >
              <h3 className="font-bold text-gray-700">{g.expense_name}</h3>
              <p className="text-lg font-bold text-slate-800 mt-2">{g.total?.toLocaleString()} ج.م</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-4">
          <Filter size={20} className="text-gray-500" />
          <h2 className="font-bold">تصفية النتائج</h2>
        </div>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">اسم المصروف</label>
            <select className="w-full border p-2 rounded" value={filters.expense_name} onChange={(e) => setFilters({...filters, expense_name: e.target.value})}>
              <option value="الكل">الكل</option>
              {names.map((n, idx) => <option key={idx} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">من تاريخ</label>
            <input type="date" className="border p-2 rounded w-40" value={filters.startDate} onChange={(e) => setFilters({...filters, startDate: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">إلى تاريخ</label>
            <input type="date" className="border p-2 rounded w-40" value={filters.endDate} onChange={(e) => setFilters({...filters, endDate: e.target.value})} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleDateFilterPreset('today')} className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded">اليوم</button>
            <button onClick={() => handleDateFilterPreset('week')} className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded">الأسبوع</button>
            <button onClick={() => handleDateFilterPreset('month')} className="text-sm px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded">الشهر</button>
            <button onClick={() => setFilters({ startDate: '', endDate: '', expense_name: 'الكل' })} className="text-sm px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded">إلغاء</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-4 font-semibold text-gray-600">التاريخ</th>
              <th className="p-4 font-semibold text-gray-600">اسم المصروف</th>
              <th className="p-4 font-semibold text-gray-600">المبلغ</th>
              <th className="p-4 font-semibold text-gray-600">الحساب المالي</th>
              <th className="p-4 font-semibold text-gray-600">البيان</th>
              <th className="p-4 font-semibold text-gray-600">رقم المستند</th>
              <th className="p-4 font-semibold text-gray-600 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-4">{new Date(expense.expense_date).toLocaleDateString('ar-EG')}</td>
                <td className="p-4 font-bold">{expense.expense_name}</td>
                <td className="p-4 font-bold text-blue-600">{expense.amount?.toLocaleString()} ج.م</td>
                <td className="p-4 text-sm font-medium text-slate-700">{expense.account_name || 'النقدي'}</td>
                <td className="p-4 text-sm max-w-xs truncate">{expense.description || '-'}</td>
                <td className="p-4 text-sm">{expense.document_number || '-'}</td>
                <td className="p-4">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => handleEdit(expense)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="تعديل المصروف">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(expense.id)} className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors" title="حذف المصروف">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan="7" className="p-8 text-center text-gray-500">
                  لا توجد مصروفات في هذه الفترة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddOtherExpenseModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchExpenses}
        expense={expenseToEdit}
      />
    </div>
  );
}
