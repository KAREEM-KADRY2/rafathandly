import React, { useRef, useState } from 'react';
import { X, Printer, Share2, Calendar, FileText, User, Wallet, Building, CheckCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useSettings } from '../context/SettingsContext';

// Simple and accurate Arabic number to words helper for Egyptian Pounds
function numberToArabicWords(number) {
  const num = Math.floor(Math.abs(Number(number) || 0));
  if (num === 0) return 'صفر جنيه مصري لا غير';

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertGroup(n) {
    let result = '';
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const t = Math.floor(rem / 10);
    const o = rem % 10;

    if (h > 0) result += hundreds[h];
    if (rem > 0) {
      if (result) result += ' و ';
      if (rem < 20) {
        result += ones[rem];
      } else {
        if (o > 0) result += ones[o] + ' و ';
        result += tens[t];
      }
    }
    return result;
  }

  let parts = [];
  const millions = Math.floor(num / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  if (millions > 0) {
    if (millions === 1) parts.push('مليون');
    else if (millions === 2) parts.push('مليونان');
    else if (millions >= 3 && millions <= 10) parts.push(convertGroup(millions) + ' ملايين');
    else parts.push(convertGroup(millions) + ' مليون');
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else if (thousands >= 3 && thousands <= 10) parts.push(convertGroup(thousands) + ' آلاف');
    else parts.push(convertGroup(thousands) + ' ألف');
  }

  if (remainder > 0) {
    parts.push(convertGroup(remainder));
  }

  return 'فقط وقدره ' + parts.join(' و ') + ' جنيهاً مصرياً لا غير';
}

export default function TreasuryPrintVoucherModal({ voucher, onClose }) {
  const { settings } = useSettings();
  const voucherRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!voucher) return null;

  const isReceipt = voucher.type === 'IN';
  const voucherTitle = isReceipt ? 'سند قبض نقدية' : 'سند صرف نقدية';
  const actionText = isReceipt ? 'استلمنا من السيد / السيدة:' : 'يُصرف للسيد / السيدة:';
  const numAmount = Number(voucher.amount) || 0;
  const tafqeet = numberToArabicWords(numAmount);

  const handlePrint = () => {
    const printContent = voucherRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  const handleShare = async () => {
    if (!voucherRef.current) return;
    try {
      setIsGenerating(true);
      await new Promise(r => setTimeout(r, 300));
      const canvas = await html2canvas(voucherRef.current, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          alert('تم نسخ صورة السند بنجاح! يمكنك الآن لصقها في واتساب.');
        } catch (e) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `سند_${voucher.id}.png`;
          link.click();
        }
        setIsGenerating(false);
      });
    } catch (e) {
      console.error(e);
      setIsGenerating(false);
      alert('حدث خطأ أثناء نسخ صورة السند');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" dir="rtl">
      <div className="bg-gray-100 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Modal Top Bar */}
        <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center rounded-t-2xl">
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-[#1a2b4c] text-white rounded-lg hover:bg-blue-900 font-bold transition shadow-sm text-sm"
            >
              <Printer size={18} /> طباعة السند
            </button>
            <button
              onClick={handleShare}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-4 py-2 ${isGenerating ? 'bg-gray-400' : 'bg-[#25D366] hover:bg-[#128C7E]'} text-white rounded-lg font-bold transition shadow-sm text-sm`}
            >
              <Share2 size={18} /> {isGenerating ? 'جاري التحضير...' : 'نسخ لواتساب'}
            </button>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-red-500 bg-gray-100 hover:bg-red-50 rounded-full">
            <X size={22} />
          </button>
        </div>

        {/* Printable Voucher Body */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-gray-100 flex-1">
          <div ref={voucherRef} className="max-w-[190mm] mx-auto bg-white rounded-2xl border-2 border-slate-300 shadow-md p-6 sm:p-8 space-y-6">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4">
              <div className="text-right">
                <h1 className="text-2xl font-black text-[#1a2b4c]">{settings.company_name || 'شركة الحاج رفعت'}</h1>
                <p className="text-xs font-bold text-gray-500">{settings.company_tagline || 'لتجارة مواد البناء والمقاولات'}</p>
                {settings.company_phone1 && <p className="text-xs font-semibold text-gray-600" dir="ltr">{settings.company_phone1}</p>}
              </div>

              <div className="text-center px-4 py-1.5 rounded-xl border-2 border-[#1a2b4c] bg-slate-50">
                <h2 className={`text-xl font-black ${isReceipt ? 'text-green-700' : 'text-red-700'}`}>
                  {voucherTitle}
                </h2>
                <div className="text-xs font-bold text-slate-600 mt-0.5">
                  رقم السند: <span className="font-mono font-bold text-[#1a2b4c]" dir="ltr">#{voucher.id}</span>
                </div>
              </div>

              {settings.invoice_show_logo !== 'false' && settings.company_logo && (
                <div className="w-16 h-16 rounded-full border border-gray-300 overflow-hidden shadow-xs">
                  <img src={settings.company_logo} alt="Logo" className="w-full h-full object-contain" />
                </div>
              )}
            </div>

            {/* Date & Account Bar */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-bold">
              <div className="flex items-center gap-2 text-slate-700">
                <Calendar size={15} className="text-[#1a2b4c]" />
                <span>تاريخ التحرير:</span>
                <span className="font-black text-[#1a2b4c]" dir="ltr">{voucher.date ? voucher.date.substring(0, 10) : new Date().toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700 justify-end">
                <Wallet size={15} className="text-[#1a2b4c]" />
                <span>الخزينة المسددة / المستلمة:</span>
                <span className="font-black text-[#1a2b4c]">{voucher.account_name || 'النقدي'}</span>
              </div>
            </div>

            {/* Main Content Rows */}
            <div className="space-y-4 text-sm font-bold text-slate-800">
              {/* Party Row */}
              <div className="flex items-baseline gap-2 border-b border-dashed border-slate-300 pb-2">
                <span className="text-gray-500 whitespace-nowrap">{actionText}</span>
                <span className="text-base font-black text-[#1a2b4c] px-2">{voucher.party_name || voucher.related_entity_name || 'جهة غير محددة'}</span>
              </div>

              {/* Amount Row */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-900 whitespace-nowrap">مبلغ وقدره:</span>
                  <span className="text-2xl font-black text-emerald-800" dir="ltr">
                    {numAmount.toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                  </span>
                </div>
                <div className="text-xs font-black text-emerald-900 bg-white px-3 py-1.5 rounded-lg border border-emerald-300">
                  {tafqeet}
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-baseline gap-2 border-b border-dashed border-slate-300 pb-2">
                <span className="text-gray-500 whitespace-nowrap">طريقة الدفع:</span>
                <span className="font-black text-slate-800">{voucher.payment_method || 'نقدي (كاش)'}</span>
              </div>

              {/* Reason / Notes */}
              <div className="flex items-baseline gap-2 border-b border-dashed border-slate-300 pb-2">
                <span className="text-gray-500 whitespace-nowrap">وذلك قيمة:</span>
                <span className="font-bold text-slate-800">{voucher.description || 'سداد دفعة من الحساب'}</span>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs font-bold text-slate-700">
              <div className="border-t border-slate-300 pt-2">
                <p className="mb-8">توقيع المستلم</p>
                <p className="text-gray-400">..............................</p>
              </div>
              <div className="border-t border-slate-300 pt-2">
                <p className="mb-8">أمين الخزينة / المحاسب</p>
                <p className="text-gray-400">..............................</p>
              </div>
              <div className="border-t border-slate-300 pt-2">
                <p className="mb-8">الاعتماد / الإدارة</p>
                <p className="text-gray-400">..............................</p>
              </div>
            </div>

            {/* Bottom Note */}
            <div className="text-center text-[10px] text-gray-400 pt-2 border-t border-slate-100 flex justify-between">
              <span>* يُعتبر هذا السند مستنداً مالياً رسمياً صادراً من نظام إدارة الحسابات.</span>
              <span>المستخدم: {voucher.user || 'النظام'}</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
