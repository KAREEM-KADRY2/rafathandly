import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import api from '../api';

export function normalizeArabicText(str) {
  if (!str) return '';
  let s = String(str).trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
  
  if (s === 'شيكاره' || s === 'شيكارة' || s === 'شكاره' || s === 'شكارة') return 'شكاره';
  if (s === 'كجم' || s === 'كيلوجرام' || s === 'كيلو جرام') return 'كيلو';
  return s;
}

export function findInventoryItem(itemName, inventoryItems) {
  if (!itemName || !inventoryItems || !inventoryItems.length) return null;
  const target = normalizeArabicText(itemName);
  return inventoryItems.find(i => normalizeArabicText(i.name) === target || i.name === itemName) || null;
}

export function calculateEquivalent(itemName, selectedUnit, rawQty, inventoryItems) {
  if (!itemName || !selectedUnit || !rawQty) return null;
  const invItem = findInventoryItem(itemName, inventoryItems);
  if (!invItem || !invItem.conversion_factor || !invItem.secondary_unit) {
    return null;
  }
  const qty = parseFloat(rawQty);
  if (isNaN(qty) || qty <= 0) return null;

  const factor = parseFloat(invItem.conversion_factor);
  const normSelected = normalizeArabicText(selectedUnit);
  const normBase = normalizeArabicText(invItem.unit);
  const normSec = normalizeArabicText(invItem.secondary_unit);

  if (normSelected === normBase) {
    const secQty = Math.round(qty * factor * 10000) / 10000;
    return {
      qty: secQty,
      unit: invItem.secondary_unit,
      text: `${secQty} ${invItem.secondary_unit}`
    };
  } else if (normSelected === normSec) {
    const baseQty = Math.round((qty / factor) * 10000) / 10000;
    return {
      qty: baseQty,
      unit: invItem.unit,
      text: `${baseQty} ${invItem.unit}`
    };
  }
  return null;
}

export function calculateSellingUnitPrice(baseUnitPrice, selectedUnit, invItem) {
  const basePrice = parseFloat(baseUnitPrice);
  if (isNaN(basePrice) || basePrice <= 0) return 0;
  if (!invItem || !selectedUnit) return basePrice;

  const normSelected = normalizeArabicText(selectedUnit);
  const normSec = normalizeArabicText(invItem.secondary_unit);

  if (invItem.conversion_factor && normSelected === normSec) {
    const factor = parseFloat(invItem.conversion_factor);
    const unitPrice = basePrice / factor;
    return Math.round(unitPrice * 10000) / 10000;
  }
  return basePrice;
}

export default function NewCreditSaleModal({ customer, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    invoice_number: '',
    sale_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    credit_deadline: 3,
    notes: ''
  });
  
  const [items, setItems] = useState([
    { item_name: '', quantity: 1, unit: '', base_unit_price: '', unit_price: '' }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [customerPrices, setCustomerPrices] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  useEffect(() => {
    fetchInventoryItems();
  }, []);
  
  useEffect(() => {
    if (customer?.id) {
      api.get(`/sales/customer/${customer.id}/prices`)
        .then(res => setCustomerPrices(Array.isArray(res.data) ? res.data : []))
        .catch(err => {
          console.error(err);
          setCustomerPrices([]);
        });
    } else {
      setCustomerPrices([]);
    }
  }, [customer?.id]);
    
  const fetchInventoryItems = async () => {
    try {
      const res = await api.get('/inventory/items');
      setInventoryItems(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch (err) {
      console.error(err);
      setInventoryItems([]);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { item_name: '', quantity: 1, unit: '', base_unit_price: '', unit_price: '' }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    if (field === 'item_name') {
      const invItem = findInventoryItem(value, inventoryItems);
      if (invItem) {
        newItems[index].unit = invItem.unit;
      }
    }
    
    if (field === 'item_name' || field === 'unit') {
      const it = newItems[index];
      if (it.item_name && it.unit) {
        const targetName = normalizeArabicText(it.item_name);
        const targetUnit = normalizeArabicText(it.unit);
        const cp = customerPrices.find(p => 
          (p.item_name === it.item_name || normalizeArabicText(p.item_name) === targetName) &&
          (p.unit === it.unit || normalizeArabicText(p.unit) === targetUnit)
        );
        if (cp) {
          newItems[index].base_unit_price = cp.price;
          newItems[index].unit_price = cp.price;
        }
      }
    }
    
    setItems(newItems);
  };

  const totalAmount = items.reduce((acc, item) => {
    const invItem = findInventoryItem(item.item_name, inventoryItems);
    const basePrice = parseFloat(item.base_unit_price ?? item.unit_price) || 0;
    const sellingPrice = calculateSellingUnitPrice(basePrice, item.unit, invItem);
    return acc + (parseFloat(item.quantity || 0) * sellingPrice);
  }, 0);

  const dueDateObj = new Date(formData.sale_date);
  dueDateObj.setDate(dueDateObj.getDate() + parseInt(formData.credit_deadline || 0));
  const projectedDueDate = dueDateObj.toLocaleDateString('en-GB');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) return alert('يجب إضافة صنف واحد على الأقل');

    const processedItems = items.map(item => {
      const invItem = findInventoryItem(item.item_name, inventoryItems);
      const basePrice = parseFloat(item.base_unit_price ?? item.unit_price) || 0;
      const effectiveUnitPrice = calculateSellingUnitPrice(basePrice, item.unit, invItem);

      return {
        ...item,
        base_unit_price: basePrice,
        unit_price: effectiveUnitPrice
      };
    });

    if (processedItems.some(i => !i.item_name || i.quantity <= 0 || i.unit_price <= 0)) {
      return alert('يرجى التحقق من بيانات الأصناف والأسعار المدخلة');
    }

    setLoading(true);
    try {
      await api.post('/credit-sales', {
        customer_id: customer.id,
        invoice_number: formData.invoice_number,
        sale_date: formData.sale_date,
        credit_deadline: formData.credit_deadline,
        notes: formData.notes,
        items: processedItems
      });
      onSuccess();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'حدث خطأ أثناء حفظ الفاتورة');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl overflow-x-auto flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold">فاتورة مبيعات آجل - {customer.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:bg-gray-200 p-1 rounded">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-gray-50 p-4 rounded border">
            <div>
              <label className="block text-sm font-medium mb-1">رقم الفاتورة (تلقائي)</label>
              <input type="text" placeholder="يتم توليده تلقائياً" className="w-full border p-2 rounded text-sm" dir="ltr"
                value={formData.invoice_number} onChange={e => setFormData({...formData, invoice_number: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ البيع</label>
              <input required type="date" className="w-full border p-2 rounded text-sm" 
                value={formData.sale_date} onChange={e => setFormData({...formData, sale_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">فترة السماح (أيام)</label>
              <input required type="number" min="0" className="w-full border p-2 rounded text-sm" dir="ltr"
                value={formData.credit_deadline} onChange={e => setFormData({...formData, credit_deadline: parseInt(e.target.value) || 0})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ الاستحقاق (تلقائي)</label>
              <div className="w-full border p-2 rounded bg-gray-200 font-bold text-center text-sm" dir="ltr">
                {projectedDueDate}
              </div>
            </div>
          </div>

          <div className="mb-4 flex justify-between items-center border-b pb-2">
            <h3 className="font-bold">الأصناف المبيعة</h3>
            <button type="button" onClick={handleAddItem} className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded flex items-center gap-1 text-sm font-bold">
              <Plus size={16} /> إضافة صنف
            </button>
          </div>

          <div className="space-y-3 mb-6 min-w-[800px]">
            <div className="gap-1.5 text-xs font-bold text-slate-700 px-2 text-center items-center grid grid-cols-12 bg-slate-100 py-2 rounded">
              <div className="col-span-2 text-right">اسم الصنف</div>
              <div className="col-span-1">الكمية</div>
              <div className="col-span-2">الوحدة المباعة</div>
              <div className="col-span-2">المعادل</div>
              <div className="col-span-2">سعر الوحدة الأساسية</div>
              <div className="col-span-1">سعر المباع</div>
              <div className="col-span-1">الإجمالي</div>
              <div className="col-span-1"></div>
            </div>

            {items.map((item, index) => {
              const invItem = findInventoryItem(item.item_name, inventoryItems);
              const equiv = calculateEquivalent(item.item_name, item.unit, item.quantity, inventoryItems);
              const basePrice = parseFloat(item.base_unit_price ?? item.unit_price) || 0;
              const sellingUnitPrice = calculateSellingUnitPrice(basePrice, item.unit, invItem);
              const itemTotal = (parseFloat(item.quantity) || 0) * sellingUnitPrice;

              const baseUnitLabel = invItem ? `سعر ${invItem.unit}` : 'السعر الأساسي';
              const sellingUnitLabel = item.unit ? `سعر ${item.unit}` : 'سعر المباع';

              return (
                <div key={index} className="gap-1.5 items-center mb-2 grid grid-cols-12 bg-gray-50/50 p-2 rounded border border-gray-100 text-xs">
                  <div className="col-span-2">
                    <select required className="w-full border p-2 rounded font-semibold text-xs" value={item.item_name} onChange={e => handleItemChange(index, 'item_name', e.target.value)}>
                      <option value="">اختر الصنف...</option>
                      {inventoryItems.map(inv => (
                        <option key={inv.id} value={inv.name}>{inv.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1">
                    <input required type="number" min="0.0001" step="any" className="w-full border p-2 rounded text-xs text-center font-bold" dir="ltr"
                      placeholder="الكمية"
                      value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                  </div>

                  <div className="col-span-2">
                    <select required className="w-full border p-2 rounded text-xs font-semibold"
                      value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value)}>
                      {invItem ? (
                        <>
                          <option value={invItem.unit}>{invItem.unit}</option>
                          {invItem.secondary_unit && (
                            <option value={invItem.secondary_unit}>{invItem.secondary_unit}</option>
                          )}
                        </>
                      ) : (
                        <>
                          <option value="">اختر الوحدة</option>
                          <option value="نقلة">نقلة</option>
                          <option value="متر">متر</option>
                          <option value="طن">طن</option>
                          <option value="شكارة">شكارة</option>
                          <option value="كيلو">كيلو</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <input 
                      type="text" 
                      readOnly 
                      disabled 
                      className="w-full border border-emerald-300 bg-emerald-50 text-emerald-800 p-2 text-xs rounded font-bold text-center shadow-sm" 
                      value={equiv ? `المعادل: ${equiv.text}` : '-'} 
                      placeholder="المعادل"
                    />
                  </div>

                  <div className="col-span-2">
                    <input required type="number" min="0" step="any" className="w-full border p-2 rounded text-xs text-center font-bold text-blue-900 bg-blue-50/50" dir="ltr"
                      placeholder={baseUnitLabel}
                      title={baseUnitLabel}
                      value={item.base_unit_price ?? item.unit_price} 
                      onChange={e => handleItemChange(index, 'base_unit_price', e.target.value)} />
                  </div>

                  <div className="col-span-1 text-center" title={sellingUnitLabel}>
                    <div className="w-full border border-gray-200 bg-gray-100 p-2 rounded font-black text-slate-800 text-center text-xs shadow-inner truncate" dir="ltr">
                      {sellingUnitPrice > 0 ? sellingUnitPrice.toLocaleString() : '-'}
                    </div>
                  </div>

                  <div className="col-span-1 text-center">
                    <div className="w-full border border-blue-200 bg-blue-100 p-2 rounded font-black text-blue-950 text-center text-xs shadow-sm truncate" dir="ltr">
                      {itemTotal.toLocaleString()}
                    </div>
                  </div>

                  <div className="col-span-1 flex justify-center">
                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:bg-red-50 p-1.5 rounded">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-start pt-4 border-t">
            <div className="w-1/2">
              <label className="block text-sm font-medium mb-1">ملاحظات إضافية</label>
              <textarea className="w-full border p-2 rounded h-20 text-sm" 
                value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
            </div>
            <div className="w-1/3 bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
              <p className="text-sm text-blue-800 font-medium mb-1">إجمالي الفاتورة</p>
              <p className="text-3xl font-bold text-blue-900" dir="ltr">{totalAmount.toLocaleString()} ج.م</p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-6 py-2 border rounded hover:bg-gray-50 font-bold">إلغاء</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 font-bold">
              {loading ? 'جاري الحفظ...' : 'اعتماد الفاتورة الآجلة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
