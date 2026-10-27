const fs = require('fs');

let vlPath = 'c:/Users/xps/Desktop/الحاج رفعت/frontend/src/pages/VehiclesList.jsx';
let vl = fs.readFileSync(vlPath, 'utf8');

// Add Trash2 to imports
vl = vl.replace(
  "import { Truck, Plus, Search, Map, Activity, FileText, Edit } from 'lucide-react';",
  "import { Truck, Plus, Search, Map, Activity, FileText, Edit, Trash2 } from 'lucide-react';"
);

// Add handleDeleteVehicle function before handleSaveVehicle
const deleteVehicleFunc = `  const handleDeleteVehicle = async (vehicleId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذه المركبة؟')) return;
    try {
      await api.delete(\`/vehicles/\${vehicleId}\`);
      fetchVehicles();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'حدث خطأ أثناء حذف المركبة');
    }
  };

  const handleSaveVehicle = async (e) => {`;

vl = vl.replace('  const handleSaveVehicle = async (e) => {', deleteVehicleFunc);

// Update card actions
const oldCardAction = `<button
                      onClick={(e) => handleEditVehicle(vehicle, e)}
                      className="bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <Edit size={13} />
                      تعديل
                    </button>`;

const newCardAction = `<div className="flex items-center gap-1.5">
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
                    </div>`;

vl = vl.replace(oldCardAction, newCardAction);
fs.writeFileSync(vlPath, vl, 'utf8');
console.log('VehiclesList.jsx updated successfully');
