import React, { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import api from '../api';

export default function CollectServiceRevenueModal({ isOpen, onClose, service, onSuccess }) {
    const [formData, setFormData] = useState({
        amount: service?.default_price || '',
        payment_method: 'نقدية',
        description: `إيراد من خدمة: ${service?.name || ''}`,
        date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
        party_name: 'عميل عام'
    });
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setFormData({
                amount: service?.default_price || '',
                payment_method: 'نقدية',
                description: `إيراد من خدمة: ${service?.name || ''}`,
                date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
                party_name: 'عميل عام'
            });
            api.get('/customers').then(res => setCustomers(res.data || [])).catch(console.error);
        }
    }, [isOpen, service]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/services/collect-revenue', {
                service_id: service?.id,
                amount: parseFloat(formData.amount),
                payment_method: formData.payment_method,
                description: formData.description,
                party_name: formData.party_name,
                date: formData.date
            });
            onSuccess();
            onClose();
        } catch (error) {
            alert(error.response?.data?.error || 'حدث خطأ أثناء تحصيل الإيراد');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4" dir="rtl">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="bg-green-600 p-6 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">تحصيل إيراد خدمة</h2>
                        <p className="text-green-100 mt-1 text-sm">{service?.name} (لا يؤثر على المخزن)</p>
                    </div>
                    <button onClick={onClose} className="text-green-100 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">المبلغ (ج.م)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                                <DollarSign size={18} />
                            </div>
                            <input
                                required
                                type="number"
                                min="1"
                                step="any"
                                className="w-full pl-3 pr-10 py-2.5 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none font-bold text-lg"
                                dir="ltr"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">العميل المرتبط بالخدمة</label>
                        <input
                            type="text"
                            list="revenue-customers-list"
                            className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none font-medium"
                            placeholder="اختر عميل أو اكتب اسم عميل جديد..."
                            value={formData.party_name}
                            onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                        />
                        <datalist id="revenue-customers-list">
                            {customers.map(c => (
                                <option key={c.id} value={c.name} />
                            ))}
                        </datalist>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">طريقة التحصيل (الخزنة / الحساب المالي)</label>
                        <select
                            className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none bg-white font-medium"
                            value={formData.payment_method}
                            onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                        >
                            <option value="نقدية">نقدية (الخزينة الرئيسية)</option>
                            <option value="بنك">تحويل بنكي</option>
                            <option value="محفظة">محفظة إلكترونية</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">تاريخ التحصيل</label>
                        <input
                            required
                            type="date"
                            className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات / بيان الإيراد</label>
                        <input
                            required
                            type="text"
                            className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'جاري التحصيل...' : 'تأكيد التحصيل'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
