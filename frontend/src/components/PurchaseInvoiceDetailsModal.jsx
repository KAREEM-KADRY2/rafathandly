import React, { useState, useEffect } from 'react';
import { X, Printer, Trash2 } from 'lucide-react';
import api from '../api';

export default function PurchaseInvoiceDetailsModal({ isOpen, onClose, invoiceId, onDelete }) {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && invoiceId) {
      fetchInvoiceDetails();
    }
  }, [isOpen, invoiceId]);

  const fetchInvoiceDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/purchases/${invoiceId}`);
      setInvoice(res.data);
    } catch (err) {
      console.error(err);
      alert('تعذر تحميل تفاصيل الفاتورة');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">تفاصيل الفاتورة</h2>
          <div className="flex gap-2 items-center">
            {onDelete && invoice && (
              <button
                onClick={() => {
                  onDelete(invoice.id, invoice.invoice_number);
                  onClose();
                }}
                className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm"
                title="حذف الفاتورة"
              >
                <Trash2 size={16} /> حذف الفاتورة
              </button>
            )}
            <button onClick={() => window.print()} className="text-gray-600 hover:text-gray-900 bg-gray-100 p-2 rounded hidden md:flex items-center gap-2">
              <Printer size={20} /> طباعة
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 bg-gray-100 p-2 rounded">
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-10 text-gray-500 font-bold">جاري تحميل الفاتورة...</div>
          ) : !invoice ? (
            <div className="text-center py-10 text-red-500 font-bold">لم يتم العثور على الفاتورة</div>
          ) : (
            <div className="space-y-6">
              
              {/* Invoice Info Header */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg border">
                <div>
                  <div className="text-sm text-gray-500">رقم الفاتورة</div>
                  <div className="font-bold text-lg">{invoice.invoice_number || `#${invoice.id}`}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">تاريخ الشراء</div>
                  <div className="font-bold text-lg">{invoice.purchase_date ? new Date(invoice.purchase_date).toLocaleDateString('ar-EG') : '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">{invoice.supplier_type === 'مصنع' ? 'المصنع' : 'المورد'}</div>
                  <div className="font-bold text-lg">{invoice.supplier_name || 'غير محدد'}</div>
                  {invoice.supplier_phone && <div className="text-sm text-gray-600" dir="ltr">{invoice.supplier_phone}</div>}
                  {invoice.opening_balance && Number(invoice.opening_balance.amount) > 0 && (
                    <div className="mt-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block">
                      الرصيد الافتتاحي: {Number(invoice.opening_balance.amount).toLocaleString()} ج.م ({invoice.opening_balance.balance_type === 'credit' ? 'له / دائن' : 'عليه / مدين'})
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-sm text-gray-500">تاريخ الاستحقاق</div>
                  <div className="font-bold text-sm">
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('ar-EG') : 'غير محدد'}
                    {invoice.credit_deadline ? ` (${invoice.credit_deadline} يوم)` : ''}
                  </div>
                  {Number(invoice.remaining_amount || 0) > 0 && invoice.is_overdue && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">
                      🔴 متأخر بالسداد
                    </span>
                  )}
                  {Number(invoice.remaining_amount || 0) > 0 && !invoice.is_overdue && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">
                      🟢 ضمن المهلة
                    </span>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h3 className="font-bold text-lg mb-3">أصناف الفاتورة</h3>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-right">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="p-3">الصنف</th>
                        <th className="p-3">الكمية</th>
                        <th className="p-3">الوحدة</th>
                        <th className="p-3">سعر الوحدة</th>
                        <th className="p-3">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(invoice.items) && invoice.items.length > 0 ? (
                        invoice.items.map((item, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="p-3 font-bold">{item.item_name}</td>
                            <td className="p-3" dir="ltr">{item.quantity}</td>
                            <td className="p-3">{item.unit}</td>
                            <td className="p-3" dir="ltr">{Number(item.unit_price || 0).toLocaleString()} ج.م</td>
                            <td className="p-3 font-bold text-blue-700" dir="ltr">{(Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString()} ج.م</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="5" className="text-center p-4 text-gray-500">لا توجد أصناف</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Summary */}
              <div className="flex flex-col md:flex-row justify-end pt-4">
                <div className="w-full md:w-1/2 bg-blue-50 border border-blue-100 p-4 rounded-lg">
                  <h3 className="font-bold text-lg mb-3 border-b border-blue-200 pb-2">ملخص الحساب</h3>
                  
                  {invoice.opening_balance && Number(invoice.opening_balance.amount) > 0 && (
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-blue-200 text-sm">
                      <span className="text-indigo-900 font-bold">الرصيد الافتتاحي:</span>
                      <span className="font-bold text-indigo-800" dir="ltr">
                        {Number(invoice.opening_balance.amount).toLocaleString()} ج.م ({invoice.opening_balance.balance_type === 'credit' ? 'له / دائن' : 'عليه / مدين'})
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">إجمالي الفاتورة:</span>
                    <span className="font-bold text-lg" dir="ltr">{Number(invoice.total_amount || 0).toLocaleString()} ج.م</span>
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">نوع السداد:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      invoice.payment_type === 'cash' || (invoice.remaining_amount <= 0 && invoice.paid_amount >= invoice.total_amount && invoice.payment_type !== 'credit')
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : (invoice.payment_type === 'balance_deduction' ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-amber-100 text-amber-800 border border-amber-300')
                    }`}>
                      {invoice.payment_type === 'cash' ? 'نقدي (مسددة بالكامل فوراً)' : (invoice.payment_type === 'balance_deduction' ? 'خصم من رصيد المصنع' : 'آجل (على الحساب)')}
                    </span>
                  </div>

                  {invoice.account_name && (
                    <div className="flex justify-between items-center mb-2 text-xs text-slate-600">
                      <span>الخزينة المسدد منها:</span>
                      <span className="font-bold">{invoice.account_name} ({invoice.payment_method || 'نقدي'})</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-700">المدفوع:</span>
                    <span className="font-bold text-green-600" dir="ltr">{Number(invoice.paid_amount || 0).toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-blue-200">
                    <span className="font-bold">المتبقي:</span>
                    <span className="font-bold text-xl text-red-600" dir="ltr">{Number(invoice.remaining_amount || 0).toLocaleString()} ج.م</span>
                  </div>
                  
                  <div className="mt-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${invoice.remaining_amount <= 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {invoice.remaining_amount <= 0 ? 'مسددة بالكامل' : 'غير مسددة بالكامل'}
                    </span>
                  </div>
                </div>
              </div>
              
              {invoice.notes && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <h4 className="font-bold mb-1 text-sm text-gray-500">ملاحظات:</h4>
                  <p>{invoice.notes}</p>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
