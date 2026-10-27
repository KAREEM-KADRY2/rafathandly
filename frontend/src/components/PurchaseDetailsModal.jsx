import React, { useState } from 'react';
import { X, Printer, FileDown, CheckCircle, Clock, Users } from 'lucide-react';
import api from '../api';
import SaleDetailsModal from './SaleDetailsModal';

export default function PurchaseDetailsModal({ isOpen, onClose, purchase }) {
    const [selectedSaleId, setSelectedSaleId] = useState(null);

    if (!isOpen || !purchase) return null;

    const handlePrint = () => {
        window.open(`${api.defaults.baseURL}/purchases/${purchase.id}/pdf`, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]" dir="rtl">
                
                {/* Header */}
                <div className="bg-slate-800 text-white p-5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">تفاصيل فاتورة الشراء وتتبع الكميات</h2>
                        <div className="text-slate-300 text-sm mt-1">
                            فاتورة رقم: <span className="font-semibold text-white" dir="ltr">{purchase.invoice_number || `#${purchase.id}`}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition bg-slate-700/50 p-2 rounded-full hover:bg-slate-700">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1 space-y-6">
                    
                    {/* Section 1: Invoice Summary Info */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="text-xs text-gray-500 mb-1">المورد / المصنع</div>
                            <div className="font-bold text-gray-800">{purchase.supplier_name || '-'}</div>
                            {purchase.opening_balance && Number(purchase.opening_balance.amount) > 0 && (
                              <div className="text-[11px] font-bold text-indigo-700 mt-1">
                                رصيد افتتاحي: {Number(purchase.opening_balance.amount).toLocaleString()} ج.م ({purchase.opening_balance.balance_type === 'credit' ? 'له' : 'عليه'})
                              </div>
                            )}
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="text-xs text-gray-500 mb-1">تاريخ الفاتورة</div>
                            <div className="font-bold text-gray-800">{new Date(purchase.purchase_date).toLocaleDateString('ar-EG')}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="text-xs text-gray-500 mb-1">فترة السماح والاستحقاق</div>
                            <div className="font-bold text-gray-800 text-xs">
                                {purchase.due_date ? new Date(purchase.due_date).toLocaleDateString('ar-EG') : '-'}
                                {purchase.credit_deadline ? ` (${purchase.credit_deadline} يوم)` : ''}
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="text-xs text-gray-500 mb-1">رقم الفاتورة الأصلي</div>
                            <div className="font-bold text-gray-800" dir="ltr">{purchase.invoice_number || '-'}</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="text-xs text-gray-500 mb-1">حالة السداد</div>
                            <div className="font-bold">
                                {purchase.remaining_amount === 0 ? (
                                    <span className="text-green-600 flex items-center gap-1"><CheckCircle size={14} /> مدفوعة بالكامل</span>
                                ) : purchase.is_overdue ? (
                                    <span className="text-red-600 flex items-center gap-1"><Clock size={14} /> متأخر بالسداد</span>
                                ) : purchase.paid_amount > 0 ? (
                                    <span className="text-yellow-600 flex items-center gap-1"><Clock size={14} /> مدفوعة جزئياً</span>
                                ) : (
                                    <span className="text-blue-600 flex items-center gap-1"><Clock size={14} /> غير مدفوعة (ضمن المهلة)</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Items Table */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-100 p-3 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">أصناف الفاتورة ورصيد المباع</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 text-sm border-b">
                                        <th className="p-3 font-semibold">الصنف</th>
                                        <th className="p-3 font-semibold text-center">الكمية المشتراة</th>
                                        <th className="p-3 font-semibold text-center bg-emerald-50 text-emerald-800">المباع حتى الآن</th>
                                        <th className="p-3 font-semibold text-center bg-blue-50 text-blue-800">المتبقي من الشحنة</th>
                                        <th className="p-3 font-semibold">الوحدة</th>
                                        <th className="p-3 font-semibold">سعر الوحدة</th>
                                        <th className="p-3 font-semibold">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchase.items && purchase.items.map((item, idx) => {
                                        let equivalentText = '';
                                        if (item.item_name === 'أسمنت') {
                                            if (item.unit === 'طن') equivalentText = `${Number(item.quantity * 20).toLocaleString()} شكارة`;
                                            else if (item.unit === 'شكارة') equivalentText = `${Number(item.quantity / 20).toLocaleString()} طن`;
                                        } else if (item.item_name === 'طوب') {
                                            if (item.unit.includes('بلتة')) equivalentText = `${Number(item.base_quantity).toLocaleString()} طوبة`;
                                            else if (item.unit === 'ألف') equivalentText = `${Number(item.quantity * 200).toLocaleString()} طوبة`;
                                        } else if (item.unit !== item.base_unit && item.base_unit) {
                                            equivalentText = `${Number(item.base_quantity).toLocaleString()} ${item.base_unit}`;
                                        }

                                        const soldQty = item.sold_quantity || 0;
                                        const remainingQty = item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity;

                                        return (
                                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50/50">
                                                <td className="p-3 font-bold text-gray-800">{item.item_name}</td>
                                                <td className="p-3 font-bold text-center" dir="ltr">{item.quantity}</td>
                                                <td className="p-3 font-extrabold text-center text-emerald-700 bg-emerald-50/50" dir="ltr">{soldQty}</td>
                                                <td className="p-3 font-extrabold text-center text-blue-700 bg-blue-50/50" dir="ltr">{remainingQty}</td>
                                                <td className="p-3">
                                                    <span className="text-blue-700 font-medium">{item.unit}</span>
                                                    {equivalentText && <span className="text-xs text-gray-500 mr-2">({equivalentText})</span>}
                                                </td>
                                                <td className="p-3 font-medium text-gray-600" dir="ltr">{Number(item.unit_price).toLocaleString()} ج.م</td>
                                                <td className="p-3 font-bold text-gray-900" dir="ltr">{Number(item.total_price).toLocaleString()} ج.م</td>
                                            </tr>
                                        );
                                    })}
                                    {(!purchase.items || purchase.items.length === 0) && (
                                        <tr><td colSpan="7" className="p-6 text-center text-gray-400">لا توجد أصناف مسجلة لهذه الفاتورة</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 3: REAL Customer Sales Tracking Section */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                                <Users size={20} className="text-indigo-600" />
                                العملاء الذين اشتروا من هذه الكمية (تتبع المبيعات)
                            </h3>
                        </div>

                        {purchase.items && purchase.items.some(item => item.customer_sales && item.customer_sales.length > 0) ? (
                            <div className="space-y-5">
                                {purchase.items.map((item, idx) => (
                                    <div key={idx} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
                                        <div className="flex flex-wrap justify-between items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                                            <span className="font-black text-slate-800 text-sm">{item.item_name}</span>
                                            <div className="flex gap-4 text-xs font-bold">
                                                <span className="text-slate-600">المشترى: <strong className="text-slate-900">{item.quantity} {item.unit}</strong></span>
                                                <span className="text-emerald-700">إجمالي المباع: <strong className="text-emerald-900">{item.sold_quantity || 0} {item.unit}</strong></span>
                                                <span className="text-blue-700">المتبقي: <strong className="text-blue-900">{item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity} {item.unit}</strong></span>
                                            </div>
                                        </div>

                                        {item.customer_sales && item.customer_sales.length > 0 ? (
                                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                                <table className="w-full text-right text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-100 text-slate-700 border-b">
                                                            <th className="p-2.5 font-bold">العميل</th>
                                                            <th className="p-2.5 font-bold text-center">الكمية المباعة</th>
                                                            <th className="p-2.5 font-bold text-center">الوحدة</th>
                                                            <th className="p-2.5 font-bold text-center">تاريخ البيع</th>
                                                            <th className="p-2.5 font-bold text-center">رقم الفاتورة</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {item.customer_sales.map((cs, cIdx) => (
                                                            <tr key={cIdx} className="border-b last:border-0 hover:bg-indigo-50/30 transition-colors">
                                                                <td className="p-2.5 font-black text-slate-800">{cs.customer_name}</td>
                                                                <td className="p-2.5 font-black text-center text-emerald-800" dir="ltr">{cs.quantity}</td>
                                                                <td className="p-2.5 font-bold text-center text-slate-700">{cs.unit}</td>
                                                                <td className="p-2.5 text-center text-slate-600 font-semibold">{new Date(cs.sale_date).toLocaleDateString('ar-EG')}</td>
                                                                <td className="p-2.5 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedSaleId(cs.credit_sale_id)}
                                                                        className="text-indigo-600 hover:text-indigo-900 underline font-bold bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded transition-colors"
                                                                    >
                                                                        {cs.invoice_number || `#${cs.credit_sale_id}`}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 italic py-1">لم يتم بيع أي كمية من هذا الصنف بعد</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-slate-500 text-sm font-bold bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                لم يقم أي عميل بالشراء من كميات هذه الفاتورة حتى الآن
                            </div>
                        )}
                    </div>

                    {/* Original Notes (Preserved) */}
                    {purchase.notes && (
                        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
                            <h4 className="font-bold mb-1 text-sm text-amber-900">الملاحظات الأصلية:</h4>
                            <p className="text-xs text-amber-800 font-semibold">{purchase.notes}</p>
                        </div>
                    )}

                    {/* Section 4: Financial Summary */}
                    <div className="flex justify-end">
                        <div className="w-full md:w-1/2 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                            {purchase.opening_balance && Number(purchase.opening_balance.amount) > 0 && (
                              <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-100 text-sm">
                                  <span className="text-indigo-800 font-bold">الرصيد الافتتاحي:</span>
                                  <span className="font-bold text-indigo-700" dir="ltr">
                                    {Number(purchase.opening_balance.amount).toLocaleString()} ج.م ({purchase.opening_balance.balance_type === 'credit' ? 'له / دائن' : 'عليه / مدين'})
                                  </span>
                              </div>
                            )}
                            <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-100">
                                <span className="text-gray-600 font-medium">إجمالي الفاتورة:</span>
                                <span className="text-xl font-bold text-blue-900" dir="ltr">{Number(purchase.total_amount).toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center mb-3 pb-3 border-b border-gray-100">
                                <span className="text-gray-600 font-medium">المدفوع:</span>
                                <span className="text-lg font-bold text-green-600" dir="ltr">{Number(purchase.paid_amount || 0).toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-bold">المتبقي:</span>
                                <span className="text-xl font-black text-red-600" dir="ltr">{Number(purchase.remaining_amount || 0).toLocaleString()} ج.م</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer / Actions */}
                <div className="bg-white p-4 border-t border-gray-200 flex justify-between items-center rounded-b-xl gap-3">
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm transition">
                            <Printer size={18} /> طباعة الفاتورة
                        </button>
                        <button onClick={handlePrint} className="bg-red-50 text-red-600 border border-red-200 px-5 py-2 rounded-lg hover:bg-red-100 flex items-center gap-2 font-bold transition">
                            <FileDown size={18} /> تحميل PDF
                        </button>
                    </div>
                    <button onClick={onClose} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 font-bold transition">
                        إغلاق
                    </button>
                </div>

                {selectedSaleId && (
                    <SaleDetailsModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
                )}

            </div>
        </div>
    );
}

