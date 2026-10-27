const fs = require('fs');

let itPath = 'c:/Users/xps/Desktop/الحاج رفعت/frontend/src/components/InlineTruckTripForm.jsx';
let it = fs.readFileSync(itPath, 'utf8');

// Add Trash2 to imports
it = it.replace(
  "import { Plus, Check, RotateCcw } from 'lucide-react';",
  "import { Plus, Check, RotateCcw, Trash2 } from 'lucide-react';"
);

// Add handleDeleteTrip function before handleSubmit
const deleteTripFunc = `  const handleDelete = async () => {
    if (!editingTrip?.id) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الحركة؟')) return;
    setLoading(true);
    try {
      await api.delete(\`/transport-trips/\${editingTrip.id}\`);
      onSuccess();
      if (onCancelEdit) onCancelEdit();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {`;

it = it.replace('  const handleSubmit = async (e) => {', deleteTripFunc);

// Add Delete button next to save button
const oldSubmitBtn = `<button 
            type="submit" 
            disabled={loading} 
            className="w-full md:w-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={18} />
            <span>{loading ? 'جاري الحفظ...' : (editingTrip ? 'تعديل الحركة' : 'حفظ الحركة')}</span>
          </button>`;

const newSubmitBtn = `<div className="flex items-center gap-2 w-full md:w-auto">
            {editingTrip && (
              <button 
                type="button" 
                onClick={handleDelete}
                disabled={loading} 
                className="px-5 py-2.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 border border-red-200 font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                title="حذف الحركة"
              >
                <Trash2 size={16} />
                <span>حذف الحركة</span>
              </button>
            )}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full md:w-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check size={18} />
              <span>{loading ? 'جاري الحفظ...' : (editingTrip ? 'تعديل الحركة' : 'حفظ الحركة')}</span>
            </button>
          </div>`;

it = it.replace(oldSubmitBtn, newSubmitBtn);
fs.writeFileSync(itPath, it, 'utf8');
console.log('InlineTruckTripForm.jsx updated successfully');
