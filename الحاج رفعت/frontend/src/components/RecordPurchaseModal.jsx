import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Wallet, Banknote, CreditCard, Building2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api';

export default function RecordPurchaseModal({ isOpen, onClose, supplier, onSuccess }) {
  const supplierId = supplier?.id;
  const isFactory = supplier?.type === "مصنع";
  const factoryBalance = Number(supplier?.balance || 0);

  const [accounts, setAccounts] = useState([]);
  const [formData, setFormData] = useState({
    invoice_number: '',
    purchase_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    location: '',
    notes: '',
    payment_type: isFactory && factoryBalance > 0 ? 'balance_deduction' : 'credit',
    account_id: '',
    payment_method: 'نقدي',
    paid_amount: '',
    credit_deadline: supplier?.default_credit_deadline !== undefined ? supplier.default_credit_deadline : 3
  });
  const [items, setItems] = useState([{ item_name: '', quantity: '', unit: 'طن', unit_price: '' }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/treasury/accounts')
        .then(res => {
          const accs = Array.isArray(res.data) ? res.data : [];
          setAccounts(accs);
          const defaultAcc = accs.find(a => a.type === 'CASH')?.id || accs[0]?.id || 1;
          setFormData({
            invoice_number: '',
            purchase_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
            location: '',
            notes: '',
            payment_type: isFactory ? (factoryBalance > 0 ? 'balance_deduction' : 'cash') : 'credit',
            account_id: defaultAcc,
            payment_method: 'نقدي',
            paid_amount: '',
            credit_deadline: supplier?.default_credit_deadline !== undefined ? supplier.default_credit_deadline : 3
          });
        })
        .catch(err => {
          console.error('Failed to load accounts:', err);
          setFormData({
            invoice_number: '',
            purchase_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
            location: '',
            notes: '',
            payment_type: isFactory ? (factoryBalance > 0 ? 'balance_deduction' : 'cash') : 'credit',
            account_id: 1,
            payment_method: 'نقدي',
            paid_amount: '',
            credit_deadline: supplier?.default_credit_deadline !== undefined ? supplier.default_credit_deadline : 3
          });
        });
      setItems([{ item_name: '', quantity: '', unit: 'طن', unit_price: '' }]);
    }
  }, [isOpen, supplier, isFactory, factoryBalance]);

  if (!isOpen) return null;

  const addItem = () => setItems([...items, { item_name: '', quantity: '', unit: 'طن', unit_price: '' }]);
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
    setItems(newItems);
  };

  const totalAmount = items.reduce((acc, curr) => acc + (Number(curr.quantity) * Number(curr.unit_price) || 0), 0);
  
  const exceedsBalance = formData.payment_type === 'balance_deduction' && totalAmount > factoryBalance;
  const isCash = formData.payment_type === 'cash';
  const isCredit = formData.payment_type === 'credit';
  const isBalanceDeduction = formData.payment_type === 'balance_deduction';

  const paidAmountValue = isCash 
    ? totalAmount 
    : (isBalanceDeduction ? totalAmount : Math.min(totalAmount, Math.max(0, Number(formData.paid_amount) || 0)));
  const remainingAmountValue = Math.max(0, totalAmount - paidAmountValue);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (totalAmount <= 0) {
      alert('الرجاء إدخال أصناف وأسعار صحيحة لتحديد إجمالي الفاتورة');
      return;
    }
    if (exceedsBalance) {
      alert('قيمة الفاتورة تتجاوز الرصيد المتاح بالمصنع. يمكنك اختيار السداد النقدي المباشر أو شحن الرصيد أولاً.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/purchases`, { 
        supplier_id: supplierId,
        ...formData,
        paid_amount: isCash ? totalAmount : (formData.paid_amount || 0),
        account_id: formData.account_id || (accounts.find(a => a.type === 'CASH')?.id || 1),
        items 
      });
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء التسجيل');
    } finally {
      setLoading(false);
    }
  };

  const dueDateObj = new Date(formData.purchase_date || Date.now());
  dueDateObj.setDate(dueDateObj.getDate() + parseInt(formData.credit_deadline || 0));
  const projectedDueDate = isNaN(dueDateObj.getTime()) ? '-' : dueDateObj.toLocaleDateString('ar-EG');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-3 sm:p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto border border-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="text-blue-600" size={22} />
              تسجيل فاتورة مشتريات جديدة
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isFactory ? `المصنع: ${supplier?.name || ''}` : `المورد: ${supplier?.name || ''}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          
          {/* Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block mb-1.5 text-xs font-bold text-slate-700">رقم الفاتورة (اختياري)</label>
              <input 
                type="text" 
                className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" 
                dir="ltr" 
                placeholder="INV-001"
                value={formData.invoice_number} 
                onChange={e => setFormData({...formData, invoice_number: e.target.value})} 
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold text-slate-700">تاريخ الشراء *</label>
              <input 
                required 
                type="date" 
                className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" 
                value={formData.purchase_date} 
                onChange={e => setFormData({...formData, purchase_date: e.target.value})} 
              />
            </div>
            <div>
              <label className="block mb-1.5 text-xs font-bold text-slate-700">موقع الاستلام / المخزن</label>
              <input 
                type="text" 
                className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" 
                placeholder="المخزن الرئيسي..."
                value={formData.location} 
                onChange={e => setFormData({...formData, location: e.target.value})} 
              />
            </div>
            <div className="md:col-span-3">
              <label className="block mb-1 text-xs font-bold text-slate-700">ملاحظات الفاتورة</label>
              <input 
                type="text" 
                className="w-full border border-slate-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" 
                placeholder="أي ملاحظات تخص الشحنة أو التوريد..."
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span>الأصناف المشتراة</span>
                <span className="text-xs font-normal text-slate-500">({items.length} صنف)</span>
              </label>
              <button 
                type="button" 
                onClick={addItem} 
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-colors"
              >
                <Plus size={15} /> إضافة صنف
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, i) => (
                <div key={i} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-xs">
                  <input 
                    required 
                    type="text" 
                    placeholder="اسم الصنف (أسمنت، حديد، رمل...)" 
                    list="material-options" 
                    className="flex-1 min-w-[140px] border border-slate-300 p-2 rounded-lg text-sm bg-white" 
                    value={item.item_name} 
                    onChange={e => updateItem(i, 'item_name', e.target.value)} 
                  />
                  <div className="flex gap-1.5 items-center">
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      min="0.01" 
                      placeholder="الكمية" 
                      className="w-24 border border-slate-300 p-2 rounded-lg text-sm text-center bg-white font-bold" 
                      dir="ltr" 
                      value={item.quantity} 
                      onChange={e => updateItem(i, 'quantity', e.target.value)} 
                    />
                    <select 
                      className="w-24 border border-slate-300 p-2 rounded-lg text-sm font-bold bg-white" 
                      value={item.unit} 
                      onChange={e => updateItem(i, 'unit', e.target.value)}
                    >
                      <option value="طن">طن</option>
                      <option value="نقلة">نقلة</option>
                      <option value="شكارة">شكارة</option>
                      <option value="متر ونص">متر ونص</option>
                      <option value="كيلو">كيلو</option>
                      <option value="متر">متر</option>
                    </select>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <div className="relative">
                      <input 
                        required 
                        type="number" 
                        step="any" 
                        min="0.01" 
                        placeholder="السعر" 
                        className="w-28 border border-slate-300 p-2 rounded-lg text-sm text-left bg-white font-bold" 
                        dir="ltr" 
                        value={item.unit_price} 
                        onChange={e => updateItem(i, 'unit_price', e.target.value)} 
                      />
                      <span className="absolute left-2 top-2 text-[10px] text-gray-400 font-bold">ج.م</span>
                    </div>
                    <div className="w-28 text-center font-black bg-white p-2 rounded-lg border border-slate-200 text-blue-700 text-sm" dir="ltr">
                      {(Number(item.quantity) * Number(item.unit_price) || 0).toLocaleString()}
                    </div>
                  </div>
                  {items.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeItem(i)} 
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="حذف الصنف"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <datalist id="material-options">
              <option value="أسمنت" />
              <option value="حديد" />
              <option value="رمل" />
              <option value="زلط" />
              <option value="طوب" />
              <option value="سن" />
              <option value="بودرة" />
            </datalist>
          </div>

          {/* Payment Settings Section */}
          <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Banknote className="text-emerald-600" size={18} />
                طريقة ونوع السداد
              </h3>
              {isFactory && (
                <span className="text-xs bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full font-bold">
                  رصيد المصنع المتاح: {factoryBalance.toLocaleString()} ج.م
                </span>
              )}
            </div>

            {/* Payment Type Selection Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              
              {/* Option: Cash */}
              <label 
                className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  isCash 
                    ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-500' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input 
                    type="radio" 
                    name="purchase_payment_type" 
                    value="cash" 
                    checked={isCash} 
                    onChange={() => setFormData({...formData, payment_type: 'cash', paid_amount: ''})} 
                    className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <div className="font-bold text-sm text-slate-800">نقدي (كاش فوري)</div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 pr-6 leading-relaxed">
                  يُسحب المبلغ كاملاً فوراً من الخزينة المحددة، ولا تُسجل أي مديونية على الحساب.
                </p>
              </label>

              {/* Option: Credit */}
              <label 
                className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  isCredit 
                    ? 'border-amber-600 bg-amber-50/80 shadow-xs ring-1 ring-amber-500' 
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input 
                    type="radio" 
                    name="purchase_payment_type" 
                    value="credit" 
                    checked={isCredit} 
                    onChange={() => setFormData({...formData, payment_type: 'credit'})} 
                    className="text-amber-600 focus:ring-amber-500 h-4 w-4"
                  />
                  <div className="font-bold text-sm text-slate-800">آجل (على الحساب)</div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 pr-6 leading-relaxed">
                  تُسجل الفاتورة كمديونية على الحساب مع إمكانية دفع مقدم اختياري وتحديد مهلة سداد.
                </p>
              </label>

              {/* Option: Balance Deduction (Factory or prepaid) */}
              {isFactory && (
                <label 
                  className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    isBalanceDeduction 
                      ? 'border-purple-600 bg-purple-50/80 shadow-xs ring-1 ring-purple-500' 
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="radio" 
                      name="purchase_payment_type" 
                      value="balance_deduction" 
                      checked={isBalanceDeduction} 
                      onChange={() => setFormData({...formData, payment_type: 'balance_deduction', paid_amount: ''})} 
                      className="text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                    <div className="font-bold text-sm text-slate-800">خصم من رصيد المصنع</div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 pr-6 leading-relaxed">
                    يتم الخصم تلقائياً من رصيد المصنع المسبق ({factoryBalance.toLocaleString()} ج.م).
                  </p>
                </label>
              )}
            </div>

            {/* Cash Details Block */}
            {isCash && (
              <div className="bg-emerald-50/90 border border-emerald-200 p-4 rounded-xl space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle size={16} className="text-emerald-600" />
                    تفاصيل السداد النقدي من الخزينة:
                  </span>
                  <span className="text-xs font-black text-emerald-800" dir="ltr">
                    المسدد: {totalAmount.toLocaleString()} ج.م
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-emerald-200">
                  <div>
                    <label className="block mb-1 text-xs font-bold text-emerald-950">الخزينة / الحساب المسدد منه *</label>
                    <select 
                      className="w-full border border-emerald-300 p-2.5 rounded-lg text-sm bg-white font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                      value={formData.account_id}
                      onChange={e => setFormData({...formData, account_id: e.target.value})}
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type === 'CASH' ? 'خزينة نقدية' : acc.type === 'BANK' ? 'بنك' : 'محفظة'}) - الرصيد: {Number(acc.balance || 0).toLocaleString()} ج.م
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-1 text-xs font-bold text-emerald-950">طريقة الدفع *</label>
                    <select 
                      className="w-full border border-emerald-300 p-2.5 rounded-lg text-sm bg-white font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                      value={formData.payment_method}
                      onChange={e => setFormData({...formData, payment_method: e.target.value})}
                    >
                      <option value="نقدي">نقدي (كاش)</option>
                      <option value="تحويل بنكي">تحويل بنكي</option>
                      <option value="شيك">شيك مصرفي</option>
                      <option value="فودافون كاش">فودافون كاش / محفظة</option>
                      <option value="شبكة / POS">دفع إلكتروني / POS</option>
                    </select>
                  </div>
                </div>

                <p className="text-xs text-emerald-700 font-medium">
                  ✓ سيتم خصم {totalAmount.toLocaleString()} ج.م فوراً من الحساب المحدد وتسجيل سند صرف تلقائي، وستصبح مديونية الفاتورة 0 ج.م.
                </p>
              </div>
            )}

            {/* Credit Details Block */}
            {isCredit && (
              <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl space-y-3 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-xs font-bold text-amber-950">المدفوع مقدماً (اختياري)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="0"
                        max={totalAmount || undefined}
                        step="any"
                        className="w-full border border-amber-300 p-2.5 rounded-lg text-left text-sm bg-white font-bold focus:ring-2 focus:ring-amber-500" 
                        dir="ltr"
                        value={formData.paid_amount} 
                        onChange={e => setFormData({...formData, paid_amount: e.target.value})} 
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-bold">ج.م</span>
                    </div>
                  </div>

                  {Number(formData.paid_amount) > 0 && (
                    <div>
                      <label className="block mb-1 text-xs font-bold text-amber-950">خزينة سداد المقدم</label>
                      <select 
                        className="w-full border border-amber-300 p-2.5 rounded-lg text-sm bg-white font-bold focus:ring-2 focus:ring-amber-500"
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
                </div>
              </div>
            )}

            {/* Balance Deduction Details Block */}
            {isBalanceDeduction && (
              <div className={`p-4 rounded-xl border ${exceedsBalance ? 'bg-red-50 border-red-300 text-red-800' : 'bg-purple-50 border-purple-200 text-purple-900'} space-y-1.5`}>
                <div className="flex justify-between items-center font-bold text-sm">
                  <span>الرصيد المتاح بالمصنع:</span>
                  <span dir="ltr">{factoryBalance.toLocaleString()} ج.م</span>
                </div>
                {exceedsBalance ? (
                  <div className="flex items-center gap-1.5 text-xs text-red-700 font-bold pt-1">
                    <AlertCircle size={15} />
                    قيمة الفاتورة ({totalAmount.toLocaleString()} ج.م) تتجاوز الرصيد المتاح بالمصنع. الرجاء اختيار "نقدي" أو شحن الرصيد أولاً.
                  </div>
                ) : (
                  <div className="text-xs text-purple-700 pt-1">
                    سيتم خصم {totalAmount.toLocaleString()} ج.م تلقائياً من الرصيد، وسيصبح الرصيد المتبقي بالمصنع: {(factoryBalance - totalAmount).toLocaleString()} ج.م.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Total Footer Summary */}
          <div className="bg-slate-100 border border-slate-300/80 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-xs text-slate-500 font-bold block">نوع السداد المحدد:</span>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black mt-1 ${
                isCash 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : (isBalanceDeduction ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-amber-100 text-amber-800 border border-amber-300')
              }`}>
                {isCash ? 'فاتورة نقدية (مسددة بالكامل فوراً)' : (isBalanceDeduction ? 'خصم من رصيد المصنع المتاح' : 'فاتورة آجلة (على الحساب)')}
              </span>
            </div>

            <div className="text-left w-full sm:w-auto">
              <div className="flex justify-between sm:justify-end items-center gap-3">
                <span className="text-sm font-bold text-slate-700">إجمالي الفاتورة:</span>
                <span className="text-2xl font-black text-blue-700 font-mono" dir="ltr">
                  {totalAmount.toLocaleString()} ج.م
                </span>
              </div>
              
              {isCash && (
                <div className="text-xs font-bold text-emerald-700 mt-1 flex items-center justify-end gap-1">
                  <CheckCircle size={14} />
                  <span>المدفوع: {totalAmount.toLocaleString()} ج.م (المتبقي: 0 ج.م)</span>
                </div>
              )}

              {isCredit && (
                <div className="text-xs font-bold text-rose-600 mt-1" dir="ltr">
                  المتبقي يضاف للمديونية: {remainingAmountValue.toLocaleString()} ج.م
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex justify-end gap-3 border-t border-slate-200">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-sm transition-colors"
            >
              إلغاء
            </button>
            <button 
              type="submit" 
              disabled={loading || items.length === 0 || totalAmount <= 0 || exceedsBalance} 
              className="px-7 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm shadow-sm transition-all"
            >
              {loading ? 'جاري الحفظ...' : (isCash ? 'حفظ وسداد الفاتورة نقدياً' : 'حفظ الفاتورة')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
