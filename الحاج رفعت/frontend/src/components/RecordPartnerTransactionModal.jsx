import React, { useState, useEffect } from 'react';
import { X, DollarSign, Wallet, ArrowUpRight, ArrowDownLeft, AlertCircle } from 'lucide-react';
import api from '../api';

export default function RecordPartnerTransactionModal({
  isOpen,
  partner,
  editingTransaction,
  partnersList = [],
  onClose,
  onSuccess
}) {
  const [formData, setFormData] = useState({
    partner_id: '',
    transaction_type: 'withdrawal',
    amount: '',
    transaction_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    payment_method: 'نقدي (كاش)',
    treasury_mode: 'treasury', // 'treasury' or 'book_only'
    account_id: 1,
    description: '',
    reference: '',
    notes: ''
  });

  const [accounts, setAccounts] = useState([]);
  const [activePartners, setActivePartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    // Fetch financial accounts
    api.get('/treasury/accounts').then(res => {
      const accs = Array.isArray(res.data) ? res.data : (res.data?.accounts || []);
      setAccounts(accs);
    }).catch(err => console.error('Error fetching accounts:', err));

    // Fetch active partners if not supplied
    if (partnersList && partnersList.length > 0) {
      setActivePartners(partnersList.filter(p => p.is_active));
    } else {
      api.get('/partners?status=active').then(res => {
        const list = res.data?.partners || (Array.isArray(res.data) ? res.data : []);
        setActivePartners(list);
      }).catch(err => console.error('Error fetching partners:', err));
    }

    if (editingTransaction) {
      setFormData({
        partner_id: editingTransaction.partner_id || '',
        transaction_type: editingTransaction.transaction_type || 'withdrawal',
        amount: editingTransaction.amount || '',
        transaction_date: editingTransaction.transaction_date ? editingTransaction.transaction_date.substring(0, 10) : new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
        payment_method: editingTransaction.payment_method || 'نقدي (كاش)',
        treasury_mode: editingTransaction.account_id ? 'treasury' : 'book_only',
        account_id: editingTransaction.account_id || 1,
        description: editingTransaction.description || '',
        reference: editingTransaction.reference || '',
        notes: editingTransaction.notes || ''
      });
    } else {
      setFormData({
        partner_id: partner ? partner.id : (partnersList[0]?.id || ''),
        transaction_type: 'withdrawal',
        amount: '',
        transaction_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
        payment_method: 'نقدي (كاش)',
        treasury_mode: 'treasury',
        account_id: 1,
        description: '',
        reference: '',
        notes: ''
      });
    }
  }, [isOpen, editingTransaction, partner, partnersList]);

  if (!isOpen) return null;

  const isDeposit = formData.transaction_type === 'capital_contribution';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const numAmount = Number(formData.amount);
    if (!numAmount || numAmount <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    const partnerIdToUse = partner ? partner.id : formData.partner_id;
    if (!partnerIdToUse) {
      setError('يرجى تحديد الشريك');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        partner_id: partnerIdToUse,
        transaction_type: formData.transaction_type,
        amount: numAmount,
        transaction_date: formData.transaction_date,
        payment_method: formData.payment_method,
        account_id: formData.treasury_mode === 'treasury' ? Number(formData.account_id) : null,
        description: formData.description,
        reference: formData.reference,
        notes: formData.notes
      };

      if (editingTransaction) {
        await api.put(`/partners/transactions/${editingTransaction.id}`, payload);
      } else {
        await api.post(`/partners/${partnerIdToUse}/transactions`, payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء حفظ الحركة المالية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className={`px-6 py-4 flex justify-between items-center text-white ${
          isDeposit ? 'bg-gradient-to-r from-emerald-600 to-teal-700' : 'bg-gradient-to-r from-red-600 to-rose-700'
        }`}>
          <div className="flex items-center gap-2">
            {isDeposit ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
            <h2 className="text-lg sm:text-xl font-bold">
              {editingTransaction ? 'تعديل حركة الشريك' : (
                isDeposit ? 'تسجيل مساهمة رأس مال جديدة' : 'تسجيل سحب / دفعة للشريك'
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Select Partner */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                الشريك <span className="text-red-500">*</span>
              </label>
              {partner ? (
                <div className="p-2.5 bg-gray-100 border border-gray-200 rounded-xl font-bold text-gray-800 text-sm">
                  {partner.name} <span className="text-xs font-normal text-gray-500">(نسبة الشراكة: {partner.share_percentage}%)</span>
                </div>
              ) : (
                <select
                  required
                  value={formData.partner_id}
                  onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                >
                  <option value="">-- اختر الشريك --</option>
                  {activePartners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - حصة: {p.share_percentage}%
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Transaction Type */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                نوع العملية المحاسبية <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.transaction_type}
                disabled={Boolean(editingTransaction?.returned_amount && editingTransaction.returned_amount > 0)}
                onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-semibold bg-gray-50 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="withdrawal">سحب شخصي للشريك (مسحوبات شخصية)</option>
                <option value="payment">دفعة نقدية مسددة للشريك</option>
                <option value="capital_contribution">مساهمة رأس مال جديدة من الشريك</option>
                <option value="profit_distribution">توزيع أرباح نقدية للشريك</option>
                {editingTransaction?.transaction_type === 'withdrawal_return' && (
                  <option value="withdrawal_return">رد مبلغ مسحوبات للشريك</option>
                )}
              </select>
              {editingTransaction?.returned_amount > 0 && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                  تنبيه: مسجل على حركة السحب هذه مبالغ مرتجعة بإجمالي ({Number(editingTransaction.returned_amount).toLocaleString()} ج.م). لا يمكن تغيير نوع العملية أو تقليل المبلغ عن هذا الحد.
                </div>
              )}
              <p className="text-[11px] text-gray-500 mt-1">
                {formData.transaction_type === 'withdrawal' && 'المسحوبات الشخصية تقلل من رصيد الشريك، ولا تعتبر مصروفاً عمومياً على المنشأة.'}
                {formData.transaction_type === 'payment' && 'تسجيل دفعة نقدية أو تسديد التزام مالي لصالح الشريك.'}
                {formData.transaction_type === 'capital_contribution' && 'زيادة في رأس مال الشريك وإيداع سيولة نقدية جديدة في الشركة.'}
                {formData.transaction_type === 'profit_distribution' && 'توزيع رسمي لجزء من الأرباح المحققة على الشريك.'}
                {formData.transaction_type === 'withdrawal_return' && 'رد مبالغ مسحوبات للشريك وتوريدها إلى الخزينة.'}
              </p>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                المبلغ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min={editingTransaction?.returned_amount || 0.01}
                  required
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full p-2.5 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base font-bold text-gray-900"
                />
                <span className="absolute left-3 top-3 text-xs font-bold text-gray-400">ج.م</span>
              </div>
            </div>

            {/* Transaction Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                تاريخ العملية <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
              />
            </div>

            {/* Treasury Integration Option */}
            <div className="sm:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                حركة السيولة النقدية والخزينة:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className={`p-2.5 border rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                  formData.treasury_mode === 'treasury' ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold' : 'bg-white border-gray-200 text-gray-700'
                }`}>
                  <input
                    type="radio"
                    name="treasury_mode"
                    value="treasury"
                    checked={formData.treasury_mode === 'treasury'}
                    onChange={() => setFormData({ ...formData, treasury_mode: 'treasury' })}
                    className="text-blue-600"
                  />
                  <span>
                    {isDeposit ? 'إيداع فعلي في الخزينة / البنك' : 'صرف فعلي من الخزينة / البنك'}
                  </span>
                </label>

                <label className={`p-2.5 border rounded-lg flex items-center gap-2 cursor-pointer transition-colors ${
                  formData.treasury_mode === 'book_only' ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold' : 'bg-white border-gray-200 text-gray-700'
                }`}>
                  <input
                    type="radio"
                    name="treasury_mode"
                    value="book_only"
                    checked={formData.treasury_mode === 'book_only'}
                    onChange={() => setFormData({ ...formData, treasury_mode: 'book_only' })}
                    className="text-blue-600"
                  />
                  <span>تسجيل دفتري فقط (بدون حركة في الخزينة)</span>
                </label>
              </div>

              {formData.treasury_mode === 'treasury' && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    اختر الخزينة / الحساب المالي المرتبط:
                  </label>
                  <select
                    value={formData.account_id}
                    onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (الرصيد الحالي: {Number(acc.balance).toLocaleString()} ج.م)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                طريقة الدفع
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium"
              >
                <option value="نقدي (كاش)">نقدي (كاش)</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
                <option value="شيك بنكي">شيك بنكي</option>
                <option value="فودافون كاش / محفظة">فودافون كاش / محفظة</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                رقم مرجعي / رقم الشيك
              </label>
              <input
                type="text"
                placeholder="رقم الإيصال أو التحويل..."
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Description / Reason */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                البيان / سبب السحب
              </label>
              <input
                type="text"
                placeholder="اكتب بيان توضيحي للعملية..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                ملاحظات إضافية
              </label>
              <textarea
                rows="2"
                placeholder="أي تفاصيل محاسبية أخرى..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 font-semibold text-sm transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 text-white rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50 ${
                isDeposit 
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' 
                  : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
              }`}
            >
              {loading ? 'جاري الحفظ...' : (editingTransaction ? 'حفظ التعديلات' : 'تسجيل الحركة')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
