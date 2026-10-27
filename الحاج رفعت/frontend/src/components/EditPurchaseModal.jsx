import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, Banknote, Building2 } from 'lucide-react';
import api from '../api';

export default function EditPurchaseModal({ isOpen, onClose, purchase, supplier, onSuccess }) {
  const [accounts, setAccounts] = useState([]);
  const [formData, setFormData] = useState({
    invoice_number: '',
    purchase_date: '',
    location: '',
    notes: '',
    payment_type: 'credit',
    account_id: '',
    payment_method: 'نقدي',
    paid_amount: '',
    credit_deadline: 3
  });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/treasury/accounts')
        .then(res => setAccounts(Array.isArray(res.data) ? res.data : []))
        .catch(err => console.error('Failed to load accounts in edit modal:', err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && purchase) {
      const isFactorySupp = supplier?.type === "مصنع" || purchase.supplier_type === "مصنع";
      let pType = purchase.payment_type;
      if (!pType) {
        if (purchase.paid_amount >= purchase.total_amount && purchase.remaining_amount <= 0) {
          pType = isFactorySupp ? 'balance_deduction' : 'cash';
        } else {
          pType = 'credit';
        }
      }

      setFormData({
        invoice_number: purchase.invoice_number || '',
        purchase_date: purchase.purchase_date ? purchase.purchase_date.split(' ')[0] : new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
        location: purchase.location || '',
        notes: purchase.notes || '',
        payment_type: pType,
        account_id: purchase.account_id || 1,
        payment_method: purchase.payment_method || 'نقدي',
        paid_amount: purchase.paid_amount !== undefined ? purchase.paid_amount : '',
        credit_deadline: purchase.credit_deadline !== undefined ? purchase.credit_deadline : 3
      });

      if (purchase.items && purchase.items.length > 0) {
        setItems(purchase.items.map(it => ({
          item_name: it.item_name || '',
          quantity: it.quantity || '',
          unit: it.unit || 'طن',
          unit_price: it.unit_price || ''
        })));
      } else {
        setItems([{ item_name: '', quantity: '', unit: 'طن', unit_price: '' }]);
      }
    }
  }, [isOpen, purchase, supplier]);

  if (!isOpen || !purchase) return null;

  const addItem = () => setItems([...items, { item_name: '', quantity: '', unit: 'طن', unit_price: '' }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index, field, val) => {
    const newItems = [...items];
    newItems[index][field] = val;
    setItems(newItems);
  };

  const totalAmount = items.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.unit_price) || 0), 0);
  const isFactory = supplier?.type === "مصنع" || purchase.supplier_type === "مصنع";
  const isCash = formData.payment_type === 'cash';
  const isCredit = formData.payment_type === 'credit';
  const isBalanceDeduction = formData.payment_type === 'balance_deduction';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalAmount <= 0) {
      alert('الرجاء التأكد من أسعار وكميات الأصناف');
      return;
    }
    setLoading(true);
    try {
      await api.put(`/purchases/${purchase.id}`, { 
        supplier_id: supplier?.id || purchase.supplier_id,
        ...formData,
        paid_amount: isCash ? totalAmount : (formData.paid_amount || 0),
        items 
      });
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء حفظ التعديل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-3 sm:p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto border border-slate-200">
        <div className="flex justify-between items-center p-5 border-b bg-amber-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="text-amber-600" size={22} />
              تعديل فاتورة مشتريات #{purchase.invoice_number || purchase.id}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">سيتم إعادة توفيق الرصيد وحركات الحساب تلقائياً</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1 rounded-lg hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block mb-1 text-xs font-bold text-slate-700">رقم الفاتورة</label>
              <input 
                type="text" 
                className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white" 
                dir="ltr" 
                value={formData.invoice_number} 
                onChange={e => setFormData({...formData, invoice_number: e.target.value})} 
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-bold text-slate-700">تاريخ الشراء *</label>
              <input 
                required 
                type="date" 
                className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white" 
                value={formData.purchase_date} 
                onChange={e => setFormData({...formData, purchase_date: e.target.value})} 
              />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block mb-1 text-xs font-bold text-slate-700">ملاحظات الفاتورة</label>
              <input 
                type="text" 
                className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white" 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold text-slate-800">الأصناف المشتراة</label>
              <button 
                type="button" 
                onClick={addItem} 
                className="text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Plus size={15} /> إضافة صنف
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, index) => (
                <div key={index} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <input
                    required
                    type="text"
                    placeholder="اسم الصنف (أسمنت، حديد..)"
                    className="flex-1 min-w-[140px] border border-slate-300 p-2 rounded-lg text-sm bg-white"
                    value={item.item_name}
                    onChange={e => updateItem(index, 'item_name', e.target.value)}
                  />
                  <input
                    required
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="الكمية"
                    className="w-24 border border-slate-300 p-2 rounded-lg text-sm bg-white text-center font-bold"
                    dir="ltr"
                    value={item.quantity}
                    onChange={e => updateItem(index, 'quantity', e.target.value)}
                  />
                  <select
                    className="w-24 border border-slate-300 p-2 rounded-lg text-sm bg-white font-bold"
                    value={item.unit}
                    onChange={e => updateItem(index, 'unit', e.target.value)}
                  >
                    <option value="طن">طن</option>
                    <option value="نقلة">نقلة</option>
                    <option value="شكارة">شكارة</option>
                    <option value="متر ونص">متر ونص</option>
                    <option value="كيلو">كيلو</option>
                    <option value="متر">متر</option>
                    <option value="قطعة">قطعة</option>
                  </select>
                  <input
                    required
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="السعر"
                    className="w-28 border border-slate-300 p-2 rounded-lg text-sm bg-white text-left font-bold"
                    dir="ltr"
                    value={item.unit_price}
                    onChange={e => updateItem(index, 'unit_price', e.target.value)}
                  />
                  <div className="w-28 text-center font-black text-blue-700 text-sm bg-white p-2 rounded-lg border border-slate-200" dir="ltr">
                    {((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString()} ج.م
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 p-2">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Payment */}
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <div className="flex justify-between items-center text-lg font-bold bg-slate-100 p-3.5 rounded-xl border border-slate-200">
              <span className="text-slate-800 text-sm font-bold">الإجمالي المعدل للفاتورة:</span>
              <span className="text-blue-700 font-mono text-xl font-black" dir="ltr">{totalAmount.toLocaleString()} ج.م</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
              <h3 className="font-bold text-slate-800 text-sm">خيارات السداد المعدلة</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-1 text-xs font-bold text-slate-700">نوع السداد</label>
                  <select 
                    className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white font-bold"
                    value={formData.payment_type}
                    onChange={e => setFormData({...formData, payment_type: e.target.value})}
                  >
                    <option value="cash">نقدي (كاش مسدد بالكامل فوراً)</option>
                    <option value="credit">آجل (إضافة للحساب)</option>
                    {isFactory && <option value="balance_deduction">خصم من رصيد المصنع المتاح</option>}
                  </select>
                </div>

                {isCash && (
                  <div>
                    <label className="block mb-1 text-xs font-bold text-slate-700">الخزينة المسدد منها</label>
                    <select 
                      className="w-full border border-emerald-300 p-2.5 rounded-lg text-sm bg-white font-bold"
                      value={formData.account_id}
                      onChange={e => setFormData({...formData, account_id: e.target.value})}
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({Number(acc.balance || 0).toLocaleString()} ج.م)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isCredit && (
                  <>
                    <div>
                      <label className="block mb-1 text-xs font-bold text-slate-700">المبلغ المدفوع فوراً (اختياري)</label>
                      <input 
                        type="number" 
                        step="any" 
                        className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white" 
                        dir="ltr" 
                        placeholder="0"
                        value={formData.paid_amount} 
                        onChange={e => setFormData({...formData, paid_amount: e.target.value})} 
                      />
                    </div>
                    {Number(formData.paid_amount) > 0 && (
                      <div>
                        <label className="block mb-1 text-xs font-bold text-slate-700">الخزينة المسدد منها المقدم</label>
                        <select 
                          className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white font-bold"
                          value={formData.account_id}
                          onChange={e => setFormData({...formData, account_id: e.target.value})}
                        >
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({Number(acc.balance || 0).toLocaleString()} ج.م)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-bold text-sm"
            >
              إلغاء
            </button>
            <button 
              type="submit" 
              disabled={loading || totalAmount <= 0}
              className="px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 font-bold text-sm shadow-sm"
            >
              {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
