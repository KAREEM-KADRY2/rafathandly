import React, { useState, useEffect } from 'react';
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

export default function TruckTripModal({ vehicleId, onClose, onSuccess, existingTrip = null }) {
  const [formData, setFormData] = useState({
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
  });

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
    if (existingTrip) {
      const custList = Array.isArray(customers) ? customers : [];
      const foundCust = custList.find(c => c.id === existingTrip.customer_id);
      setCustomerNameInput(existingTrip.customer_name || foundCust?.name || '');
      setFormData({
        trip_date: safeDate(existingTrip.trip_date),
        transaction_type: existingTrip.transaction_type || 'نقل',
        quantity: existingTrip.quantity || '',
        customer_id: existingTrip.customer_id || '',
        address: existingTrip.to_location || '',
        nawlon_cost: existingTrip.nawlon_cost || '',
        revenues: existingTrip.revenues || '',
        advance_amount: existingTrip.advance_amount || '',
        commission: existingTrip.commission || '',
        expenses: existingTrip.expenses || '',
        fuel: existingTrip.fuel || '',
        maintenance: existingTrip.maintenance || '',
        gratuity_food: existingTrip.gratuity_food || '',
        kilowatts: existingTrip.kilowatts || '',
        expense_statement: existingTrip.expense_statement || 'كارته وميزان',
        notes: existingTrip.notes || '',
        calc_method: existingTrip.calc_method || 'fixed'
      });
    }
  }, [existingTrip, customers]);

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
          // Auto-create new customer on the fly
          const newCustRes = await api.post('/customers', { name: trimmedCustomerName });
          if (newCustRes.data && newCustRes.data.id) {
            resolvedCustomerId = newCustRes.data.id;
          }
        }
      }

      const payload = {
        ...formData,
        customer_id: resolvedCustomerId,
        vehicle_id: vehicleId || existingTrip?.vehicle_id || null,
        to_location: formData.address,
      };
      
      if (existingTrip) {
        await api.put(`/transport-trips/${existingTrip.id}`, payload);
      } else {
        await api.post('/transport-trips', payload);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.message || 'حدث خطأ أثناء الحفظ';
      alert('خطأ أثناء الحفظ: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex justify-between items-center z-10 rounded-t-2xl">
          <h2 className="text-2xl font-bold text-gray-800">{existingTrip ? 'تعديل الحركة' : 'تسجيل حركة جديدة'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">البيانات الأساسية</h3>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
              <div>
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">التاريخ</label>
                <input required type="date" className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={formData.trip_date} onChange={e => setFormData({...formData, trip_date: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">نوع الحركة</label>
                <input 
                  required 
                  type="text" 
                  list="transaction-type-suggestions" 
                  placeholder="طوب / أسمنت / نقل..." 
                  className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold" 
                  value={formData.transaction_type} 
                  onChange={e => setFormData({...formData, transaction_type: e.target.value})} 
                />
                <datalist id="transaction-type-suggestions">
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
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">الكمية</label>
                <input required type="number" step="any" min="0" placeholder="0" className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800" dir="ltr" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
              </div>
              <div>
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">الكيلووات (الكارتة)</label>
                <input type="number" step="any" min="0" placeholder="0" className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-800" dir="ltr" value={formData.kilowatts} onChange={e => setFormData({...formData, kilowatts: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">اسم العميل</label>
                <input 
                  type="text" 
                  list="customer-name-suggestions" 
                  placeholder="اختر عميل أو اكتب اسم عميل جديد..." 
                  className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all font-semibold" 
                  value={customerNameInput} 
                  onChange={e => setCustomerNameInput(e.target.value)} 
                />
                <datalist id="customer-name-suggestions">
                  {(Array.isArray(customers) ? customers : []).map(c => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">العنوان</label>
                <input required type="text" placeholder="العنوان / المكان" className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b">البيانات المالية والعهدة</h3>
            
            {/* Top row with 9 inputs including 'بيان المصروفات' at the end */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3">
              
              <div>
                <label className="block mb-1.5 text-sm font-bold text-blue-700">النولون (+)</label>
                <input required type="number" step="any" min="0" placeholder="0" className="w-full border-blue-200 bg-blue-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-900" dir="ltr" value={formData.nawlon_cost} onChange={e => setFormData({...formData, nawlon_cost: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-red-700">إيرادات دخل (-)</label>
                <input type="number" step="any" min="0" placeholder="0" className="w-full border-red-200 bg-red-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-900" dir="ltr" value={formData.revenues} onChange={e => setFormData({...formData, revenues: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-emerald-700">العهدة (+)</label>
                <input type="number" step="any" min="0" placeholder="0" className="w-full border-emerald-200 bg-emerald-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-900" dir="ltr" value={formData.advance_amount} onChange={e => setFormData({...formData, advance_amount: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-red-700">الكمسيون (-)</label>
                <input type="number" step="any" min="0" placeholder="0" className="w-full border-red-200 bg-red-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-900" dir="ltr" value={formData.commission} onChange={e => setFormData({...formData, commission: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-red-700">المصروفات (-)</label>
                <input type="number" step="any" min="0" placeholder="0" className="w-full border-red-200 bg-red-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-900" dir="ltr" value={formData.expenses} onChange={e => setFormData({...formData, expenses: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-red-700">الجاز (-)</label>
                <input type="number" step="any" min="0" placeholder="0" className="w-full border-red-200 bg-red-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-900" dir="ltr" value={formData.fuel} onChange={e => setFormData({...formData, fuel: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-red-700">الصيانة (-)</label>
                <input type="number" step="any" min="0" placeholder="0" className="w-full border-red-200 bg-red-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-900" dir="ltr" value={formData.maintenance} onChange={e => setFormData({...formData, maintenance: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-red-700">الإكرامية (-)</label>
                <input type="number" step="any" min="0" placeholder="0" className="w-full border-red-200 bg-red-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-900" dir="ltr" value={formData.gratuity_food} onChange={e => setFormData({...formData, gratuity_food: e.target.value})} />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-bold text-slate-700">بيان المصروفات</label>
                <input 
                  type="text" 
                  placeholder="كارته وميزان..." 
                  className="w-full border-slate-300 bg-slate-50 p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm" 
                  value={formData.expense_statement} 
                  onChange={e => setFormData({...formData, expense_statement: e.target.value})} 
                />
              </div>

            </div>

            {/* Bottom section: Notes & Balance Box */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center border-t border-gray-200 pt-6">
              
              <div className="md:col-span-2">
                <label className="block mb-1.5 text-sm font-semibold text-gray-700">ملاحظات</label>
                <textarea 
                  rows="3" 
                  placeholder="أي ملاحظات إضافية بخصوص الحركة..." 
                  className="w-full border-gray-300 p-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                />
              </div>

              <div className="bg-slate-800 text-white p-5 rounded-2xl shadow-inner text-center border-4 border-slate-700">
                <span className="block text-slate-300 font-semibold mb-2">رصيد العهدة (للعرض فقط)</span>
                <span className={`text-4xl font-extrabold tracking-wider ${calcAllowanceBalance() >= 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                  {calcAllowanceBalance().toLocaleString()} ج.م
                </span>
                <p className="text-xs text-slate-400 mt-3 opacity-80">
                  (النولون + العهدة) - (إيرادات دخل + الكمسيون + المصروفات + الجاز + الصيانة + الإكرامية)
                </p>
              </div>

            </div>
          </div>

          <div className="pt-4 flex justify-end gap-4 border-t mt-6">
            <button type="button" onClick={onClose} className="px-8 py-3 border-2 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors">إلغاء</button>
            <button type="submit" disabled={loading} className="px-10 py-3 bg-blue-700 font-bold text-white rounded-xl shadow-lg hover:bg-blue-800 disabled:opacity-50 transition-colors">
              {loading ? 'جاري الحفظ...' : 'حفظ الحركة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
