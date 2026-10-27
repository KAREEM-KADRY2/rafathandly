import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, User, Wallet, Receipt, Calculator, Calendar, FileText, Phone, MapPin, Edit3 } from 'lucide-react';
import api from '../api';
import { Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useSettings } from '../context/SettingsContext';
import EditSaleModal from './EditSaleModal';

export default function SaleDetailsModal({ saleId, onClose }) {
  const { settings } = useSettings();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const printRef = useRef();
  const invoiceRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchSaleDetails();
  }, [saleId]);

  const fetchSaleDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/sales/${saleId}`);
      setSale(res.data);
    } catch (err) {
      console.error(err);
      alert('خطأ في جلب تفاصيل الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  
  const handleWhatsappShare = async () => {
    if (!invoiceRef.current) return;
    try {
      setIsGenerating(true);
      // Small delay to ensure any UI rendering is complete
      await new Promise(res => setTimeout(res, 300));
      
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
      
      let phone = sale?.customer_phone || '';
      if (phone.startsWith('01') && phone.length === 11) {
        phone = '+2' + phone;
      } else {
        phone = phone.replace(/[^0-9+]/g, '');
      }

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          alert('تم نسخ الفاتورة كصورة! سيتم فتح واتساب الآن، قم بعمل "لصق" (Paste) لإرسال الفاتورة.');
        } catch (e) {
          console.error('Clipboard copy failed:', e);
          alert('لم نتمكن من النسخ التلقائي. سيتم تحميل الصورة بدلاً من ذلك، ويمكنك إرسالها يدوياً.');
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `فاتورة_${sale.invoice_number || sale.id}.png`;
          link.click();
        }

        const whatsappUrl = `https://wa.me/${phone}`;
        window.open(whatsappUrl, '_blank');
        setIsGenerating(false);
      }, 'image/png');
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
      alert('حدث خطأ أثناء إنشاء الصورة.');
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload(); 
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl font-bold text-lg shadow-lg">جاري تحميل الفاتورة...</div>
      </div>
    );
  }

  if (!sale) return null;

  // Calculations for display
  const previousBalance = sale.previous_customer_balance || 0;
  const invoiceTotal = sale.original_amount || 0;
  const subTotal = previousBalance + invoiceTotal;
  const paidAmount = sale.paid_amount || 0;
  const remainingBalance = subTotal - paidAmount;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" dir="rtl">
      <div className="bg-gray-100 rounded-xl shadow-2xl w-full max-w-4xl overflow-x-auto flex flex-col max-h-[95vh]">
        
        {/* Header Actions */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white rounded-t-xl">
            <div className="flex gap-3">
              <button 
                onClick={handlePrint} 
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1a2b4c] text-white rounded-lg hover:bg-blue-900 font-bold transition-colors shadow-sm"
              >
                <Printer size={20} /> طباعة الفاتورة
              </button>
              <button 
                onClick={handleWhatsappShare}
                disabled={isGenerating}
                className={`flex items-center gap-2 px-5 py-2.5 ${isGenerating ? 'bg-gray-400' : 'bg-[#25D366] hover:bg-[#128C7E]'} text-white rounded-lg font-bold transition-colors shadow-sm`}
              >
                <Share2 size={20} /> {isGenerating ? 'جاري التجهيز...' : 'مشاركة واتساب'}
              </button>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-colors shadow-sm"
              >
                <Edit3 size={20} /> تعديل الفاتورة
              </button>
            </div>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition-colors p-1 bg-gray-100 hover:bg-red-50 rounded-full">
            <X size={26} />
          </button>
        </div>

        {/* Scrollable Content for Printing */}
        <div className="overflow-y-auto p-4 md:p-8 bg-gray-100" ref={printRef}>
          {/* Printable Area - Designed precisely and compactly */}
          <div ref={invoiceRef} className="max-w-[210mm] mx-auto bg-white rounded-2xl shadow-sm overflow-hidden" style={{ position: 'relative' }}>
            
            {/* Top Border Accent */}
            <div className="h-2 w-full bg-[#1a2b4c]"></div>

            {/* HEADER SECTION */}
            <div className="p-5 md:p-6 flex justify-between items-center border-b border-gray-100 relative">
                
                {/* Right: Contact Info Box */}
                <div className="bg-[#f4f7fb] border-r-4 border-[#1a2b4c] rounded-l-2xl p-3 w-[240px] text-[#1a2b4c] z-10">
                    <h3 className="text-center font-black text-sm mb-2.5 border-b border-gray-200 pb-1.5">للتواصل والاستفسار</h3>
                    <div className="space-y-2 font-bold text-xs">
                        {settings.company_phone1 && (
                          <div className="flex items-center gap-2 justify-end">
                              <div className="text-right">
                                  <div>{settings.company_phone1_label || 'الإدارة'}</div>
                                  <div dir="ltr">{settings.company_phone1}</div>
                              </div>
                              <div className="bg-[#1a2b4c] text-white p-1 rounded-full"><Phone size={13} /></div>
                          </div>
                        )}
                        {settings.company_phone2 && (
                          <div className="flex items-center gap-2 justify-end">
                              <div className="text-right">
                                  <div>{settings.company_phone2_label || 'الحسابات'}</div>
                                  <div dir="ltr">{settings.company_phone2}</div>
                              </div>
                              <div className="bg-[#1a2b4c] text-white p-1 rounded-full"><Phone size={13} /></div>
                          </div>
                        )}
                        {settings.company_address && (
                          <div className="flex items-center gap-2 justify-end">
                              <div className="text-right">{settings.company_address}</div>
                              <div className="bg-[#1a2b4c] text-white p-1 rounded-full"><MapPin size={13} /></div>
                          </div>
                        )}
                    </div>
                </div>

                {/* Center: Company Name */}
                <div className="text-center z-10 px-4">
                    <h1 className="text-2xl sm:text-3xl font-black text-[#1a2b4c] mb-1 leading-tight">
                      {settings.company_name || 'اسم الشركة'}
                    </h1>
                    {settings.company_tagline && (
                      <p className="text-gray-500 font-bold text-xs sm:text-sm">{settings.company_tagline}</p>
                    )}
                </div>

                {/* Left: Logo (Controlled by settings.invoice_show_logo) */}
                {settings.invoice_show_logo !== 'false' && settings.invoice_show_logo !== false && (
                  <div className="z-10">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-[#1a2b4c] p-1 overflow-hidden shadow-md bg-white">
                          <img
                            src={settings.company_logo || '/logo.jpg'}
                            alt="Logo"
                            className="w-full h-full object-contain rounded-full"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                      </div>
                  </div>
                )}
                
                {/* Decorative Background lines */}
                <div className="absolute top-0 left-0 w-48 h-48 bg-gray-50 rounded-br-full -z-0 opacity-40"></div>
            </div>

            <div className="p-5 md:p-6">
                {/* CUSTOMER INFO BAR */}
                <div className="bg-[#f8f9fc] rounded-xl p-3.5 flex justify-between items-center mb-4 border border-gray-100">
                    <div className="text-right px-3">
                        <p className="text-gray-400 font-bold text-xs mb-0.5">اسم العميل:</p>
                        <p className="text-xl font-black text-[#1a2b4c]">{sale.customer_name}</p>
                        {sale.opening_balance && Number(sale.opening_balance.amount) > 0 && (
                          <div className="mt-1 flex items-center gap-2 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100 inline-flex">
                            <span>الرصيد الافتتاحي:</span>
                            <span dir="ltr">{Number(sale.opening_balance.amount).toLocaleString()} ج.م</span>
                            <span>({sale.opening_balance.balance_type === 'debit' ? 'مدين / عليه' : 'دائن / له'})</span>
                          </div>
                        )}
                    </div>
                    <div className="bg-[#3b82f6] text-white p-2.5 rounded-xl shadow-sm">
                        <User size={24} />
                    </div>
                </div>

                {/* PRODUCTS TABLE (Real Transaction Items) */}
                <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-right">
                        <thead className="bg-[#1a2b4c] text-white">
                            <tr>
                                <th className="py-2.5 px-3.5 font-bold text-sm">م</th>
                                <th className="py-2.5 px-3.5 font-bold text-sm">البيان / الصنف</th>
                                <th className="py-2.5 px-3.5 font-bold text-sm">الكمية</th>
                                <th className="py-2.5 px-3.5 font-bold text-sm">الوحدة</th>
                                <th className="py-2.5 px-3.5 font-bold text-sm">سعر الوحدة</th>
                                <th className="py-2.5 px-3.5 font-bold text-sm">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {(Array.isArray(sale.items) ? sale.items : []).map((item, index) => (
                                <tr key={item.id || index} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/70">
                                    <td className="py-2.5 px-3.5 font-bold text-gray-500 text-sm">{index + 1}</td>
                                    <td className="py-2.5 px-3.5 font-black text-[#1a2b4c]">
                                        <div>{item.item_name}</div>
                                        {item.allocations && item.allocations.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {item.allocations.map((alloc, aIdx) => (
                                                    <span 
                                                        key={aIdx} 
                                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200"
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                                        <span className="text-blue-700">المصدر:</span>
                                                        <span className="font-black text-blue-950">{alloc.supplier_name || 'غير محدد'}</span>
                                                        <span className="text-[10px] text-blue-600 font-semibold">({(alloc.supplier_type === 'factory' || alloc.supplier_type === 'مصنع') ? 'مصنع' : 'مورد'})</span>
                                                        {item.allocations.length > 1 && (
                                                            <span className="bg-blue-200 text-blue-900 px-1 rounded text-[10px] font-black" dir="ltr">
                                                                {alloc.quantity} {item.unit}
                                                            </span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-3.5 font-bold text-sm">
                                      <span>{item.quantity} {item.unit}</span>
                                    </td>
                                    <td className="py-2.5 px-3.5 font-bold text-gray-600 text-sm">{item.unit}</td>
                                    <td className="py-2.5 px-3.5 font-bold text-sm" dir="ltr">{Number(item.unit_price || 0).toLocaleString()}</td>
                                    <td className="py-2.5 px-3.5 font-black text-emerald-600 text-sm" dir="ltr">{Number((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()} ج.م</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* FINANCIAL DETAILS BOX - Compact, Modern & Organized */}
                <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm mb-4 bg-white">
                    {/* Row 1: The 3 calculation stages */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-gray-200 bg-slate-50/80 border-b border-gray-200">
                        {/* Previous Balance */}
                        <div className="p-3 px-3.5 flex items-center justify-between sm:justify-start gap-3 bg-white sm:bg-transparent">
                            <div className="bg-[#1a2b4c]/10 text-[#1a2b4c] p-2 rounded-lg">
                                <Wallet size={18} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-gray-500">الحساب السابق</div>
                                <div className="text-base sm:text-lg font-black text-gray-800" dir="ltr">
                                    {Number(previousBalance || 0).toLocaleString()} <span className="text-xs font-bold text-gray-500">ج.م</span>
                                </div>
                                {sale.opening_balance && Number(sale.opening_balance.amount) > 0 && (
                                    <div className="text-[10px] font-bold text-indigo-700">
                                        (منه رصيد افتتاحي: {Number(sale.opening_balance.amount).toLocaleString()})
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Current Invoice */}
                        <div className="p-3 px-3.5 flex items-center justify-between sm:justify-start gap-3 bg-blue-50/40">
                            <div className="bg-blue-600/10 text-blue-700 p-2 rounded-lg">
                                <Receipt size={18} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-blue-700">{settings.invoice_default_title || 'فاتورة اليوم'}</div>
                                <div className="text-base sm:text-lg font-black text-blue-700" dir="ltr">
                                    {Number(invoiceTotal || 0).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                                </div>
                            </div>
                        </div>

                        {/* Subtotal */}
                        <div className="p-3 px-3.5 flex items-center justify-between sm:justify-start gap-3 bg-amber-50/40">
                            <div className="bg-amber-500/15 text-amber-800 p-2 rounded-lg">
                                <Calculator size={18} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-amber-800">إجمالي الحساب (سابق + حالي)</div>
                                <div className="text-base sm:text-lg font-black text-amber-900" dir="ltr">
                                    {Number(subTotal || 0).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Payment & Remaining Balance */}
                    <div className={`grid ${paidAmount > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-700`}>
                        {paidAmount > 0 && (
                            <div className="p-3 px-4 bg-emerald-50/80 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="bg-emerald-600 text-white p-1.5 rounded-lg shadow-xs">
                                        <Wallet size={16} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-emerald-900">المدفوع نقداً</div>
                                        <div className="text-[10px] font-semibold text-emerald-600">دفعة مسددة من الفاتورة</div>
                                    </div>
                                </div>
                                <div className="text-lg sm:text-xl font-black text-emerald-700" dir="ltr">
                                    - {Number(paidAmount || 0).toLocaleString()} <span className="text-xs font-bold">ج.م</span>
                                </div>
                            </div>
                        )}

                        <div className="p-3 px-4 bg-[#1a2b4c] text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="bg-[#facc15] text-[#1a2b4c] p-1.5 rounded-lg shadow-xs">
                                    <Calculator size={18} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-gray-300">الرصيد المتبقي المستحق</div>
                                    <div className="text-[10px] font-semibold text-amber-300">
                                        {remainingBalance === 0 ? '✔ تم سداد الفاتورة بالكامل' : 'متبقي مطلوب سداده'}
                                    </div>
                                </div>
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-[#facc15]" dir="ltr">
                                {Number(remainingBalance || 0).toLocaleString()} <span className="text-xs font-bold text-amber-300">ج.م</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="flex justify-center items-center gap-8 sm:gap-14 pt-3.5 border-t border-gray-200">
                    <div className="flex items-center gap-2.5">
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-400">تاريخ الطباعة</p>
                            <p className="font-black text-sm text-[#1a2b4c]">{new Date().toLocaleDateString('en-GB')}</p>
                        </div>
                        <Calendar className="text-[#1a2b4c]" size={20} />
                    </div>
                    
                    <div className="w-px h-7 bg-gray-200"></div>
                    
                    <div className="flex items-center gap-2.5">
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-400">رقم الفاتورة</p>
                            <p className="font-black text-sm text-[#1a2b4c] uppercase">
                              {(settings.invoice_number_format || 'INV-{ID}').replace('{ID}', sale.invoice_number || sale.id)}
                            </p>
                        </div>
                        <FileText className="text-[#1a2b4c]" size={20} />
                    </div>
                </div>

                {sale.notes && (
                  <div className="mt-3.5 mb-2 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 text-right">
                    <div className="flex items-center gap-2 font-black text-amber-900 mb-0.5 text-xs">
                      <FileText size={16} className="text-amber-700" />
                      <span>ملاحظات الفاتورة:</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed font-bold text-xs">{sale.notes}</p>
                  </div>
                )}
            </div>
            
            {/* Bottom Border Accent */}
            <div className="h-2 w-full bg-[#1a2b4c]"></div>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <EditSaleModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          sale={sale}
          onSuccess={() => {
            fetchSaleDetails();
          }}
        />
      )}
    </div>
  );
}
