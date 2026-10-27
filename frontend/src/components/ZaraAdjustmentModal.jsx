import React, { useState } from 'react';
import { X, CheckCircle, Percent, AlertCircle } from 'lucide-react';
import api from '../api';

export default function ZaraAdjustmentModal({ sale, customer, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    amount: '',
    adjustment_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    reason: 'خصم زارة مسموح به',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!sale) return null;

  const maxAllowed = Number(sale.remaining_amount) || 0;
  const numAmount = parseFloat(formData.amount) || 0;
  const remainingAfterZara = Math.max(0, maxAllowed - numAmount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (numAmount <= 0) {
      setErrorMsg('قيمة الزارة يجب أن تكون أكبر من صفر');
      return;
    }

    if (numAmount > maxAllowed) {
      setErrorMsg(`قيمة الزارة (${numAmount.toLocaleString()} ج.م) أكبر من المبلغ المتبقي على الفاتورة (${maxAllowed.toLocaleString()} ج.م)`);
      return;
    }

    setLoading(true);
    try {
      const customerId = customer?.id || sale.customer_id;
      const payload = {
        credit_sale_id: sale.id,
        amount: numAmount,
        adjustment_date: formData.adjustment_date,
        reason: formData.reason || 'خصم زارة مسموح به',
        notes: formData.notes || ''
      };

      const res = await api.post(`/customers/${customerId}/zara`, payload);
      if (res.data?.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'فشل حفظ تسوية الزارة');
      }
    } catch (err) {
      console.error('Zara submission error:', err);
      setErrorMsg(err.response?.data?.error || err.message || 'حدث خطأ أثناء حفظ تسوية الزارة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center p-4 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
              <Percent size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-800">تسوية خصم زارة</h2>
              <p className="text-xs text-gray-500 font-medium">فاتورة رقم #{sale.invoice_number || sale.id} - {customer?.name || 'العميل'}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-white/80 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-semibold flex items-center gap-2">
              <AlertCircle size={18} className="shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Invoice Summary Card */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
            <div>
              <p className="text-xs text-slate-500 font-bold mb-1">إجمالي الفاتورة</p>
              <p className="text-sm font-bold text-slate-800" dir="ltr">{Number(sale.original_amount || 0).toLocaleString()} ج.م</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold mb-1">المدفوع سابقًا</p>
              <p className="text-sm font-bold text-emerald-600" dir="ltr">{Number(sale.paid_amount || 0).toLocaleString()} ج.م</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold mb-1">المتبقي الحالي</p>
              <p className="text-sm font-black text-amber-600" dir="ltr">{maxAllowed.toLocaleString()} ج.م</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              مبلغ خصم الزارة (ج.م) *
            </label>
            <div className="relative">
              <input
                required
                type="number"
                min="0.01"
                max={maxAllowed}
                step="any"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="أدخل قيمة الخصم"
                className="w-full border-2 border-purple-400 p-3 rounded-xl text-2xl font-black text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                dir="ltr"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setFormData({ ...formData, amount: maxAllowed })}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold px-2 py-1.5 rounded-lg transition-all"
              >
                كامل المتبقي
              </button>
            </div>
          </div>

          {numAmount > 0 && numAmount <= maxAllowed && (
            <div className="bg-purple-50/70 border border-purple-200 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-purple-900">
              <span>المتبقي على الفاتورة بعد الزارة:</span>
              <span className="text-sm font-black" dir="ltr">{remainingAfterZara.toLocaleString()} ج.م</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">تاريخ التسوية *</label>
              <input
                type="date"
                required
                value={formData.adjustment_date}
                onChange={(e) => setFormData({ ...formData, adjustment_date: e.target.value })}
                className="w-full border border-gray-300 p-2.5 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">سبب التسوية</label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="مثال: خصم زارة مسموح به"
                className="w-full border border-gray-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات إضافية</label>
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="أي ملاحظات أو تفاصيل حول التسوية..."
              className="w-full border border-gray-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            ></textarea>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || numAmount <= 0 || numAmount > maxAllowed}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} />
              <span>{loading ? 'جاري الحفظ...' : 'تأكيد وحفظ تسوية الزارة'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-5 rounded-xl transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
