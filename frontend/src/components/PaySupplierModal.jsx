import React, { useState, useEffect } from 'react';
import { X, Landmark, Wallet, Smartphone, Building2 } from 'lucide-react';
import api from '../api';

export default function PaySupplierModal({ isOpen, onClose, supplier, supplierType, onSuccess }) {
  if (!isOpen) return null;
  const supplierId = supplier?.id;

  const [accounts, setAccounts] = useState([]);
  const [formData, setFormData] = useState({
    amount: '',
    payment_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    payment_method: 'تحويل بنكي',
    account_id: '',
    reference_number: '',
    notes: '',
    purchase_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedInvoice(null);
      
      // Load financial accounts
      api.get('/treasury/accounts')
        .then(res => {
          const accs = Array.isArray(res.data) ? res.data : [];
          setAccounts(accs);
          const firstBank = accs.find(a => a.type === 'BANK')?.id;
          const firstCash = accs.find(a => a.type === 'CASH')?.id;
          const defaultAcc = firstBank || firstCash || accs[0]?.id || 1;
          const initialMethod = firstBank ? 'تحويل بنكي' : 'نقدية';

          setFormData({
            amount: '',
            payment_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
            payment_method: initialMethod,
            account_id: defaultAcc,
            reference_number: '',
            notes: '',
            purchase_id: ''
          });
        })
        .catch(err => {
          console.error('Failed to load accounts:', err);
          setFormData({
            amount: '',
            payment_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
            payment_method: 'تحويل بنكي',
            account_id: 2,
            reference_number: '',
            notes: '',
            purchase_id: ''
          });
        });

      if (supplierType !== 'مصنع') {
        api.get(`/purchases/supplier/${supplierId}`)
          .then(res => setUnpaidInvoices(res.data.filter(inv => inv.remaining_amount > 0)))
          .catch(console.error);
      }
    }
  }, [isOpen, supplierId, supplierType]);

  const bankAccounts = accounts.filter(a => a.type === 'BANK');
  const walletAccounts = accounts.filter(a => a.type === 'EWALLET');
  const cashAccounts = accounts.filter(a => a.type === 'CASH');

  const handleAccountChange = (e) => {
    const accId = e.target.value;
    const selected = accounts.find(a => String(a.id) === String(accId));
    let newMethod = formData.payment_method;
    if (selected) {
      if (selected.type === 'BANK') newMethod = 'تحويل بنكي';
      else if (selected.type === 'EWALLET') newMethod = 'محفظة إلكترونية';
      else if (selected.type === 'CASH') newMethod = 'نقدية';
    }
    setFormData(prev => ({
      ...prev,
      account_id: accId,
      payment_method: newMethod
    }));
  };

  const handlePaymentMethodChange = (method) => {
    let targetAccId = formData.account_id;
    if (method === 'تحويل بنكي') {
      const isCurrentBank = bankAccounts.some(a => String(a.id) === String(targetAccId));
      if (!isCurrentBank) {
        targetAccId = bankAccounts[0]?.id || targetAccId;
      }
    } else if (method === 'محفظة إلكترونية') {
      const isCurrentWallet = walletAccounts.some(a => String(a.id) === String(targetAccId));
      if (!isCurrentWallet) {
        targetAccId = walletAccounts[0]?.id || targetAccId;
      }
    } else if (method === 'نقدية') {
      const isCurrentCash = cashAccounts.some(a => String(a.id) === String(targetAccId));
      if (!isCurrentCash) {
        targetAccId = cashAccounts[0]?.id || targetAccId;
      }
    }
    setFormData(prev => ({
      ...prev,
      payment_method: method,
      account_id: targetAccId
    }));
  };

  const handleInvoiceChange = (e) => {
    const invId = e.target.value;
    setFormData({ ...formData, purchase_id: invId });
    if (invId) {
      const inv = unpaidInvoices.find(i => i.id.toString() === invId);
      if (inv) {
        setSelectedInvoice(inv);
        setFormData(prev => ({ ...prev, amount: inv.remaining_amount }));
      }
    } else {
      setSelectedInvoice(null);
      setFormData(prev => ({ ...prev, amount: '' }));
    }
  };

  const selectedAccountObj = accounts.find(a => String(a.id) === String(formData.account_id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.account_id) {
      return alert('يرجى اختيار الخزنة أو البنك المسدد منه');
    }
    setLoading(true);
    try {
      const payload = { 
        ...formData, 
        supplier_id: supplierId,
        account_id: Number(formData.account_id)
      };
      if (supplierType !== 'مصنع' && formData.purchase_id) { 
        payload.purchase_id = formData.purchase_id; 
      }

      const res = await api.post(`/purchases/payments`, payload);
      alert(`✅ ${res.data?.message || 'تم تسجيل الدفعة بنجاح'}`);
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {supplierType === "مصنع" ? "إضافة رصيد للمصنع" : "تسديد فاتورة مورد"}
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{supplier?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {supplierType !== 'مصنع' && (
            <div>
              <label className="block mb-1 font-bold text-xs text-gray-700">اختر الفاتورة المراد سدادها</label>
              <select className="w-full border p-2.5 rounded-lg text-sm bg-white font-medium" value={formData.purchase_id} onChange={handleInvoiceChange}>
                <option value="">تسديد دفعة عامة من الحساب (بدون ربط بفاتورة محددة)</option>
                {unpaidInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    فاتورة رقم {inv.invoice_number || inv.id} - التاريخ {inv.purchase_date} - المتبقي: {Number(inv.remaining_amount || 0).toLocaleString()} ج.م
                  </option>
                ))}
              </select>
              {selectedInvoice && (
                <div className="mt-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs space-y-1 text-gray-700">
                  <div className="flex justify-between"><span>إجمالي الفاتورة:</span> <strong>{Number(selectedInvoice.total_amount || 0).toLocaleString()} ج.م</strong></div>
                  <div className="flex justify-between"><span>المدفوع مسبقاً:</span> <strong>{Number(selectedInvoice.paid_amount || 0).toLocaleString()} ج.م</strong></div>
                  <div className="flex justify-between text-red-600 font-bold border-t pt-1"><span>المبلغ المتبقي:</span> <strong>{Number(selectedInvoice.remaining_amount || 0).toLocaleString()} ج.م</strong></div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block mb-1 font-bold text-xs text-gray-700">المبلغ المسدد *</label>
            <div className="relative">
              <input 
                required 
                type="number" 
                step="any" 
                min="0.01" 
                max={selectedInvoice ? selectedInvoice.remaining_amount : undefined} 
                className="w-full border-2 border-gray-200 p-2.5 rounded-lg text-left font-bold text-lg text-blue-900 focus:border-blue-500 outline-none" 
                dir="ltr" 
                placeholder="0.00"
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: e.target.value})} 
              />
              <span className="absolute right-3 top-3 text-gray-400 font-bold text-xs">ج.م</span>
            </div>
          </div>
          
          <div>
            <label className="block mb-1 font-bold text-xs text-gray-700">تاريخ السداد *</label>
            <input 
              required 
              type="date" 
              className="w-full border p-2.5 rounded-lg text-sm bg-white font-medium" 
              value={formData.payment_date} 
              onChange={e => setFormData({...formData, payment_date: e.target.value})} 
            />
          </div>

          {/* الخزنة أو البنك المسدد منه: يظهر دائماً ويشمل جميع البنوك والخزن والمحافظ */}
          <div className="bg-blue-50/50 p-3.5 rounded-xl border-2 border-blue-200">
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                <Landmark size={16} className="text-blue-600" />
                الخزنة / البنك المسدد منه *
              </label>
              {selectedAccountObj && (
                <span className="text-[11px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200 shadow-sm" dir="ltr">
                  الرصيد: {Number(selectedAccountObj.balance || 0).toLocaleString()} ج.م
                </span>
              )}
            </div>

            <select
              required
              className="w-full border-2 border-blue-400 p-2.5 rounded-lg text-sm bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              value={formData.account_id}
              onChange={handleAccountChange}
            >
              {bankAccounts.length > 0 && (
                <optgroup label="🏦 حسابات البنوك">
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} - (الرصيد: {Number(acc.balance || 0).toLocaleString()} ج.م)
                    </option>
                  ))}
                </optgroup>
              )}

              {cashAccounts.length > 0 && (
                <optgroup label="💵 الخزن النقدية">
                  {cashAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} - (الرصيد: {Number(acc.balance || 0).toLocaleString()} ج.م)
                    </option>
                  ))}
                </optgroup>
              )}

              {walletAccounts.length > 0 && (
                <optgroup label="📱 المحافظ الإلكترونية">
                  {walletAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} - (الرصيد: {Number(acc.balance || 0).toLocaleString()} ج.م)
                    </option>
                  ))}
                </optgroup>
              )}

              {bankAccounts.length === 0 && cashAccounts.length === 0 && walletAccounts.length === 0 && (
                accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} - (الرصيد: {Number(acc.balance || 0).toLocaleString()} ج.م)
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div>
            <label className="block mb-1 font-bold text-xs text-gray-700">طريقة الدفع *</label>
            <select 
              className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold" 
              value={formData.payment_method} 
              onChange={e => handlePaymentMethodChange(e.target.value)}
            >
              <option value="تحويل بنكي">تحويل بنكي</option>
              <option value="نقدية">نقدية (كاش من الخزينة)</option>
              <option value="محفظة إلكترونية">محفظة إلكترونية (فودافون كاش / إنستاباي)</option>
              <option value="شيك">شيك بنكي</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-bold text-xs text-gray-700">رقم المرجع / رقم التحويل / الإيصال</label>
            <input 
              type="text" 
              className="w-full border p-2.5 rounded-lg text-sm bg-white font-medium" 
              placeholder="مثال: رقم الحوالة، رقم إيصال التحويل، رقم الشيك..."
              value={formData.reference_number} 
              onChange={e => setFormData({...formData, reference_number: e.target.value})} 
            />
          </div>
          
          <div>
            <label className="block mb-1 font-bold text-xs text-gray-700">ملاحظات</label>
            <input 
              type="text" 
              className="w-full border p-2.5 rounded-lg text-sm bg-white font-medium" 
              placeholder="أي تفاصيل أو ملاحظات إضافية..."
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
            />
          </div>

          {Number(formData.amount) > 0 && selectedAccountObj && (
            <div className="p-3 rounded-xl bg-blue-50 border-2 border-blue-200 text-xs text-blue-950 space-y-1 shadow-sm">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <Landmark size={15} className="text-blue-600" />
                  الخزنة / الحساب المخصوم منه:
                </span>
                <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-lg font-black text-xs">
                  {selectedAccountObj.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-blue-800 pt-1 border-t border-blue-200/80">
                <span>الرصيد المتبقي بالخزنة بعد السداد:</span>
                <strong dir="ltr" className="font-mono text-xs">
                  {Number((selectedAccountObj.balance || 0) - Number(formData.amount)).toLocaleString()} ج.م
                </strong>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 font-bold text-sm">
              إلغاء
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-bold text-sm shadow">
              {loading ? 'جاري الحفظ...' : (supplierType === 'مصنع' ? 'تسجيل الإيداع' : 'تأكيد تسديد الفاتورة')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
