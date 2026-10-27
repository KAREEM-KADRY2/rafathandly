import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function TransportModal({ isOpen, onClose, purchaseId, onSuccess }) {
  const [formData, setFormData] = useState({
    vehicle: '', plate_number: '', driver_name: '', driver_phone: '', quantity: '', 
    from_location: '', to_location: '', trip_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }), 
    calc_method: 'per_ton', nawlon_cost: '', paid_by: 'الشركة'
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        vehicle: '', plate_number: '', driver_name: '', driver_phone: '', quantity: '', 
        from_location: '', to_location: '', trip_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }), 
        calc_method: 'per_ton', nawlon_cost: '', paid_by: 'الشركة'
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/transport-trips`, { 
        ...formData,
        supplier_id: supplierId,
        purchase_id: purchaseId
      });
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء التسجيل');
    } finally {
      setLoading(false);
    }
  };

  const calcTotal = () => {
    const rate = Number(formData.nawlon_cost) || 0;
    const qty = Number(formData.quantity) || 0;
    if (formData.calc_method === 'per_ton') return rate * qty;
    return rate;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">تسجيل بيانات النقل والنولون</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium">السيارة</label>
              <input required type="text" className="w-full border p-2 rounded" value={formData.vehicle} onChange={e => setFormData({...formData, vehicle: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">رقم اللوحة</label>
              <input type="text" className="w-full border p-2 rounded" value={formData.plate_number} onChange={e => setFormData({...formData, plate_number: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">السائق</label>
              <input required type="text" className="w-full border p-2 rounded" value={formData.driver_name} onChange={e => setFormData({...formData, driver_name: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">رقم الهاتف</label>
              <input type="text" className="w-full border p-2 rounded" dir="ltr" value={formData.driver_phone} onChange={e => setFormData({...formData, driver_phone: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">من (مكان التحميل)</label>
              <input required type="text" className="w-full border p-2 rounded" value={formData.from_location} onChange={e => setFormData({...formData, from_location: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">إلى (مكان التنزيل)</label>
              <input required type="text" className="w-full border p-2 rounded" value={formData.to_location} onChange={e => setFormData({...formData, to_location: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">الكمية المنقولة (بالطن)</label>
              <input required type="number" step="any" min="0.1" className="w-full border p-2 rounded" dir="ltr" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">تاريخ النقل</label>
              <input required type="date" className="w-full border p-2 rounded" value={formData.trip_date} onChange={e => setFormData({...formData, trip_date: e.target.value})} />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border mt-4">
            <h3 className="font-bold mb-3 border-b pb-2">حساب النولون</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium">طريقة الحساب</label>
                <select className="w-full border p-2 rounded" value={formData.calc_method} onChange={e => setFormData({...formData, calc_method: e.target.value})}>
                  <option value="per_ton">لكل طن</option>
                  <option value="per_trip">لكل نقلة</option>
                  <option value="fixed">مبلغ ثابت</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">الفئة (السعر)</label>
                <input required type="number" step="any" min="1" className="w-full border p-2 rounded" dir="ltr" value={formData.nawlon_cost} onChange={e => setFormData({...formData, nawlon_cost: e.target.value})} />
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium">مُحمل على</label>
                <select className="w-full border p-2 rounded" value={formData.paid_by} onChange={e => setFormData({...formData, paid_by: e.target.value})}>
                  <option value="الشركة">الشركة</option>
                  <option value="المصنع">المصنع / المورد</option>
                  <option value="العميل">العميل</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t flex justify-between items-center text-lg">
              <span className="font-bold text-gray-700">إجمالي النولون المستحق:</span>
              <span className="font-bold text-green-700" dir="ltr">{calcTotal().toLocaleString()} ج.م</span>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">إلغاء</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'جاري التسجيل...' : 'حفظ النقل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
