import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Truck, Search, Plus, Filter, X, FileText, Edit, Trash2 } from 'lucide-react';
import api from '../api';
import InlineTruckTripForm from '../components/InlineTruckTripForm';
import VehicleReportView from '../components/VehicleReportView';

export default function VehicleDetails() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('movements'); // 'movements' or 'report'
  const [vehicle, setVehicle] = useState(null);
  const [summary, setSummary] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [editingTrip, setEditingTrip] = useState(null);
  const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);
  const [editVehicleForm, setEditVehicleForm] = useState({ name: '', plate_number: '', driver: '', notes: '', type: 'عربية' });

  const fetchVehicleData = () => {
    if (id) {
      api.get(`/vehicles/${id}`).then(res => setVehicle(res.data)).catch(console.error);
    }
  };

  useEffect(() => {
    fetchVehicleData();
  }, [id]);

  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/vehicles/${id}`, editVehicleForm);
      setIsEditVehicleOpen(false);
      fetchVehicleData();
    } catch (err) {
      alert(err.response?.data?.error || 'حدث خطأ أثناء تعديل بيانات المركبة');
    }
  };

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/transport-trips/vehicle/${id}`, {
        params: {
          from: fromDate || undefined,
          to: toDate || undefined
        }
      });
      setTrips(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch (err) {
      console.error(err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchTrips();
    }
  }, [id]);

  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الحركة نهائياً؟')) return;
    try {
      await api.delete(`/transport-trips/${tripId}`);
      fetchTrips();
      fetchVehicleData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف الحركة');
    }
  };

  const handleDeleteVehicle = async () => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المركبة بالكامل؟')) return;
    try {
      await api.delete(`/vehicles/${id}`);
      alert('تم حذف المركبة بنجاح');
      window.location.href = '/transport';
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف المركبة');
    }
  };

  const handleSearch = () => {
    fetchTrips();
  };

  const handleClearFilter = () => {
    setFromDate('');
    setToDate('');
    setLoading(true);
    api.get(`/transport-trips/vehicle/${id}`).then(res => {
      setTrips(Array.isArray(res.data) ? res.data : (res.data?.items || []));
      setLoading(false);
    }).catch(() => {
      setTrips([]);
      setLoading(false);
    });
  };

  const tripList = Array.isArray(trips) ? trips : [];
  const searchLower = (searchTerm || '').toLowerCase();
  const filteredTrips = tripList.filter(t => {
    if (!searchLower) return true;
    const matchesSearch = 
      (t.driver_name || '').toLowerCase().includes(searchLower) ||
      (t.plate_number || '').toLowerCase().includes(searchLower) ||
      (t.customer_name || '').toLowerCase().includes(searchLower) ||
      (t.to_location || '').toLowerCase().includes(searchLower);
      
    return matchesSearch;
  });

  const totals = (Array.isArray(filteredTrips) ? filteredTrips : []).reduce((acc, t) => {
    const totalNolon = (t.calc_method === 'per_ton' ? (t.nawlon_cost * t.quantity) : t.nawlon_cost) || 0;
    return {
      nolon: acc.nolon + totalNolon,
      revenues: acc.revenues + (Number(t.revenues) || 0),
      advance: acc.advance + (Number(t.advance_amount) || 0),
      commission: acc.commission + (Number(t.commission) || 0),
      expenses: acc.expenses + (Number(t.expenses) || 0),
      fuel: acc.fuel + (Number(t.fuel) || 0),
      maintenance: acc.maintenance + (Number(t.maintenance) || 0),
      gratuity: acc.gratuity + (Number(t.gratuity_food) || 0),
      balance: acc.balance + (Number(t.allowance_balance) || 0),
    };
  }, {
    nolon: 0, revenues: 0, advance: 0, commission: 0, expenses: 0, fuel: 0, maintenance: 0, gratuity: 0, balance: 0
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header with Back Link and Tabs */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link to="/transport" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
            <ArrowRight size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Truck className="text-blue-600" />
              تفاصيل المركبة: {vehicle ? vehicle.name : `عربية #${id}`}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {vehicle?.plate_number ? `لوحة: ${vehicle.plate_number}` : ''} {vehicle?.driver ? `| السائق: ${vehicle.driver}` : ''}
            </p>
          </div>
          <button
            onClick={() => {
              if (vehicle) {
                setEditVehicleForm({
                  name: vehicle.name || '',
                  plate_number: vehicle.plate_number || '',
                  driver: vehicle.driver || '',
                  notes: vehicle.notes || '',
                  type: vehicle.type || 'عربية'
                });
                setIsEditVehicleOpen(true);
              }
            }}
            className="mr-3 px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
          >
            <Edit size={14} /> تعديل بيانات المركبة
          </button>
          <button
            onClick={handleDeleteVehicle}
            className="mr-2 px-3 py-1.5 bg-red-50 text-red-800 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
            title="حذف المركبة"
          >
            <Trash2 size={14} /> حذف المركبة
          </button>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'movements' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck size={18} />
            حركة العهد والنولون
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'report' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={18} />
            تقرير العربية
          </button>
        </div>
      </div>

      {activeTab === 'movements' && (
        <div className="space-y-6">
          {/* Inline Entry Form directly on the page */}
          <InlineTruckTripForm 
            vehicleId={id} 
            onSuccess={fetchTrips} 
            editingTrip={editingTrip} 
            onCancelEdit={() => setEditingTrip(null)} 
          />

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
                <p className="text-sm text-gray-500 mb-1">إجمالي النولون</p>
                <p className="text-2xl font-bold text-blue-600">{(summary.total_nawlon || 0).toLocaleString()} ج.م</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100">
                <p className="text-sm text-gray-500 mb-1">إجمالي المصاريف والعهد</p>
                <p className="text-2xl font-bold text-red-600">{((summary.total_expenses || 0) + (summary.total_fuel || 0) + (summary.total_maintenance || 0) + (summary.total_advance || 0) + (summary.total_gratuity || 0)).toLocaleString()} ج.م</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                <p className="text-sm text-gray-500 mb-1">الصافي</p>
                <p className="text-2xl font-bold text-green-600">{(summary.net_amount || 0).toLocaleString()} ج.م</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">عدد النقلات</p>
                <p className="text-2xl font-bold text-gray-800">{summary.total_trips || 0}</p>
              </div>
            </div>
          )}

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-4 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">من تاريخ:</label>
                <input 
                  type="date" 
                  className="border border-gray-300 p-2 rounded-lg text-sm outline-none"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">إلى تاريخ:</label>
                <input 
                  type="date" 
                  className="border border-gray-300 p-2 rounded-lg text-sm outline-none"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
              <button 
                onClick={handleSearch}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-700 transition-colors"
              >
                بحث / عرض
              </button>
              <button 
                onClick={handleClearFilter}
                className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-100 transition-colors flex items-center gap-1"
              >
                <X size={16} /> مسح الفلتر
              </button>
            </div>
            <div className="relative w-64">
              <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="بحث في النتائج..." 
                className="w-full pr-10 border border-gray-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-9 gap-4">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center">
              <div className="text-xs text-blue-600 font-bold mb-1">إجمالي النولون</div>
              <div className="text-lg font-bold text-blue-900" dir="ltr">{Number(totals?.nolon || 0).toLocaleString()}</div>
            </div>
            <div className="bg-purple-50 border border-purple-100 p-4 rounded-xl text-center">
              <div className="text-xs text-purple-600 font-bold mb-1">إجمالي إيرادات الدخل</div>
              <div className="text-lg font-bold text-purple-900" dir="ltr">{Number(totals?.revenues || 0).toLocaleString()}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
              <div className="text-xs text-emerald-600 font-bold mb-1">إجمالي العهد</div>
              <div className="text-lg font-bold text-emerald-900" dir="ltr">{Number(totals?.advance || 0).toLocaleString()}</div>
            </div>
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
              <div className="text-xs text-red-600 font-bold mb-1">إجمالي الكمسيون</div>
              <div className="text-lg font-bold text-red-900" dir="ltr">{Number(totals?.commission || 0).toLocaleString()}</div>
            </div>
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
              <div className="text-xs text-red-600 font-bold mb-1">إجمالي المصروفات</div>
              <div className="text-lg font-bold text-red-900" dir="ltr">{Number(totals?.expenses || 0).toLocaleString()}</div>
            </div>
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
              <div className="text-xs text-red-600 font-bold mb-1">إجمالي الجاز</div>
              <div className="text-lg font-bold text-red-900" dir="ltr">{Number(totals?.fuel || 0).toLocaleString()}</div>
            </div>
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
              <div className="text-xs text-red-600 font-bold mb-1">إجمالي الصيانة</div>
              <div className="text-lg font-bold text-red-900" dir="ltr">{Number(totals?.maintenance || 0).toLocaleString()}</div>
            </div>
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
              <div className="text-xs text-red-600 font-bold mb-1">إجمالي الإكرامية</div>
              <div className="text-lg font-bold text-red-900" dir="ltr">{Number(totals?.gratuity || 0).toLocaleString()}</div>
            </div>
            <div className={`border p-4 rounded-xl text-center ${(totals?.balance || 0) >= 0 ? 'bg-green-100 border-green-200' : 'bg-red-100 border-red-200'}`}>
              <div className={`text-xs font-bold mb-1 ${(totals?.balance || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>إجمالي رصيد العهدة</div>
              <div className={`text-xl font-extrabold ${(totals?.balance || 0) >= 0 ? 'text-green-900' : 'text-red-900'}`} dir="ltr">{Number(totals?.balance || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">جاري تحميل البيانات...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 text-xs">
                      <th className="p-3 font-semibold">التاريخ</th>
                      <th className="p-3 font-semibold">نوع الحركة</th>
                      <th className="p-3 font-semibold">الكمية</th>
                      <th className="p-3 font-semibold">اسم العميل</th>
                      <th className="p-3 font-semibold">العنوان</th>
                      <th className="p-3 font-semibold text-center bg-blue-50/50">النولون</th>
                      <th className="p-3 font-semibold text-center bg-purple-50/50">إيرادات دخل</th>
                      <th className="p-3 font-semibold text-center bg-emerald-50/50">العهدة</th>
                      <th className="p-3 font-semibold text-center bg-red-50/30">الكمسيون</th>
                      <th className="p-3 font-semibold text-center bg-red-50/30">المصروفات</th>
                      <th className="p-3 font-semibold text-center bg-red-50/30">الجاز</th>
                      <th className="p-3 font-semibold text-center bg-red-50/30">الصيانة</th>
                      <th className="p-3 font-semibold text-center bg-red-50/30">الإكرامية</th>
                      <th className="p-3 font-semibold">الكيلووات</th>
                      <th className="p-3 font-semibold">بيان المصروفات</th>
                      <th className="p-3 font-semibold text-center bg-gray-100">رصيد العهدة</th>
                      <th className="p-3 font-semibold">ملاحظات</th>
                      <th className="p-3 font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(filteredTrips) ? filteredTrips : []).map(t => {
                      const totalNolon = (t.calc_method === 'per_ton' ? (t.nawlon_cost * t.quantity) : t.nawlon_cost) || 0;
                      const isPositive = Number(t.allowance_balance || 0) >= 0;

                      return (
                        <tr key={t.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors text-sm">
                          <td className="p-3 text-gray-600">{t.trip_date ? new Date(t.trip_date).toLocaleDateString('ar-EG') : '-'}</td>
                          <td className="p-3 font-semibold text-gray-700">{t.transaction_type || '-'}</td>
                          <td className="p-3 font-bold">{t.quantity}</td>
                          <td className="p-3 font-bold text-gray-800">{t.customer_name || '-'}</td>
                          <td className="p-3 text-gray-600">{t.to_location || '-'}</td>
                          <td className="p-3 text-center font-bold text-blue-700 bg-blue-50/20" dir="ltr">{Number(totalNolon).toLocaleString()}</td>
                          <td className="p-3 text-center font-bold text-purple-700 bg-purple-50/20" dir="ltr">{Number(t.revenues || 0).toLocaleString()}</td>
                          <td className="p-3 text-center font-bold text-emerald-700 bg-emerald-50/20" dir="ltr">{Number(t.advance_amount || 0).toLocaleString()}</td>
                          <td className="p-3 text-center text-red-600 bg-red-50/10" dir="ltr">{Number(t.commission || 0).toLocaleString()}</td>
                          <td className="p-3 text-center text-red-600 bg-red-50/10" dir="ltr">{Number(t.expenses || 0).toLocaleString()}</td>
                          <td className="p-3 text-center text-red-600 bg-red-50/10" dir="ltr">{Number(t.fuel || 0).toLocaleString()}</td>
                          <td className="p-3 text-center text-red-600 bg-red-50/10" dir="ltr">{Number(t.maintenance || 0).toLocaleString()}</td>
                          <td className="p-3 text-center text-red-600 bg-red-50/10" dir="ltr">{Number(t.gratuity_food || 0).toLocaleString()}</td>
                          <td className="p-3 text-center font-bold text-gray-800" dir="ltr">{Number(t.kilowatts || 0).toLocaleString()}</td>
                          <td className="p-3 text-gray-600 max-w-[150px] truncate" title={t.expense_statement}>{t.expense_statement || '-'}</td>
                          <td className={`p-3 text-center font-extrabold ${isPositive ? 'text-green-700 bg-green-50/50' : 'text-red-700 bg-red-50/50'}`} dir="ltr">
                            {Number(t.allowance_balance || 0).toLocaleString()}
                          </td>
                          <td className="p-3 text-gray-500 max-w-[150px] truncate" title={t.notes}>{t.notes || '-'}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => {
                                  setEditingTrip(t);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
                                title="تعديل الحركة"
                              >
                                <Edit size={13} />
                                <span>تعديل</span>
                              </button>
                              <button 
                                onClick={() => handleDeleteTrip(t.id)}
                                className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded flex items-center gap-1 transition-colors"
                                title="حذف الحركة"
                              >
                                <Trash2 size={13} />
                                <span>حذف</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTrips.length === 0 && (
                      <tr>
                        <td colSpan="18" className="p-12 text-center text-gray-500 font-bold text-lg">
                          لا توجد حركات مسجلة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'report' && (
        <VehicleReportView initialVehicleId={id} />
      )}

      {isEditVehicleOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">
                تعديل بيانات المركبة
              </h3>
              <button 
                onClick={() => setIsEditVehicleOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                X
              </button>
            </div>
            
            <form onSubmit={handleUpdateVehicle} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نوع المركبة
                </label>
                <select
                  value={editVehicleForm.type}
                  onChange={e => setEditVehicleForm({...editVehicleForm, type: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="عربية">عربية</option>
                  <option value="تريلا">تريلا</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الاسم (مطلوب)
                </label>
                <input
                  type="text"
                  required
                  value={editVehicleForm.name}
                  onChange={e => setEditVehicleForm({...editVehicleForm, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="اسم المركبة أو رقم التعريف"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  رقم اللوحة
                </label>
                <input
                  type="text"
                  value={editVehicleForm.plate_number}
                  onChange={e => setEditVehicleForm({...editVehicleForm, plate_number: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  السائق
                </label>
                <input
                  type="text"
                  value={editVehicleForm.driver}
                  onChange={e => setEditVehicleForm({...editVehicleForm, driver: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ملاحظات
                </label>
                <textarea
                  value={editVehicleForm.notes}
                  onChange={e => setEditVehicleForm({...editVehicleForm, notes: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg font-bold"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditVehicleOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-medium"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
