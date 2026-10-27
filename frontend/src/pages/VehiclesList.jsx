import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Search, Map, Activity, FileText, Edit, Trash2 } from 'lucide-react';
import api from '../api';
import VehicleReportView from '../components/VehicleReportView';

export default function VehiclesList() {
  const [activeTab, setActiveTab] = useState('vehicles'); // 'vehicles' or 'report'
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleType, setVehicleType] = useState('عربية'); 
  
  const [formData, setFormData] = useState({
    name: '',
    plate_number: '',
    driver: '',
    notes: ''
  });
  
  const navigate = useNavigate();

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/vehicles');
      setVehicles(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch (err) {
      console.error(err);
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleOpenModal = (type) => {
    setVehicleType(type);
    setEditingVehicle(null);
    setFormData({ name: '', plate_number: '', driver: '', notes: '' });
    setIsModalOpen(true);
  };

  const handleEditVehicle = (vehicle, e) => {
    if (e) e.stopPropagation();
    setEditingVehicle(vehicle);
    setVehicleType(vehicle.type || 'عربية');
    setFormData({
      name: vehicle.name || '',
      plate_number: vehicle.plate_number || '',
      driver: vehicle.driver || '',
      notes: vehicle.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteVehicle = async (vehicleId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذه المركبة؟')) return;
    try {
      await api.delete(`/vehicles/${vehicleId}`);
      fetchVehicles();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف المركبة');
    }
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await api.put(`/vehicles/${editingVehicle.id}`, {
          ...formData,
          type: vehicleType
        });
      } else {
        await api.post('/vehicles', {
          ...formData,
          type: vehicleType
        });
      }
      setIsModalOpen(false);
      setEditingVehicle(null);
      fetchVehicles();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ المركبة');
    }
  };

  const vehicleList = Array.isArray(vehicles) ? vehicles : [];
  const filteredVehicles = vehicleList.filter(v => {
    const vName = String(v?.name || '').toLowerCase();
    const vPlate = String(v?.plate_number || '').toLowerCase();
    const vDriver = String(v?.driver || '').toLowerCase();
    const term = String(searchTerm || '').toLowerCase();
    return vName.includes(term) || vPlate.includes(term) || vDriver.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Truck className="text-blue-600" />
            تصفية العربيات / أسطول النقل
          </h2>
          <p className="text-gray-500 text-sm mt-1">عرض حركة وسجل العربيات، التقرير المالي والتشغيلي الشامل</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all ${
                activeTab === 'vehicles' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck size={18} />
              أسطول المركبات
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

          {activeTab === 'vehicles' && (
            <button
              onClick={() => handleOpenModal('عربية')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm"
            >
              <Plus size={18} />
              إضافة عربية
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Vehicles List */}
      {activeTab === 'vehicles' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-2.5 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="ابحث بالاسم، رقم اللوحة، أو السائق..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10">جاري التحميل...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVehicles.map(vehicle => (
                <div 
                  key={vehicle.id} 
                  onClick={() => navigate(`/transport/${vehicle.id}`)}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group"
                >
                  <div className={`absolute top-0 right-0 w-2 h-full ${vehicle.type === 'تريلا' ? 'bg-indigo-500' : 'bg-blue-500'}`}></div>
                  <div className="flex justify-between items-start pr-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">{vehicle.name}</h3>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-2 ${vehicle.type === 'تريلا' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                        {vehicle.type}
                      </span>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-full text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors">
                      <Truck size={24} />
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2 pr-4">
                    <div className="flex items-center text-sm text-gray-600 gap-2">
                      <Activity size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-700">رقم اللوحة:</span>
                      <span>{vehicle.plate_number || '-'}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 gap-2">
                      <Map size={16} className="text-gray-400" />
                      <span className="font-medium text-gray-700">السائق:</span>
                      <span>{vehicle.driver || '-'}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center pr-4">
                    <span className="text-xs text-blue-600 font-bold hover:underline">عرض التفاصيل &larr;</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleEditVehicle(vehicle, e)}
                        className="bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Edit size={13} />
                        تعديل
                      </button>
                      <button
                        onClick={(e) => handleDeleteVehicle(vehicle.id, e)}
                        className="bg-red-50 text-red-800 hover:bg-red-100 border border-red-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        title="حذف المركبة"
                      >
                        <Trash2 size={13} />
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredVehicles.length === 0 && (
                <div className="col-span-full text-center py-10 text-gray-500">
                  لا توجد مركبات مسجلة حالياً
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Vehicle Report */}
      {activeTab === 'report' && (
        <VehicleReportView />
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800">
                {editingVehicle ? 'تعديل بيانات المركبة' : 'إضافة مركبة جديدة'}
              </h3>
              <button 
                onClick={() => { setIsModalOpen(false); setEditingVehicle(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>
            
            <form onSubmit={handleSaveVehicle} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نوع المركبة
                </label>
                <select
                  value={vehicleType}
                  onChange={e => setVehicleType(e.target.value)}
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
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
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
                  value={formData.plate_number}
                  onChange={e => setFormData({...formData, plate_number: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  السائق
                </label>
                <input
                  type="text"
                  value={formData.driver}
                  onChange={e => setFormData({...formData, driver: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ملاحظات
                </label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20"
                ></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold"
                >
                  {editingVehicle ? 'حفظ التعديلات' : 'إضافة المركبة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
