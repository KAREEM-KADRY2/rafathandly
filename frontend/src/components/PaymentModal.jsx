import React, { useState, useEffect } from 'react';
import { X, Check, Landmark, Wallet } from 'lucide-react';
import api from '../api';

export default function PaymentModal({ sale, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: sale?.remaining_amount || 0,
    payment_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    payment_method: 'نقدًا',
    account_id: '',
    reference_number: '',
    notes: ''
  });
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/treasury/accounts')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.accounts || []);
        setAccounts(list);
        if (list.length > 0) {
          const cashAcc = list.find(a => a.type === 'CASH') || list[0];
          setFormData(prev => ({ ...prev, account_id: cashAcc.id }));
        }
      })
      .catch(err => console.error('Error fetching accounts:', err));
  }, []);

  if (!sale) return null;

  const handlePaymentMethodChange = (method) => {
    let targetAccId = formData.account_id;
    if (method === 'تحويل بنكي') {
      const bankAcc = accounts.find(a => a.type === 'BANK') || accounts[0];
      if (bankAcc) targetAccId = bankAcc.id;
    } else if (method === 'محفظة إلكترونية') {
      const walletAcc = accounts.find(a => a.type === 'EWALLET') || accounts[0];
      if (walletAcc) targetAccId = walletAcc.id;
    } else if (method === 'نقدًا') {
      const cashAcc = accounts.find(a => a.type === 'CASH') || accounts[0];
      if (cashAcc) targetAccId = cashAcc.id;
    }
    setFormData(prev => ({
      ...prev,
      payment_method: method,
      account_id: targetAccId
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (parseFloat(formData.amount) <= 0) {
      setError('قيمة التحصيل يجب أن تكون أكبر من صفر');
      return;
    }
    
    if (parseFloat(formData.amount) > sale.remaining_amount) {
      setError(`قيمة التحصيل أكبر من المبلغ المتبقي (${sale.remaining_amount} ج.م)`);
      return;
    }

    setLoading(true);
    try {
      await api.post(`/credit-sales/${sale.id}/payments`, formData);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء تسجيل الدفعة');
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === Number(formData.account_id));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">تسجيل تحصيل من عميل</h2>
            <p className="text-xs text-gray-500">الفاتورة: #{sale.invoice_number || sale.id} | العميل: {sale.customer_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center bg-gray-100 p-3 rounded-xl border border-gray-200">
            <div className="text-center w-1/2 border-l border-gray-300">
              <p className="text-xs text-gray-500 mb-1">الإجمالي</p>
              <p className="font-bold text-gray-800 text-base" dir="ltr">{Number(sale.original_amount).toLocaleString()} ج.م</p>
            </div>
            <div className="text-center w-1/2">
              <p className="text-xs text-gray-500 mb-1">المتبقي</p>
              <p className="font-bold text-red-600 text-lg" dir="ltr">{Number(sale.remaining_amount).toLocaleString()} ج.م</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}
          
          <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ المحصل (ج.م) *</label>
              <input 
                type="number" 
                step="any"
                required
                min="0.01"
                max={sale.remaining_amount}
                className="w-full p-2.5 border-2 border-emerald-400 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-black text-xl text-center text-emerald-600"
                dir="ltr"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">تاريخ التحصيل *</label>
                <input 
                  type="date" 
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none text-sm bg-white"
                  value={formData.payment_date}
                  onChange={e => setFormData({...formData, payment_date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">طريقة الدفع *</label>
                <select 
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-none text-sm bg-white font-bold"
                  value={formData.payment_method}
                  onChange={e => handlePaymentMethodChange(e.target.value)}
                >
                  <option value="نقدًا">نقدًا (خزنة كاش)</option>
                  <option value="تحويل بنكي">تحويل بنكي (حساب بنكي)</option>
                  <option value="محفظة إلكترونية">محفظة إلكترونية</option>
                  <option value="شيك">شيك مصرفي</option>
                </select>
              </div>
            </div>

            {/* عرض الخزنات والحسابات المالية عند التحويل البنكي */}
            {formData.payment_method === 'تحويل بنكي' && (
              <div className="bg-blue-50/90 border-2 border-blue-300 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <Landmark size={18} className="text-blue-600" />
                  <span>الخزنة / الحساب البنكي المستلم *</span>
                </div>
                
                <select
                  required
                  className="w-full border border-blue-400 p-2.5 rounded-lg bg-white text-gray-900 font-bold text-sm focus:ring-2 focus:ring-blue-500 shadow-sm"
                  value={formData.account_id}
                  onChange={e => setFormData({ ...formData, account_id: Number(e.target.value) })}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === 'BANK' ? 'حساب بنكي' : acc.type === 'CASH' ? 'خزنة كاش' : 'محفظة'}) - الرصيد: {Number(acc.balance || 0).toLocaleString()} ج.م
                    </option>
                  ))}
                </select>

                <div className="flex justify-between items-center text-xs text-blue-800 pt-1">
                  <span>✓ سيتم إيداع المبلغ مباشرة في: <strong>{selectedAccount?.name || 'الحساب المختار'}</strong></span>
                  {selectedAccount && (
                    <span className="font-semibold text-blue-600 bg-blue-100/80 px-2 py-0.5 rounded">
                      رصيد الحساب: {Number(selectedAccount.balance || 0).toLocaleString()} ج.م
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-blue-200/60">
                  <label className="block text-xs font-semibold text-blue-900 mb-1">
                    رقم الحوالة / الإيصال البنكي (اختياري)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-blue-300 p-2 rounded-lg text-sm bg-white placeholder:text-gray-400"
                    placeholder="مثال: رقم العملية، رقم الإيصال أو الشيك..."
                    value={formData.reference_number}
                    onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* عرض المحفظة الإلكترونية */}
            {formData.payment_method === 'محفظة إلكترونية' && (
              <div className="bg-purple-50/90 border-2 border-purple-300 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
                  <Wallet size={18} className="text-purple-600" />
                  <span>المحفظة / الخزنة المستلمة *</span>
                </div>
                
                <select
                  required
                  className="w-full border border-purple-400 p-2.5 rounded-lg bg-white text-gray-900 font-bold text-sm focus:ring-2 focus:ring-purple-500 shadow-sm"
                  value={formData.account_id}
                  onChange={e => setFormData({ ...formData, account_id: Number(e.target.value) })}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === 'EWALLET' ? 'محفظة' : acc.type === 'BANK' ? 'بنك' : 'خزنة'}) - الرصيد: {Number(acc.balance || 0).toLocaleString()} ج.م
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات (اختياري)</label>
              <input 
                type="text"
                className="w-full p-2.5 border border-gray-300 rounded-lg outline-none text-sm placeholder:text-gray-400"
                placeholder="رقم إيصال أو أي ملاحظة..."
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
          >
            إلغاء
          </button>
          <button 
            type="submit"
            form="payment-form"
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {loading ? 'جاري الحفظ...' : <><Check size={18} /> حفظ التحصيل والإيداع</>}
          </button>
        </div>
      </div>
    </div>
  );
}
