import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Landmark, Wallet, Banknote } from 'lucide-react';
import api from '../api';

export default function CollectPaymentModal({ sale, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: sale.remaining_amount || 0,
    payment_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    payment_method: 'نقدًا',
    account_id: '',
    reference_number: '',
    notes: ''
  });
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

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
      .catch(err => console.error('Error fetching treasury accounts:', err));
  }, []);

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
    if (parseFloat(formData.amount) <= 0) return alert('يجب أن يكون المبلغ أكبر من صفر');
    if (parseFloat(formData.amount) > sale.remaining_amount) {
      return alert('مبلغ التحصيل أكبر من المبلغ المتبقي على هذه الفاتورة');
    }

    setLoading(true);
    try {
      await api.post(`/credit-sales/${sale.id}/payments`, formData);
      onSuccess();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || 'حدث خطأ أثناء حفظ الدفعة');
    }
    setLoading(false);
  };

  const remainingAfterPayment = sale.remaining_amount - parseFloat(formData.amount || 0);
  const selectedAccount = accounts.find(a => a.id === Number(formData.account_id));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">تحصيل دفعة من عميل</h2>
            <p className="text-xs text-gray-500">فاتورة #{sale.invoice_number || sale.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-center">
            <p className="text-amber-800 text-xs font-semibold mb-1">المبلغ المتبقي على هذه الفاتورة</p>
            <p className="text-2xl font-black text-amber-600" dir="ltr">{Number(sale.remaining_amount).toLocaleString()} ج.م</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ المحصل (ج.م) *</label>
              <input 
                required 
                type="number" 
                min="0.01" 
                max={sale.remaining_amount} 
                step="any" 
                className="w-full border-2 border-blue-400 p-2.5 rounded-xl text-xl font-black text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center" 
                dir="ltr"
                value={formData.amount} 
                onChange={e => setFormData({...formData, amount: e.target.value})} 
              />
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
              <span className="font-semibold text-gray-600">المتبقي بعد التحصيل:</span>
              <span className={`font-black text-base ${remainingAfterPayment <= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                {remainingAfterPayment <= 0 ? 'خالص (0 ج.م)' : `${remainingAfterPayment.toLocaleString()} ج.م`}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">تاريخ التحصيل *</label>
                <input 
                  required 
                  type="date" 
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" 
                  value={formData.payment_date} 
                  onChange={e => setFormData({...formData, payment_date: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">طريقة الدفع *</label>
                <select 
                  className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white font-bold text-gray-800 focus:ring-2 focus:ring-blue-500" 
                  value={formData.payment_method} 
                  onChange={e => handlePaymentMethodChange(e.target.value)}
                >
                  <option value="نقدًا">نقدًا (خزنة كاش)</option>
                  <option value="تحويل بنكي">تحويل بنكي (حساب بنكي)</option>
                  <option value="محفظة إلكترونية">محفظة إلكترونية (فودافون كاش / إنستاباي)</option>
                  <option value="شيك">شيك مصرفي</option>
                </select>
              </div>
            </div>

            {/* عرض الخزنات والحسابات المالية المتاحة عند التحويل البنكي */}
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

            {/* عرض المحافظ الإلكترونية */}
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

                <div className="text-xs text-purple-800">
                  ✓ سيتم الإيداع مباشرة في: <strong>{selectedAccount?.name || 'المحفظة المختارة'}</strong>
                </div>

                <div className="pt-2 border-t border-purple-200/60">
                  <label className="block text-xs font-semibold text-purple-900 mb-1">
                    رقم العملية أو هاتف المحفظة (اختياري)
                  </label>
                  <input
                    type="text"
                    className="w-full border border-purple-300 p-2 rounded-lg text-sm bg-white placeholder:text-gray-400"
                    placeholder="مثال: رقم تحويل فودافون كاش أو إنستاباي..."
                    value={formData.reference_number}
                    onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* عند الدفع نقدًا */}
            {formData.payment_method === 'نقدًا' && accounts.filter(a => a.type === 'CASH').length > 1 && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg space-y-1">
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  اختر الخزنة النقدية المستلمة
                </label>
                <select
                  className="w-full border border-emerald-300 p-2 rounded-lg bg-white text-gray-800 text-sm font-bold"
                  value={formData.account_id}
                  onChange={e => setFormData({ ...formData, account_id: Number(e.target.value) })}
                >
                  {accounts.filter(a => a.type === 'CASH').map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} - الرصيد: {Number(acc.balance || 0).toLocaleString()} ج.م
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات التحصيل (اختياري)</label>
              <textarea 
                className="w-full border border-gray-300 p-2 rounded-lg text-sm h-16 focus:ring-2 focus:ring-blue-500" 
                placeholder="أي تفاصيل أو ملاحظات إضافية حول الدفعة..."
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
            >
              إلغاء
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <CheckCircle size={18} />
              {loading ? 'جاري الحفظ...' : 'تأكيد التحصيل والإيداع'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
