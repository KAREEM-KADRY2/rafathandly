import React, { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function AddSupplierModal({ isOpen, onClose, onSuccess, supplierToEdit = null }) {
  const [formData, setFormData] = useState({
    name: '', type: 'مورد', contact_person: '', phone: '', alt_phone: '', address: '', governorate: '', default_credit_deadline: 3, notes: ''
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const availableItems = ['أسمنت', 'حديد', 'طوب', 'رمل', 'زلط', 'مواد بناء أخرى'];
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (supplierToEdit) {
        setFormData({
          name: supplierToEdit.name || '',
          type: supplierToEdit.type || 'مورد',
          contact_person: supplierToEdit.contact_person || '',
          phone: supplierToEdit.phone || '',
          alt_phone: supplierToEdit.alt_phone || '',
          address: supplierToEdit.address || '',
          governorate: supplierToEdit.governorate || '',
          default_credit_deadline: supplierToEdit.default_credit_deadline || 3,
          notes: supplierToEdit.notes || ''
        });
        const items = supplierToEdit.items 
          ? (Array.isArray(supplierToEdit.items) ? supplierToEdit.items.map(it => typeof it === 'string' ? it : it.item_name) : [])
          : [];
        setSelectedItems(items);
      } else {
        setFormData({ name: '', type: 'مورد', contact_person: '', phone: '', alt_phone: '', address: '', governorate: '', default_credit_deadline: 3, notes: '' });
        setSelectedItems([]);
      }
    }
  }, [isOpen, supplierToEdit]);

  if (!isOpen) return null;

  const toggleItem = (item) => {
    setSelectedItems(prev => 
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (supplierToEdit) {
        await api.put(`/suppliers/${supplierToEdit.id}`, { ...formData, items: selectedItems });
      } else {
        await api.post('/suppliers', { ...formData, items: selectedItems });
      }
      onSuccess();
      onClose();
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || 'حدث خطأ غير معروف';
      alert(`حدث خطأ أثناء الحفظ: ${errMsg}`);
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{supplierToEdit ? 'تعديل بيانات المصنع / المورد' : 'إضافة مورد / مصنع جديد'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium">اسم المصنع / المورد</label>
              <input required type="text" className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">النوع</label>
              <select className="w-full border p-2 rounded" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                <option value="مورد">مورد</option>
                <option value="مصنع">مصنع</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">رقم الهاتف</label>
              <input required type="text" className="w-full border p-2 rounded" dir="ltr" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block mb-1 text-sm font-medium">العنوان</label>
              <input type="text" className="w-full border p-2 rounded" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="block mb-1 text-sm font-medium">ملاحظات</label>
              <textarea className="w-full border p-2 rounded" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm font-medium text-gray-700">الأصناف التي يتعامل فيها (اختر صنف أو أكثر)</label>
            <div className="flex gap-3 flex-wrap">
              {availableItems.map(item => {
                const isSelected = selectedItems.includes(item);
                let colorClasses = "";
                switch(item) {
                  case 'أسمنت': colorClasses = isSelected ? 'bg-gray-600 text-white border-gray-700' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'; break;
                  case 'حديد': colorClasses = isSelected ? 'bg-slate-800 text-white border-slate-900' : 'bg-slate-50 text-slate-800 border-slate-300 hover:bg-slate-100'; break;
                  case 'طوب': colorClasses = isSelected ? 'bg-orange-600 text-white border-orange-700' : 'bg-orange-50 text-orange-800 border-orange-300 hover:bg-orange-100'; break;
                  case 'رمل': colorClasses = isSelected ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-yellow-50 text-yellow-800 border-yellow-300 hover:bg-yellow-100'; break;
                  case 'زلط': colorClasses = isSelected ? 'bg-stone-500 text-white border-stone-600' : 'bg-stone-50 text-stone-800 border-stone-300 hover:bg-stone-100'; break;
                  case 'مواد بناء أخرى': colorClasses = isSelected ? 'bg-blue-600 text-white border-blue-700' : 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'; break;
                  default: colorClasses = isSelected ? 'bg-blue-600 text-white' : 'bg-gray-50 border-gray-300';
                }
                return (
                  <label key={item} className={`flex items-center gap-2 border px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 shadow-sm ${colorClasses}`}>
                    <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleItem(item)} />
                    <span className="font-bold select-none">{item}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">إلغاء</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
