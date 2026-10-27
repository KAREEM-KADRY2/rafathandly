const fs = require('fs');

// 1. Update VehicleDetails.jsx
let vdPath = 'c:/Users/xps/Desktop/الحاج رفعت/frontend/src/pages/VehicleDetails.jsx';
let vd = fs.readFileSync(vdPath, 'utf8');

// Add Trash2 to imports
vd = vd.replace(
  "import { ArrowRight, Truck, Search, Plus, Filter, X, FileText, Edit } from 'lucide-react';",
  "import { ArrowRight, Truck, Search, Plus, Filter, X, FileText, Edit, Trash2 } from 'lucide-react';"
);

// Add delete functions before handleSearch
const deleteTripFuncs = `  const handleDeleteTrip = async (tripId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الحركة نهائياً؟')) return;
    try {
      await api.delete(\`/transport-trips/\${tripId}\`);
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
      await api.delete(\`/vehicles/\${id}\`);
      alert('تم حذف المركبة بنجاح');
      window.location.href = '/transport';
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف المركبة');
    }
  };

  const handleSearch = () => {`;

vd = vd.replace('  const handleSearch = () => {', deleteTripFuncs);

// Add Delete vehicle button in header
const headerEditBtn = `<button
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
          </button>`;

const headerWithDelete = `${headerEditBtn}
          <button
            onClick={handleDeleteVehicle}
            className="mr-2 px-3 py-1.5 bg-red-50 text-red-800 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
            title="حذف المركبة"
          >
            <Trash2 size={14} /> حذف المركبة
          </button>`;

vd = vd.replace(headerEditBtn, headerWithDelete);

// Update table actions column in VehicleDetails.jsx
const oldTableAction = `<td className="p-3 text-center">
                            <button 
                              onClick={() => {
                                setEditingTrip(t);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-2.5 py-1 rounded"
                            >
                              تعديل
                            </button>
                          </td>`;

const newTableAction = `<td className="p-3 text-center">
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
                          </td>`;

vd = vd.replace(oldTableAction, newTableAction);
fs.writeFileSync(vdPath, vd, 'utf8');
console.log('VehicleDetails.jsx updated successfully');
