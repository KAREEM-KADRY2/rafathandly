import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Wallet, ArrowDownLeft, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import api from '../api';

export default function RecordPartnerReturnModal({
  isOpen,
  withdrawal,
  partner,
  onClose,
  onSuccess
}) {
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
  );
  const [paymentMethod, setPaymentMethod] = useState('نقدي (كاش)');
  const [treasuryMode, setTreasuryMode] = useState('treasury'); // 'treasury' or 'book_only'
  const [accountId, setAccountId] = useState(1);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !withdrawal) return;

    setError('');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
    setTransactionDate(today);
    setAmount('');
    setPaymentMethod('نقدي (كاش)');
    setTreasuryMode('treasury');
    setReference('');
    setNotes('');

    const defaultDesc = partner 
      ? `رد مبلغ مسحوبات للشريك - ${partner.name} (مرتبط بالسحب #${withdrawal.id})`
      : `رد مبلغ مسحوبات (مرتبط بالسحب #${withdrawal.id})`;
    setDescription(defaultDesc);

    // Fetch financial accounts
    api.get('/treasury/accounts').then(res => {
      const accs = Array.isArray(res.data) ? res.data : (res.data?.accounts || []);
      setAccounts(accs);
      if (accs.length > 0) {
        setAccountId(accs[0].id);
      }
    }).catch(err => {
      console.error('Error fetching accounts for return modal:', err);
    });
  }, [isOpen, withdrawal, partner]);

  if (!isOpen || !withdrawal) return null;

  const originalAmount = Number(withdrawal.amount) || 0;
  const returnedAmount = Number(withdrawal.returned_amount) || 0;
  const remainingAmount = Math.max(0, originalAmount - returnedAmount);

  const handleFullReturnClick = () => {
    setAmount(remainingAmount.toString());
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('يرجى إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    if (numAmount > remainingAmount) {
      setError(`المبلغ المدخل (${numAmount.toLocaleString()} ج.م) يتجاوز الرصيد المتبقي من السحب (${remainingAmount.toLocaleString()} ج.م)`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount: numAmount,
        transaction_date: transactionDate,
        payment_method: paymentMethod,
        account_id: treasuryMode === 'treasury' ? Number(accountId) : null,
        description: description.trim() || undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined
      };

      await api.post(`/partners/transactions/${withdrawal.id}/return`, payload);

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء تسجيل رد المبلغ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <RotateCcw size={22} className="text-emerald-200" />
            <div>
              <h2 className="text-base sm:text-lg font-bold">تسجيل رد مبلغ إلى الخزينة</h2>
              <p className="text-xs text-emerald-100">
                الشريك: <strong className="text-white">{partner?.name || 'الشريك'}</strong> (سحب رقم #{withdrawal.id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Withdrawal Details Banner */}
        <div className="bg-slate-50 border-b border-gray-200 p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2.5 rounded-xl border border-gray-200">
              <span className="text-[11px] text-gray-500 block font-medium">المبلغ الأصلي للسحب</span>
              <span className="text-sm font-black text-gray-800" dir="ltr">
                {originalAmount.toLocaleString()} ج.م
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-gray-200">
              <span className="text-[11px] text-gray-500 block font-medium">المبلغ المرتجع سابقاً</span>
              <span className="text-sm font-black text-emerald-600" dir="ltr">
                {returnedAmount.toLocaleString()} ج.م
              </span>
            </div>
            <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
              <span className="text-[11px] text-emerald-800 block font-bold">المتبقي من السحب</span>
              <span className="text-sm font-black text-emerald-700" dir="ltr">
                {remainingAmount.toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
              <AlertCircle size={18} className="flex-shrink-0 text-red-500" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {/* Return Amount Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-gray-700 font-bold">
                المبلغ المراد رده (ج.م) <span className="text-red-500">*</span>
              </label>
              {remainingAmount > 0 && (
                <button
                  type="button"
                  onClick={handleFullReturnClick}
                  className="text-[11px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md font-bold transition-colors"
                >
                  رد كامل المتبقي ({remainingAmount.toLocaleString()} ج.م)
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.01"
                max={remainingAmount}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                required
                placeholder={`أدخل المبلغ (بحد أقصى ${remainingAmount.toLocaleString()} ج.م)`}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-base font-bold text-gray-900 transition-all text-left"
                dir="ltr"
              />
              <span className="absolute right-3 top-3 text-xs font-bold text-gray-400">ج.م</span>
            </div>
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-bold mb-1">تاريخ الرد / التوريد</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">طريقة الدفع</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-xs font-semibold"
              >
                <option value="نقدي (كاش)">نقدي (كاش)</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
                <option value="شيك بنكي">شيك بنكي</option>
                <option value="إيداع نقدي">إيداع نقدي مباشر</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
          </div>

          {/* Treasury Account Selection */}
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="text-gray-700 font-bold">نوع الأثر المالي:</label>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="treasuryMode"
                    value="treasury"
                    checked={treasuryMode === 'treasury'}
                    onChange={() => setTreasuryMode('treasury')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>توريد فعلي للخزينة</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="treasuryMode"
                    value="book_only"
                    checked={treasuryMode === 'book_only'}
                    onChange={() => setTreasuryMode('book_only')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>تسوية دفترية فقط</span>
                </label>
              </div>
            </div>

            {treasuryMode === 'treasury' && (
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                <label className="block text-emerald-900 font-bold mb-1">
                  الخزينة أو الحساب المستلم للمبلغ (سند قبض):
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs font-bold text-gray-800"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (الرصيد الحالي: {Number(acc.balance || 0).toLocaleString()} ج.م)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                  سيتم زيادة رصيد الخزينة المختارة بالمبلغ المرتجع تلقائياً كحركة قبض.
                </p>
              </div>
            )}
          </div>

          {/* Description & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-700 font-bold mb-1">البيان / الوصف</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="البيان التوضيحي للعملية"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-bold mb-1">رقم الإيصال أو المرجع</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="رقم سند القبض / التحويل"
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-xs"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-gray-700 font-bold mb-1">ملاحظات إضافية</label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل أو ملاحظات خاصة بعملية الرد..."
              className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-xs"
            ></textarea>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end items-center gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-bold transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <CheckCircle size={16} />
              <span>{loading ? 'جاري الحفظ...' : 'تأكيد رد المبلغ وتوريده'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
