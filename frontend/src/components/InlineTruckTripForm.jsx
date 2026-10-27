import React, { useState, useEffect } from 'react';
import { Plus, Check, RotateCcw, Trash2 } from 'lucide-react';
import api from '../api';

const safeDate = (d) => {
  if (!d) return new Date().toISOString().split('T')[0];
  try {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date().toISOString().split('T')[0] : parsed.toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
};

export default function InlineTruckTripForm({ vehicleId, onSuccess, editingTrip = null, onCancelEdit = null }) {
  const initialFormData = {
    trip_date: safeDate(),
    transaction_type: 'نقل',
    quantity: '',
    customer_id: '',
    address: '',
    nawlon_cost: '',
    revenues: '',
    advance_amount: '',
    commission: '',
    expenses: '',
    fuel: '',
    maintenance: '',
    gratuity_food: '',
    kilowatts: '',
    expense_statement: 'كارته وميزان',
    notes: '',
    calc_method: 'fixed'
  };

  const [formData, setFormData] = useState(initialFormData);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  useEffect(() => {
    api.get('/customers?all=true').then(res => {
      const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setCustomers(data);
    }).catch(console.error);
    api.get('/inventory/items').then(res => {
      const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setInventoryItems(data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (editingTrip) {
      const custList = Array.isArray(customers) ? customers : [];
      const foundCust = custList.find(c => c.id === editingTrip.customer_id);
      setCustomerNameInput(editingTrip.customer_name || foundCust?.name || '');
      setFormData({
        trip_date: safeDate(editingTrip.trip_date),
        transaction_type: editingTrip.transaction_type || 'نقل',
        quantity: editingTrip.quantity || '',
        customer_id: editingTrip.customer_id || '',
        address: editingTrip.to_location || '',
        nawlon_cost: editingTrip.nawlon_cost || '',
        revenues: editingTrip.revenues || '',
        advance_amount: editingTrip.advance_amount || '',
        commission: editingTrip.commission || '',
        expenses: editingTrip.expenses || '',
        fuel: editingTrip.fuel || '',
        maintenance: editingTrip.maintenance || '',
        gratuity_food: editingTrip.gratuity_food || '',
        kilowatts: editingTrip.kilowatts || '',
        expense_statement: editingTrip.expense_statement || 'كارته وميزان',
        notes: editingTrip.notes || '',
        calc_method: editingTrip.calc_method || 'fixed'
      });
    } else {
      setCustomerNameInput('');
      setFormData(initialFormData);
    }
  }, [editingTrip, customers]);

  const calcAllowanceBalance = () => {
    const nolon = Number(formData.nawlon_cost) || 0;
    const revenues = Number(formData.revenues) || 0;
    const advance = Number(formData.advance_amount) || 0;
    const commission = Number(formData.commission) || 0;
    const expenses = Number(formData.expenses) || 0;
    const fuel = Number(formData.fuel) || 0;
    const maintenance = Number(formData.maintenance) || 0;
    const gratuityFood = Number(formData.gratuity_food) || 0;

    let finalNolon = nolon;
    if (formData.calc_method === 'per_ton') {
        finalNolon = nolon * (Number(formData.quantity) || 1);
    }

    return (finalNolon + advance) - (revenues + commission + expenses + fuel + maintenance + gratuityFood);
  };

  const handleDelete = async () => {
    if (!editingTrip?.id) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الحركة؟')) return;
    setLoading(true);
    try {
      await api.delete(`/transport-trips/${editingTrip.id}`);
      onSuccess();
      if (onCancelEdit) onCancelEdit();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء الحذف');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let resolvedCustomerId = formData.customer_id || null;
      const trimmedCustomerName = customerNameInput.trim();

      if (trimmedCustomerName) {
        const custList = Array.isArray(customers) ? customers : [];
        const matched = custList.find(c => c.name && c.name.trim().toLowerCase() === trimmedCustomerName.toLowerCase());
        if (matched) {
          resolvedCustomerId = matched.id;
        } else {
          const newCustRes = await api.post('/customers', { name: trimmedCustomerName });
          if (newCustRes.data && newCustRes.data.id) {
            resolvedCustomerId = newCustRes.data.id;
          }
        }
      }

      const payload = {
        ...formData,
        customer_id: resolvedCustomerId,
        vehicle_id: vehicleId || editingTrip?.vehicle_id || null,
        to_location: formData.address,
      };
      
      if (editingTrip) {
        await api.put(`/transport-trips/${editingTrip.id}`, payload);
      } else {
        await api.post('/transport-trips', payload);
      }

      // Reset fields for fast consecutive entries
      const keepDate = formData.trip_date;
      setFormData({
        ...initialFormData,
        trip_date: keepDate
      });
      setCustomerNameInput('');
      
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.message || 'حدث خطأ أثناء الحفظ';
      alert('خطأ أثناء الحفظ: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-blue-200 p-5 space-y-4" dir="rtl">
      <div className="flex justify-between items-center pb-3 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Plus className="text-blue-600" size={20} />
          <span>{editingTrip ? `تعديل الحركة #${editingTrip.id}` : 'تسجيل حركة جديدة مباشرة'}</span>
        </h2>
        {editingTrip && onCancelEdit && (
          <button 
            type="button" 
            onClick={onCancelEdit}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={14} /> إلغاء التعديل
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <label className="block mb-1 text-xs font-bold text-gray-700">التاريخ</label>
            <input 
              required 
              type="date" 
              className="w-full border border-gray-300 p-2 rounded-lg text-xs font-semibold bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.trip_date} 
              onChange={e => setFormData({...formData, trip_date: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-gray-700">نوع الحركة</label>
            <input 
              required 
              type="text" 
              list="inline-transaction-types" 
              placeholder="طوب / أسمنت / نقل..." 
              className="w-full border border-gray-300 p-2 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.transaction_type} 
              onChange={e => setFormData({...formData, transaction_type: e.target.value})} 
            />
            <datalist id="inline-transaction-types">
              <option value="طوب" />
              <option value="أسمنت" />
              <option value="نقل" />
              <option value="توريد" />
              {inventoryItems.map(item => (
                <option key={item.id} value={item.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-gray-700">الكمية</label>
            <input 
              required 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-gray-300 p-2 rounded-lg text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" 
              dir="ltr" 
              value={formData.quantity} 
              onChange={e => setFormData({...formData, quantity: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-gray-700">الكيلووات (الكارتة)</label>
            <input 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-gray-300 p-2 rounded-lg text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" 
              dir="ltr" 
              value={formData.kilowatts} 
              onChange={e => setFormData({...formData, kilowatts: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-gray-700">اسم العميل</label>
            <input 
              type="text" 
              list="inline-customer-names" 
              placeholder="عميل أو اكتب جديد..." 
              className="w-full border border-gray-300 p-2 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
              value={customerNameInput} 
              onChange={e => setCustomerNameInput(e.target.value)} 
            />
            <datalist id="inline-customer-names">
              {(Array.isArray(customers) ? customers : []).map(c => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-gray-700">العنوان / المكان</label>
            <input 
              required 
              type="text" 
              placeholder="العنوان" 
              className="w-full border border-gray-300 p-2 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.address} 
              onChange={e => setFormData({...formData, address: e.target.value})} 
            />
          </div>
        </div>

        {/* Row 2: Financials & Expenses */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-2.5 items-end">
          <div>
            <label className="block mb-1 text-xs font-bold text-blue-700">النولون (+)</label>
            <input 
              required 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-blue-200 bg-blue-50 p-2 rounded-lg text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none" 
              dir="ltr" 
              value={formData.nawlon_cost} 
              onChange={e => setFormData({...formData, nawlon_cost: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-red-700">إيرادات دخل (-)</label>
            <input 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-red-200 bg-red-50 p-2 rounded-lg text-xs font-bold text-red-900 focus:ring-2 focus:ring-red-500 outline-none" 
              dir="ltr" 
              value={formData.revenues} 
              onChange={e => setFormData({...formData, revenues: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-emerald-700">العهدة (+)</label>
            <input 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-emerald-200 bg-emerald-50 p-2 rounded-lg text-xs font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none" 
              dir="ltr" 
              value={formData.advance_amount} 
              onChange={e => setFormData({...formData, advance_amount: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-red-700">الكمسيون (-)</label>
            <input 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-red-200 bg-red-50 p-2 rounded-lg text-xs font-bold text-red-900 focus:ring-2 focus:ring-red-500 outline-none" 
              dir="ltr" 
              value={formData.commission} 
              onChange={e => setFormData({...formData, commission: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-red-700">المصروفات (-)</label>
            <input 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-red-200 bg-red-50 p-2 rounded-lg text-xs font-bold text-red-900 focus:ring-2 focus:ring-red-500 outline-none" 
              dir="ltr" 
              value={formData.expenses} 
              onChange={e => setFormData({...formData, expenses: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-red-700">الجاز (-)</label>
            <input 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-red-200 bg-red-50 p-2 rounded-lg text-xs font-bold text-red-900 focus:ring-2 focus:ring-red-500 outline-none" 
              dir="ltr" 
              value={formData.fuel} 
              onChange={e => setFormData({...formData, fuel: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-red-700">الصيانة (-)</label>
            <input 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-red-200 bg-red-50 p-2 rounded-lg text-xs font-bold text-red-900 focus:ring-2 focus:ring-red-500 outline-none" 
              dir="ltr" 
              value={formData.maintenance} 
              onChange={e => setFormData({...formData, maintenance: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-red-700">الإكرامية (-)</label>
            <input 
              type="number" 
              step="any" 
              min="0" 
              placeholder="0" 
              className="w-full border border-red-200 bg-red-50 p-2 rounded-lg text-xs font-bold text-red-900 focus:ring-2 focus:ring-red-500 outline-none" 
              dir="ltr" 
              value={formData.gratuity_food} 
              onChange={e => setFormData({...formData, gratuity_food: e.target.value})} 
            />
          </div>

          <div>
            <label className="block mb-1 text-xs font-bold text-slate-700">بيان المصروفات</label>
            <input 
              type="text" 
              placeholder="كارته وميزان..." 
              className="w-full border border-slate-300 bg-slate-50 p-2 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.expense_statement} 
              onChange={e => setFormData({...formData, expense_statement: e.target.value})} 
            />
          </div>
        </div>

        {/* Row 3: Notes + Calculated Allowance + Submit button */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2 border-t border-gray-100">
          <div className="flex-1 w-full">
            <input 
              type="text" 
              placeholder="ملاحظات إضافية..." 
              className="w-full border border-gray-300 p-2 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none" 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
            />
          </div>

          <div className="bg-slate-800 text-white px-4 py-2 rounded-xl text-center flex items-center gap-3">
            <span className="text-xs text-slate-300 font-bold">رصيد العهدة:</span>
            <span className={`text-lg font-black ${calcAllowanceBalance() >= 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
              {calcAllowanceBalance().toLocaleString()} ج.م
            </span>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
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
          </div>
        </div>
      </form>
    </div>
  );
}
