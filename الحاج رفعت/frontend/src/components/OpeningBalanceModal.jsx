import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Calendar, FileText, CheckCircle2, Trash2, Wallet, Landmark } from 'lucide-react';

const OpeningBalanceModal = ({ isOpen, onClose, entityType, entityId, entityName, onSuccess }) => {
  const [balanceType, setBalanceType] = useState('debit');
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [affectTreasury, setAffectTreasury] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [existingOb, setExistingOb] = useState(null);
  const [showConfirmOverwrite, setShowConfirmOverwrite] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
      if (entityType && entityId) {
        fetchExistingOB();
      } else {
        resetForm();
      }
    }
  }, [isOpen, entityType, entityId]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/treasury/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching accounts:', e);
    }
  };

  const resetForm = () => {
    setBalanceType(entityType === 'supplier' || entityType === 'factory' ? 'credit' : 'debit');
    setAmount('');
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setReference('');
    setAccountId('');
    setAffectTreasury(false);
    setError(null);
    setExistingOb(null);
    setShowConfirmOverwrite(false);
  };

  const fetchExistingOB = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/opening-balances/${entityType}/${entityId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setExistingOb(data);
          setBalanceType(data.balance_type || (entityType === 'supplier' ? 'credit' : 'debit'));
          setAmount(data.amount ? String(data.amount) : '');
          setEffectiveDate(data.effective_date ? data.effective_date.split('T')[0] : new Date().toISOString().split('T')[0]);
          setNotes(data.notes || '');
          setReference(data.reference || '');
          if (data.account_id) {
            setAccountId(String(data.account_id));
            setAffectTreasury(true);
          } else {
            setAccountId('');
            setAffectTreasury(false);
          }
        } else {
          setExistingOb(null);
          setAccountId('');
          setAffectTreasury(false);
          // Set default balance types
          if (entityType === 'supplier' || entityType === 'factory') setBalanceType('credit');
          else setBalanceType('debit');
        }
      }
    } catch (err) {
      console.error('Error fetching opening balance:', err);
    } finally {
      setFetching(false);
    }
  };

  if (!isOpen) return null;

  const getEntityTypeLabel = () => {
    switch (entityType) {
      case 'customer': return 'العميل';
      case 'supplier': return 'المورد';
      case 'factory': return 'المصنع';
      case 'worker': return 'العامل';
      case 'treasury':
      case 'financial_account': return 'الخزنة / الحساب';
      default: return 'الحساب';
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('يرجى إدخال مبلغ رصيد افتتاحي صحيح (صفر أو أكثر)');
      return;
    }

    if (!effectiveDate) {
      setError('يرجى تحديد تاريخ الرصيد الافتتاحي');
      return;
    }

    if (affectTreasury && !accountId) {
      setError('يرجى اختيار الخزنة أو الحساب المالي المراد التأثير فيه');
      return;
    }

    if (existingOb && !showConfirmOverwrite) {
      setShowConfirmOverwrite(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/opening-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          balance_type: balanceType,
          amount: parsedAmount,
          effective_date: effectiveDate,
          notes: notes,
          reference: reference,
          account_id: affectTreasury && accountId ? Number(accountId) : null,
          affect_treasury: affectTreasury
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء حفظ الرصيد الافتتاحي');
      }

      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setShowConfirmOverwrite(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف الرصيد الافتتاحي؟ سيعيد النظام حساب الرصيد بدون رصيد افتتاحي.')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/opening-balances/${entityType}/${entityId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حذف الرصيد الافتتاحي');

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 dir-rtl max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-snug">
                {existingOb ? 'تعديل الرصيد الافتتاحي' : 'إضافة رصيد افتتاحي'}
              </h3>
              <p className="text-xs text-blue-200">{getEntityTypeLabel()}: {entityName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {fetching ? (
          <div className="p-8 text-center text-slate-500 text-sm">جاري تحميل البيانات...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {existingOb && !showConfirmOverwrite && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong>يوجد رصيد افتتاحي مسجل سابقاً:</strong> {existingOb.amount?.toLocaleString()} ج.م 
                  ({existingOb.balance_type === 'debit' ? (entityType === 'treasury' ? 'رصيد نقدية متوفر' : 'مدين / عليه') : (entityType === 'treasury' ? 'سحب مكشوف' : 'دائن / له')}) بتاريخ {existingOb.effective_date?.split('T')[0]}.
                  {existingOb.account_id && <span className="block mt-0.5 text-blue-700 font-semibold">(مربوط بخزنة نقدية)</span>}
                  <span className="block mt-1 text-amber-700">تعديل هذا المبلغ سيعيد احتساب كشف الحساب والأرصدة تلقائياً.</span>
                </div>
              </div>
            )}

            {showConfirmOverwrite && (
              <div className="p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-blue-900">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  تأكيد حفظ التغييرات على الرصيد الافتتاحي
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  سيتم تحديث سجل الرصيد الافتتاحي وإعادة ضبط الأرصدة التراكمية في كشف الحساب ابتداءً من تاريخ التسوية ({effectiveDate}). هل ترغب بالاستمرار؟
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowConfirmOverwrite(false)}
                    className="px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm"
                  >
                    تأكيد وتحديث
                  </button>
                </div>
              </div>
            )}

            {/* Entity Display */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex justify-between items-center text-sm">
              <span className="text-slate-500 font-semibold">{getEntityTypeLabel()}:</span>
              <span className="font-bold text-slate-800">{entityName}</span>
            </div>

            {/* Balance Type Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                طبيعة الرصيد الافتتاحي <span className="text-red-500">*</span>
              </label>

              {entityType === 'treasury' || entityType === 'financial_account' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBalanceType('debit')}
                    className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                      balanceType === 'debit'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                      رصيد نقدية متوفر (إيجابي)
                    </span>
                    <span className="text-[10px] font-normal opacity-80">
                      فلوس موجودة فعلياً في الدرج أو الحساب
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBalanceType('credit')}
                    className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                      balanceType === 'credit'
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      سحب على المكشوف / عجز (سالب)
                    </span>
                    <span className="text-[10px] font-normal opacity-80">
                      رصيد مكشوف بالسالب
                    </span>
                  </button>
                </div>
              ) : entityType === 'factory' ? (
                <button
                  type="button"
                  onClick={() => setBalanceType('credit')}
                  className="w-full p-3 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 bg-emerald-50 border-emerald-500 text-emerald-800"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  رصيد مقدم افتتاحي للمصنع (متاح للمشتريات)
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBalanceType('debit')}
                    className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                      balanceType === 'debit'
                        ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>مدين / عليه</span>
                    <span className="text-[10px] font-normal opacity-80 text-center">
                      {entityType === 'customer' && 'مستحق على العميل (مديونية للشركة)'}
                      {entityType === 'supplier' && 'دفعة مقدمة للمورد (لنا عنده)'}
                      {entityType === 'worker' && 'سلفة سابقة على العامل'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBalanceType('credit')}
                    className={`p-3 rounded-xl border-2 font-bold text-xs flex flex-col items-center gap-1 transition-all ${
                      balanceType === 'credit'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>دائن / له</span>
                    <span className="text-[10px] font-normal opacity-80 text-center">
                      {entityType === 'customer' && 'رصيد سابق لصالح العميل (له لدينا)'}
                      {entityType === 'supplier' && 'مستحق للمورد (مطلوب منا فواتير)'}
                      {entityType === 'worker' && 'مستحقات ورواتب متأخرة للعامل'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Amount & Date Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ (ج.م) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  تاريخ الرصيد الافتتاحي <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Optional Treasury Linkage (Only for customer, supplier, factory, worker) */}
            {entityType !== 'treasury' && entityType !== 'financial_account' && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={affectTreasury}
                    onChange={(e) => setAffectTreasury(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Landmark className="w-3.5 h-3.5 text-blue-600" />
                    <span>تحديد الخزنة والتأثير في رصيد النقدية (اختياري)</span>
                  </div>
                </label>

                {affectTreasury && (
                  <div className="pt-2 border-t border-slate-200 space-y-2 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        اختر الخزنة أو الحساب المالي المرتبط:
                      </label>
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        required={affectTreasury}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">-- اختر الخزنة أو الحساب البنكي --</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} (الرصيد الحالي: {Number(acc.balance || 0).toLocaleString()} ج.م)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="text-[11px] p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 leading-relaxed font-medium">
                      {entityType === 'customer' && balanceType === 'credit' && '✓ سيتم تسجيل إيداع نقدي (+) في الخزينة كدفعة مقدمة من العميل.'}
                      {entityType === 'customer' && balanceType === 'debit' && 'تنبيه: مديونية العميل لم تُسدد كاش بعد. إذا لم تكن الفلوس قد دخلت الخزينة يفضل عدم تفعيل هذا الخيار.'}
                      {entityType === 'supplier' && balanceType === 'credit' && 'تنبيه: هذا المبلغ مستحق للمورد ولم يتم صرفه من الخزينة بعد.'}
                      {entityType === 'supplier' && balanceType === 'debit' && '✓ سيتم تسجيل صرف نقدي (-) من الخزينة كدفعة مقدمة سابقة للمورد.'}
                      {entityType === 'factory' && '✓ سيتم تسجيل صرف نقدي (-) من الخزينة كرصيد مقدم مسدد للمصنع.'}
                      {entityType === 'worker' && balanceType === 'debit' && '✓ سيتم تسجيل صرف نقدي (-) من الخزينة كسلفة مدفوعة للعامل.'}
                      {entityType === 'worker' && balanceType === 'credit' && 'تنبيه: مستحقات ورواتب متأخرة للعامل لم تصرف بعد.'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Book Reference */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                مرجع المستند / الدفتر القديم (اختياري)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="مثال: دفتر الحسابات الورقي رقم 3 - ص 15"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ملاحظات التسوية
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="2"
                placeholder="تفاصيل إضافية حول الرصيد المنقول قبل استخدام النظام..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-100 mt-4">
              {existingOb ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف الرصيد
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'جاري الحفظ...' : (existingOb ? 'تحديث الرصيد الافتتاحي' : 'حفظ الرصيد الافتتاحي')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default OpeningBalanceModal;
