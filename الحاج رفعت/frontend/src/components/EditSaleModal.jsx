import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit3 } from 'lucide-react';
import api from '../api';

export default function EditSaleModal({ isOpen, onClose, sale, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [services, setServices] = useState([]);
  
  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_number: '',
    sale_date: '',
    sale_type: 'cash',
    credit_deadline: 0,
    paid_amount: '',
    notes: ''
  });
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && sale && sale.id) {
      fetchFullSaleData(sale.id);
    }
  }, [isOpen, sale]);

  const fetchFullSaleData = async (saleId) => {
    try {
      const res = await api.get(`/sales/${saleId}`);
      const fullSale = res.data || sale;
      setFormData({
        customer_id: fullSale.customer_id || '',
        invoice_number: fullSale.invoice_number || '',
        sale_date: fullSale.sale_date ? fullSale.sale_date.split('T')[0].split(' ')[0] : new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
        sale_type: fullSale.sale_type || (fullSale.paid_amount >= fullSale.original_amount ? 'cash' : 'credit'),
        credit_deadline: fullSale.credit_deadline !== undefined ? fullSale.credit_deadline : 0,
        paid_amount: fullSale.paid_amount || '',
        notes: fullSale.notes || ''
      });

      if (fullSale.items && fullSale.items.length > 0) {
        setItems(fullSale.items.map(it => ({
          item_type: it.item_type || 'product',
          service_id: it.service_id || '',
          item_name: it.item_name || '',
          quantity: it.quantity || 1,
          unit: it.unit || 'طن',
          unit_price: it.unit_price || ''
        })));
      } else {
        setItems([{ item_type: 'product', service_id: '', item_name: '', quantity: 1, unit: 'طن', unit_price: '' }]);
      }
    } catch (err) {
      console.error('Error fetching sale details for edit:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      fetchInventoryItems();
      fetchServices();
    }
  }, [isOpen]);

  if (!isOpen || !sale) return null;

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers?all=true');
      const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setCustomers(data);
    } catch (err) {
      console.error(err);
      setCustomers([]);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await api.get('/services?status=active');
      setServices(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch (err) {
      console.error(err);
      setServices([]);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const res = await api.get('/inventory/items');
      setInventoryItems(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch (err) {
      console.error(err);
      setInventoryItems([]);
    }
  };

  const addItem = () => setItems([...items, { item_type: 'product', service_id: '', item_name: '', quantity: 1, unit: 'طن', unit_price: '' }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const updateItem = (index, field, val) => {
    const newItems = [...items];
    newItems[index][field] = val;
    if (field === 'item_name') {
      const lower = String(val || '').toLowerCase();
      if (lower.includes('أسمنت') || lower.includes('اسمنت') || lower.includes('سمنت')) {
        newItems[index].unit = 'طن';
      } else if (lower.includes('رمل') || lower.includes('رمال') || lower.includes('رملة')) {
        newItems[index].unit = 'نقلة';
      }
    }
    if (field === 'service_id' && val) {
      const serviceList = Array.isArray(services) ? services : [];
      const selectedService = serviceList.find(s => String(s.id) === String(val));
      if (selectedService) {
        newItems[index].item_name = selectedService.name;
        newItems[index].unit = selectedService.unit || 'خدمة';
        newItems[index].unit_price = selectedService.default_price || '';
      }
    }
    setItems(newItems);
  };

  const totalAmount = items.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.unit_price) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/sales/${sale.id}`, {
        ...formData,
        items
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء حفظ تعديل الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center p-6 border-b bg-amber-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-600 text-white rounded-lg">
              <Edit3 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">تعديل فاتورة المبيعات #{sale.invoice_number || sale.id}</h2>
              <p className="text-xs text-slate-500 mt-0.5">تعديل الأصناف، الكميات، الأسعار وتحديث حساب العميل تلقائياً</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block mb-1 text-sm font-bold text-gray-700">العميل *</label>
              <select 
                required 
                className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                value={formData.customer_id} 
                onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
              >
                <option value="">اختر العميل...</option>
                {(Array.isArray(customers) ? customers : []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1 text-sm font-bold text-gray-700">رقم الفاتورة</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                dir="ltr" 
                value={formData.invoice_number} 
                onChange={e => setFormData({ ...formData, invoice_number: e.target.value })} 
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-bold text-gray-700">تاريخ الفاتورة *</label>
              <input 
                required 
                type="date" 
                className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                value={formData.sale_date} 
                onChange={e => setFormData({ ...formData, sale_date: e.target.value })} 
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-bold text-gray-700">نوع الفاتورة *</label>
              <select 
                className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                value={formData.sale_type} 
                onChange={e => setFormData({ ...formData, sale_type: e.target.value })}
              >
                <option value="cash">نقدي (كاش بالكامل)</option>
                <option value="credit">آجل / تقسيط</option>
              </select>
            </div>

            {formData.sale_type === 'credit' && (
              <div>
                <label className="block mb-1 text-sm font-bold text-gray-700">المبلغ المدفوع الآن</label>
                <input 
                  type="number" 
                  step="any" 
                  min="0" 
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                  dir="ltr" 
                  placeholder="0.00"
                  value={formData.paid_amount} 
                  onChange={e => setFormData({ ...formData, paid_amount: e.target.value })} 
                />
              </div>
            )}

            <div className={formData.sale_type === 'credit' ? "col-span-1 md:col-span-1" : "col-span-1 md:col-span-2"}>
              <label className="block mb-1 text-sm font-bold text-gray-700">ملاحظات</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" 
                value={formData.notes} 
                onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 text-base">الأصناف والخدمات بالمباعة</h3>
              <button 
                type="button" 
                onClick={addItem} 
                className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-colors"
              >
                <Plus size={16} /> إضافة صنف
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <select
                    className="w-32 border border-gray-300 p-2 rounded-lg text-sm bg-white"
                    value={item.item_type}
                    onChange={e => updateItem(index, 'item_type', e.target.value)}
                  >
                    <option value="product">بضاعة / صنف</option>
                    <option value="service">خدمة / نولون</option>
                  </select>

                  {item.item_type === 'service' ? (
                    <select
                      required
                      className="flex-1 border border-gray-300 p-2 rounded-lg text-sm bg-white"
                      value={item.service_id}
                      onChange={e => updateItem(index, 'service_id', e.target.value)}
                    >
                      <option value="">اختر الخدمة...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.default_price} ج.م)</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      type="text"
                      placeholder="اسم الصنف (أسمنت...)"
                      list="inventory-options"
                      className="flex-1 border border-gray-300 p-2 rounded-lg text-sm bg-white"
                      value={item.item_name}
                      onChange={e => updateItem(index, 'item_name', e.target.value)}
                    />
                  )}

                  <input
                    required
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="الكمية"
                    className="w-24 border border-gray-300 p-2 rounded-lg text-sm text-center bg-white"
                    dir="ltr"
                    value={item.quantity}
                    onChange={e => updateItem(index, 'quantity', e.target.value)}
                  />

                  <input
                    type="text"
                    placeholder="الوحدة"
                    className="w-20 border border-gray-300 p-2 rounded-lg text-sm text-center bg-white"
                    value={item.unit}
                    onChange={e => updateItem(index, 'unit', e.target.value)}
                  />

                  <input
                    required
                    type="number"
                    step="any"
                    min="0"
                    placeholder="السعر"
                    className="w-28 border border-gray-300 p-2 rounded-lg text-sm text-center bg-white font-bold"
                    dir="ltr"
                    value={item.unit_price}
                    onChange={e => updateItem(index, 'unit_price', e.target.value)}
                  />

                  <div className="w-28 text-left font-bold text-gray-800 text-sm px-2" dir="ltr">
                    {(Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString()} ج.م
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg border border-red-100 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <datalist id="inventory-options">
              {inventoryItems.map((inv, idx) => (
                <option key={idx} value={inv.name} />
              ))}
            </datalist>
          </div>

          {/* Footer Totals & Action */}
          <div className="flex justify-between items-center pt-4 border-t bg-gray-50 -mx-6 -mb-6 p-6 rounded-b-2xl">
            <div>
              <span className="text-sm text-gray-500">إجمالي الفاتورة المعدل: </span>
              <span className="text-2xl font-black text-amber-700" dir="ltr">{totalAmount.toLocaleString()} ج.م</span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 font-bold transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-md disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
