import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, ChevronDown, Check } from 'lucide-react';
import api from '../api';
import AddCustomerModal from './AddCustomerModal';
import { calculateEquivalent, findInventoryItem, normalizeArabicText, calculateSellingUnitPrice } from './NewCreditSaleModal';

export default function NewSaleModal({ onClose, onSuccess }) {
  const [customers, setCustomers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [services, setServices] = useState([]);
  const [accounts, setAccounts] = useState([]);
  
  const [customerInput, setCustomerInput] = useState('عميل نقدي');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    customer_id: '',
    invoice_number: '',
    sale_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    sale_type: 'cash',
    credit_deadline: 0,
    paid_amount: '',
    account_id: '',
    notes: ''
  });
  
  const [items, setItems] = useState([
    { item_name: '', item_type: 'product', service_id: '', quantity: 1, unit: '', base_unit_price: '', unit_price: '' }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [customerPrices, setCustomerPrices] = useState([]);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  useEffect(() => {
    if (formData.customer_id) {
      api.get(`/sales/customer/${formData.customer_id}/prices`)
        .then(res => setCustomerPrices(Array.isArray(res.data) ? res.data : []))
        .catch(err => { console.error(err); setCustomerPrices([]); });
    } else {
      setCustomerPrices([]);
    }
  }, [formData.customer_id]);
    
  useEffect(() => {
    fetchCustomers();
    fetchInventoryItems();
    fetchServices();
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/treasury/accounts');
      const accs = Array.isArray(res.data) ? res.data : [];
      setAccounts(accs);
      const defaultAcc = accs.find(a => a.type === 'CASH')?.id || accs[0]?.id || 1;
      setFormData(prev => ({
        ...prev,
        account_id: prev.account_id || defaultAcc
      }));
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const handleCustomerChange = (customerId) => {
    const selectedCust = (Array.isArray(customers) ? customers : []).find(c => String(c.id) === String(customerId));
    const deadline = selectedCust?.default_credit_deadline !== undefined ? selectedCust.default_credit_deadline : 3;
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      credit_deadline: prev.sale_type === 'cash' ? 0 : deadline
    }));
  };

  const handleCustomerInputChange = (text) => {
    setCustomerInput(text);
    setIsCustomerDropdownOpen(true);
    const matched = (Array.isArray(customers) ? customers : []).find(
      c => c.name.trim().toLowerCase() === text.trim().toLowerCase()
    );
    if (matched) {
      handleCustomerChange(matched.id);
    } else {
      setFormData(prev => ({
        ...prev,
        customer_id: '',
        credit_deadline: prev.sale_type === 'cash' ? 0 : 3
      }));
    }
  };

  const handleSelectCustomer = (cust) => {
    if (!cust || !cust.id) {
      setCustomerInput('عميل نقدي');
      setFormData(prev => ({ ...prev, customer_id: '', credit_deadline: 0 }));
    } else {
      setCustomerInput(cust.name);
      handleCustomerChange(cust.id);
    }
    setIsCustomerDropdownOpen(false);
  };

  const filteredCustomers = (Array.isArray(customers) ? customers : []).filter(c => {
    if (!customerInput.trim() || customerInput.trim() === 'عميل نقدي') return true;
    const q = customerInput.trim().toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  const dueDateObj = new Date(formData.sale_date || new Date());
  dueDateObj.setDate(dueDateObj.getDate() + parseInt(formData.credit_deadline || 0));
  const projectedDueDate = isNaN(dueDateObj.getTime()) ? '' : dueDateObj.toLocaleDateString('ar-EG');
  
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
      setServices(Array.isArray(res.data) ? res.data : (res.data?.data || [])); 
    } catch(err) { 
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

  const handleAddItem = () => {
    setItems([...items, { item_name: '', item_type: 'product', service_id: '', quantity: 1, unit: '', base_unit_price: '', unit_price: '' }]);
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
        const cp = (Array.isArray(customerPrices) ? customerPrices : []).find(p => 
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalCustomerName = (customerInput || '').trim();
    if (!formData.customer_id && !finalCustomerName) {
      return alert('يرجى كتابة أو اختيار اسم العميل أولاً');
    }
    if (formData.sale_type === 'cash' && !formData.account_id) {
      return alert('يرجى تحديد الخزنة / الحساب المالي المودع فيه المبلغ');
    }
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

    if (processedItems.some(i => !i.item_name || i.quantity <= 0 || i.unit_price < 0)) {
      return alert('يرجى التحقق من بيانات الأصناف والأسعار المدخلة');
    }

    setLoading(true);
    try {
      await api.post('/credit-sales', {
        ...formData,
        customer_name: finalCustomerName,
        account_id: formData.sale_type === 'cash' ? formData.account_id : null,
        items: processedItems
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'حدث خطأ أثناء تسجيل الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl overflow-x-auto flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold">فاتورة مبيعات جديدة</h2>
          <button onClick={onClose} className="text-gray-500 hover:bg-gray-200 p-1 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 bg-gray-50 p-4 rounded border">
            {/* 1. حقل العميل: كتابة حرة أو اختيار من القائمة */}
            <div className="relative" ref={customerDropdownRef}>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium">العميل *</label>
                <div className="flex items-center gap-1.5">
                  {formData.sale_type === 'cash' && (
                    <button
                      type="button"
                      onClick={() => handleSelectCustomer({ id: '', name: 'عميل نقدي' })}
                      className="text-[11px] bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-1.5 py-0.5 rounded font-bold transition-colors"
                      title="تعيين كعميل نقدي سريع"
                    >
                      كاش سريع
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAddCustomerModalOpen(true)}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 font-bold"
                  >
                    <Plus size={12} /> إضافة
                  </button>
                </div>
              </div>

              <div className="flex items-center border rounded bg-white focus-within:ring-2 focus-within:ring-blue-500">
                <input
                  type="text"
                  required
                  className="w-full p-2 text-sm bg-transparent outline-none font-bold text-slate-800"
                  placeholder={formData.sale_type === 'cash' ? "اكتب اسم العميل (أو عميل نقدي)..." : "اختر أو اكتب اسم العميل..."}
                  value={customerInput}
                  onChange={e => handleCustomerInputChange(e.target.value)}
                  onFocus={() => setIsCustomerDropdownOpen(true)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setIsCustomerDropdownOpen(prev => !prev)}
                  className="px-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="عرض قائمة العملاء"
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              {isCustomerDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-xl z-50">
                  {formData.sale_type === 'cash' && (
                    <div
                      onClick={() => handleSelectCustomer({ id: '', name: 'عميل نقدي' })}
                      className="p-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 cursor-pointer border-b flex justify-between items-center"
                    >
                      <span>✓ عميل نقدي (بدون تسجيل حساب)</span>
                      <span className="text-[10px] bg-emerald-200 px-1.5 py-0.5 rounded">كاش</span>
                    </div>
                  )}
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 text-center">
                      {customerInput.trim() ? (
                        <span>سيتم التسجيل باسم: <strong className="text-blue-700">"{customerInput.trim()}"</strong></span>
                      ) : (
                        <span>لا يوجد عملاء مطابقين</span>
                      )}
                    </div>
                  ) : (
                    filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className={`p-2 text-xs hover:bg-blue-50 cursor-pointer flex justify-between items-center border-b last:border-b-0 ${String(formData.customer_id) === String(c.id) ? 'bg-blue-50 font-bold' : ''}`}
                      >
                        <span className="font-bold text-slate-800">{c.name}</span>
                        {c.phone && <span className="text-[11px] text-gray-400" dir="ltr">{c.phone}</span>}
                      </div>
                    ))
                  )}
                  {customerInput.trim() && !customers.some(c => c.name.trim().toLowerCase() === customerInput.trim().toLowerCase()) && customerInput.trim() !== 'عميل نقدي' && (
                    <div
                      onClick={() => {
                        setFormData(prev => ({ ...prev, customer_id: '' }));
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="p-2 text-xs font-bold text-blue-700 bg-blue-50/70 hover:bg-blue-100 cursor-pointer border-t"
                    >
                      + استخدام "<span className="underline">{customerInput.trim()}</span>" كعميل جديد
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. تاريخ البيع */}
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ البيع *</label>
              <input
                required
                type="date"
                className="w-full border p-2 rounded text-sm bg-white font-medium"
                value={formData.sale_date}
                onChange={e => setFormData({ ...formData, sale_date: e.target.value })}
              />
            </div>

            {/* 3. نوع المبيعات (نقدي / آجل) */}
            <div>
              <label className="block text-sm font-medium mb-1">نوع المبيعات</label>
              <select
                className="w-full border p-2 rounded text-sm bg-white font-bold"
                value={formData.sale_type}
                onChange={e => {
                  const newType = e.target.value;
                  setFormData(prev => ({ ...prev, sale_type: newType }));
                  if (newType === 'cash') {
                    if (!customerInput.trim()) setCustomerInput('عميل نقدي');
                  } else if (newType === 'credit') {
                    if (customerInput === 'عميل نقدي') {
                      setCustomerInput('');
                      setFormData(prev => ({ ...prev, customer_id: '' }));
                    }
                  }
                }}
              >
                <option value="cash">نقدي (مدفوعة بالكامل)</option>
                <option value="credit">آجل (تُسجل على الحساب)</option>
              </select>
            </div>

            {/* 4. اختيار الخزنة إذا كانت الفاتورة نقدي، أو فترة السماح إذا كانت آجل */}
            {formData.sale_type === 'cash' ? (
              <div>
                <label className="block text-sm font-bold text-emerald-950 mb-1">
                  الخزنة / الحساب المودع فيه *
                </label>
                <select
                  required
                  className="w-full border-2 border-emerald-300 p-2 rounded text-sm bg-white font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                  value={formData.account_id}
                  onChange={e => setFormData({ ...formData, account_id: e.target.value })}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === 'CASH' ? 'خزينة نقدية' : acc.type === 'BANK' ? 'حساب بنكي' : 'محفظة'}) - {Number(acc.balance || 0).toLocaleString()} ج.م
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1">فترة السماح (أيام)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border p-2 rounded text-sm bg-white font-bold text-center text-blue-600"
                  value={formData.credit_deadline}
                  onChange={e => setFormData({ ...formData, credit_deadline: parseInt(e.target.value) || 0 })}
                />
              </div>
            )}

            {formData.sale_type === 'credit' && (
              <div className="col-span-1 md:col-span-4 bg-blue-50 p-2.5 rounded text-xs flex items-center justify-between text-blue-900 border border-blue-100 font-medium">
                <span>تاريخ الاستحقاق المتوقع بناءً على فترة السماح:</span>
                <span className="font-bold text-sm text-blue-700 font-mono" dir="ltr">{projectedDueDate}</span>
              </div>
            )}
          </div>

          <div className="mb-4 flex justify-between items-center border-b pb-2">
            <h3 className="font-bold">الأصناف المبيعة</h3>
            <button type="button" onClick={handleAddItem} className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded flex items-center gap-1 text-sm font-bold">
              <Plus size={16} /> إضافة صنف
            </button>
          </div>

          <div className="space-y-3 mb-6 min-w-[800px]">
            <div className="gap-1.5 text-xs font-bold text-slate-700 px-2 text-center items-center grid grid-cols-12 bg-slate-100 py-2 rounded">
              <div className="col-span-2 text-right">النوع</div>
              <div className="col-span-2 text-right">الصنف / الخدمة</div>
              <div className="col-span-1">الكمية</div>
              <div className="col-span-2">الوحدة المباعة</div>
              <div className="col-span-2">المعادل</div>
              <div className="col-span-1">سعر الأساسي</div>
              <div className="col-span-1">سعر المباع</div>
              <div className="col-span-1">الإجمالي</div>
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
                    <select className="w-full border p-2 rounded text-xs font-semibold" value={item.item_type} onChange={e => {
                      const type = e.target.value;
                      const newItems = [...items];
                      newItems[index].item_type = type;
                      newItems[index].item_name = '';
                      newItems[index].service_id = '';
                      newItems[index].base_unit_price = '';
                      newItems[index].unit_price = '';
                      newItems[index].unit = type === 'service' ? 'خدمة' : '';
                      setItems(newItems);
                    }}>
                      <option value="product">منتج</option>
                      <option value="service">خدمة</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    {item.item_type === 'product' ? (
                      <select required className="w-full border p-2 rounded text-xs font-semibold" value={item.item_name} onChange={e => handleItemChange(index, 'item_name', e.target.value)}>
                        <option value="">اختر الصنف...</option>
                        {(Array.isArray(inventoryItems) ? inventoryItems : []).map(inv => (
                          <option key={inv.id} value={inv.name}>{inv.name}</option>
                        ))}
                      </select>
                    ) : (
                      <select required className="w-full border p-2 rounded text-xs font-semibold" value={item.service_id} onChange={e => {
                        const sId = e.target.value;
                        const srv = Array.isArray(services) ? services.find(s => s.id.toString() === sId) : null;
                        const newItems = [...items];
                        newItems[index].service_id = sId;
                        newItems[index].item_name = srv ? srv.name : '';
                        newItems[index].base_unit_price = srv ? srv.default_price : '';
                        newItems[index].unit_price = srv ? srv.default_price : '';
                        setItems(newItems);
                      }}>
                        <option value="">اختر الخدمة...</option>
                        {(Array.isArray(services) ? services : []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="col-span-1">
                    <input required type="number" min="0.0001" step="any" className="w-full border p-2 rounded text-xs text-center font-bold" dir="ltr"
                      placeholder="الكمية"
                      value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                  </div>

                  <div className="col-span-2">
                    <select required className="w-full border p-2 rounded text-xs font-semibold"
                      value={item.unit} onChange={e => handleItemChange(index, 'unit', e.target.value)}>
                      {item.item_type === 'service' ? (
                        <option value="خدمة">خدمة</option>
                      ) : invItem ? (
                        <>
                          <option value={invItem.unit}>{invItem.unit}</option>
                          {invItem.secondary_unit && (
                            <option value={invItem.secondary_unit}>{invItem.secondary_unit}</option>
                          )}
                        </>
                      ) : (
                        <>
                          <option value="">الوحدة</option>
                          <option value="نقلة">نقلة</option>
                          <option value="متر">متر</option>
                          <option value="طن">طن</option>
                          <option value="شكارة">شكارة</option>
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

                  <div className="col-span-1">
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

                  <div className="col-span-1 text-center">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-500 hover:text-red-700 p-1 rounded"
                        title="حذف الصنف"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-start pt-4 border-t">
            <div className="w-1/2">
              <label className="block text-sm font-medium mb-1">ملاحظات إضافية</label>
              <textarea className="w-full border p-2 rounded h-20 text-sm" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
            </div>

            <div className="w-1/3 bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
              <p className="text-sm text-blue-800 font-medium mb-1">إجمالي الفاتورة</p>
              <p className="text-3xl font-bold text-blue-900" dir="ltr">{totalAmount.toLocaleString()} ج.م</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-6 py-2 border rounded hover:bg-gray-50 font-bold">إلغاء</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 font-bold">
              {loading ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
            </button>
          </div>
        </form>
      </div>

      {isAddCustomerModalOpen && (
        <AddCustomerModal
          onClose={() => setIsAddCustomerModalOpen(false)}
          onSuccess={async (newCust) => {
            setIsAddCustomerModalOpen(false);
            const res = await api.get('/customers?all=true');
            const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
            setCustomers(data);
            if (newCust && newCust.id) {
              setCustomerInput(newCust.name);
              handleCustomerChange(newCust.id);
            }
          }}
        />
      )}
    </div>
  );
}
