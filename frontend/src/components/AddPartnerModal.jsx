import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Percent, DollarSign, ShieldAlert } from 'lucide-react';
import api from '../api';

export default function AddPartnerModal({ isOpen, partnerToEdit, existingPartners = [], onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    share_percentage: '',
    capital_contribution: 0,
    start_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    phone: '',
    notes: '',
    initial_account_id: ''
  });

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    // Fetch financial accounts for capital deposit option
    api.get('/treasury/accounts').then(res => {
      setAccounts(Array.isArray(res.data) ? res.data : (res.data?.accounts || []));
    }).catch(err => console.error(err));

    if (partnerToEdit) {
      setFormData({
        name: partnerToEdit.name || '',
        share_percentage: partnerToEdit.share_percentage || '',
        capital_contribution: partnerToEdit.capital_contribution || 0,
        start_date: partnerToEdit.start_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
        phone: partnerToEdit.phone || '',
        notes: partnerToEdit.notes || '',
        initial_account_id: ''
      });
    } else {
      setFormData({
        name: '',
        share_percentage: '',
        capital_contribution: 0,
        start_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
        phone: '',
        notes: '',
        initial_account_id: ''
      });
    }
  }, [isOpen, partnerToEdit]);

  if (!isOpen) return null;

  // Calculate current total percentage across other active partners
  const otherActivePartners = existingPartners.filter(p => p.is_active && (!partnerToEdit || p.id !== partnerToEdit.id));
  const currentTotalOther = otherActivePartners.reduce((sum, p) => sum + (Number(p.share_percentage) || 0), 0);
  const inputPercentage = Number(formData.share_percentage) || 0;
  const projectedTotal = Math.round((currentTotalOther + inputPercentage) * 100) / 100;
  const isOver100 = projectedTotal > 100;
  const isUnder100 = projectedTotal < 100;
  const isExact100 = projectedTotal === 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const percentage = Number(formData.share_percentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      setError('نسبة الشراكة يجب أن تكون رقماً أكبر من 0 وأقل من أو تساوي 100%');
      return;
    }

    setLoading(true);
    try {
      if (partnerToEdit) {
        await api.put(`/partners/${partnerToEdit.id}`, formData);
      } else {
        await api.post('/partners', formData);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء حفظ بيانات الشريك');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Percent className="text-blue-200" size={24} />
            <h2 className="text-lg sm:text-xl font-bold">
              {partnerToEdit ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Percentage Live Allocation Notice */}
          <div className={`p-3.5 rounded-xl border text-xs sm:text-sm ${
            isOver100
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : isExact100
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            <div className="flex items-center justify-between font-bold mb-1.5">
              <span className="flex items-center gap-1.5">
                {isOver100 ? (
                  <ShieldAlert size={17} className="text-amber-600" />
                ) : isExact100 ? (
                  <CheckCircle size={17} className="text-emerald-600" />
                ) : (
                  <AlertTriangle size={17} className="text-blue-600" />
                )}
                مؤشر توزيع الحصص في الشراكة:
              </span>
              <span className="text-base font-extrabold">{projectedTotal}%</span>
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isOver100 ? 'bg-amber-500' : isExact100 ? 'bg-emerald-500' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, projectedTotal)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed">
              {isOver100 ? (
                <span className="text-amber-800 font-semibold">
                  تحذير: إجمالي نسب الشركاء سيتجاوز 100% بمقدار ({Math.round((projectedTotal - 100) * 100) / 100}%). لن يتم تعديل حصص الشركاء الآخرين تلقائياً.
                </span>
              ) : isExact100 ? (
                <span className="text-emerald-800 font-semibold">
                  ممتاز: إجمالي الحصص مكتمل وموزع بالكامل بنسبة 100%.
                </span>
              ) : (
                <span>
                  الحصص المتبقية غير الموزعة بعد هذه النسبة: ({Math.round((100 - projectedTotal) * 100) / 100}%).
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Partner Name */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                اسم الشريك <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="أدخل اسم الشريك الكامل..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium"
              />
            </div>

            {/* Share Percentage */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                نسبة الشراكة (%) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  required
                  placeholder="مثال: 25"
                  value={formData.share_percentage}
                  onChange={(e) => setFormData({ ...formData, share_percentage: e.target.value })}
                  className="w-full p-2.5 pl-8 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-semibold"
                />
                <span className="absolute left-3 top-2.5 text-gray-400 font-bold">%</span>
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                تاريخ بداية الشراكة
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Capital Contribution */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                رأس المال المساهم به (اختياري)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={formData.capital_contribution}
                  onChange={(e) => setFormData({ ...formData, capital_contribution: e.target.value })}
                  className="w-full p-2.5 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                />
                <span className="absolute left-2.5 top-2.5 text-xs text-gray-400 font-bold">ج.م</span>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                رقم الهاتف (اختياري)
              </label>
              <input
                type="tel"
                placeholder="010xxxxxxxx"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* If creating new partner and capital entered, option to deposit to treasury */}
            {!partnerToEdit && Number(formData.capital_contribution) > 0 && (
              <div className="sm:col-span-2 bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
                <label className="block text-xs font-bold text-blue-900 mb-1">
                  إيداع رأس المال الافتتاحي في الخزينة:
                </label>
                <select
                  value={formData.initial_account_id}
                  onChange={(e) => setFormData({ ...formData, initial_account_id: e.target.value })}
                  className="w-full p-2 bg-white border border-blue-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- تسجيل دفتري فقط (بدون إيداع نقدي في الخزينة) --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type === 'CASH' ? 'خزينة نقدية' : acc.type === 'BANK' ? 'حساب بنكي' : 'محفظة'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-blue-700 mt-1">
                  إذا اخترت خزينة، سيتم إنشاء سند إيداع رأس مال تلقائياً وزيادة رصيد الخزينة المحددة.
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                ملاحظات
              </label>
              <textarea
                rows="2"
                placeholder="أي شروط خاصة بالشراكة أو ملاحظات إضافية..."
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
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {loading ? 'جاري الحفظ...' : (partnerToEdit ? 'حفظ التعديلات' : 'إضافة الشريك')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
