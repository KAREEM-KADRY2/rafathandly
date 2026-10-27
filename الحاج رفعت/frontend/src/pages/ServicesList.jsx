import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import api from '../api';
import CollectServiceRevenueModal from '../components/CollectServiceRevenueModal';
import { DollarSign } from 'lucide-react';

export default function ServicesList() {
    const [services, setServices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [revenueService, setRevenueService] = useState(null);
    const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        default_price: '',
        cost_price: '',
        status: 'active'
    });

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            const res = await api.get('/services');
            setServices(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setServices([]);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingService) {
                await api.put(`/services/${editingService.id}`, formData);
            } else {
                await api.post('/services', formData);
            }
            setIsModalOpen(false);
            fetchServices();
        } catch (err) {
            alert(err.response?.data?.error || 'حدث خطأ أثناء حفظ الخدمة');
        }
    };

    const handleEdit = (srv) => {
        setEditingService(srv);
        setFormData({
            name: srv.name,
            description: srv.description || '',
            default_price: srv.default_price || '',
            cost_price: srv.cost_price || '',
            status: srv.status
        });
        setIsModalOpen(true);
    };

    const handleDeactivate = async (id) => {
        if (!window.confirm('هل أنت متأكد من إيقاف هذه الخدمة؟')) return;
        try {
            await api.delete(`/services/${id}`);
            fetchServices();
        } catch (err) {
            alert('حدث خطأ أثناء الإيقاف');
        }
    };

    const serviceList = Array.isArray(services) ? services : [];
    const filteredServices = serviceList.filter(s => 
        String(s?.name || '').toLowerCase().includes(String(searchTerm || '').toLowerCase())
    );

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">إدارة الخدمات</h1>
                    <p className="text-gray-500 mt-1">إضافة وتعديل الخدمات التي تقدمها للعملاء</p>
                </div>
                <button 
                    onClick={() => {
                        setEditingService(null);
                        setFormData({ name: '', description: '', default_price: '', cost_price: '', status: 'active' });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 font-bold shadow-md transition-colors"
                >
                    <Plus size={20} />
                    إضافة خدمة جديدة
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-3 text-gray-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="ابحث عن خدمة..." 
                        className="w-full border-gray-300 pl-4 pr-10 py-2.5 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-right text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                        <tr>
                            <th className="p-4 font-bold border-b">اسم الخدمة</th>
                            <th className="p-4 font-bold border-b">الوصف</th>
                            <th className="p-4 font-bold border-b">سعر البيع (ج.م)</th>
                            <th className="p-4 font-bold border-b">التكلفة (ج.م)</th>
                            <th className="p-4 font-bold border-b">الحالة</th>
                            <th className="p-4 font-bold border-b text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredServices.map(srv => (
                            <tr key={srv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                <td className="p-4 font-bold text-gray-800">{srv.name}</td>
                                <td className="p-4 text-gray-600">{srv.description || '-'}</td>
                                <td className="p-4 text-indigo-700 font-bold" dir="ltr">{Number(srv.default_price).toLocaleString()}</td>
                                <td className="p-4 text-red-600 font-bold" dir="ltr">{Number(srv.cost_price).toLocaleString()}</td>
                                <td className="p-4">
                                    {srv.status === 'active' ? (
                                        <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-lg w-fit text-xs font-bold"><CheckCircle size={14}/> نشط</span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg w-fit text-xs font-bold"><XCircle size={14}/> متوقف</span>
                                    )}
                                </td>
                                <td className="p-4 flex gap-2 justify-center">
                                    <button onClick={() => { setRevenueService(srv); setIsRevenueModalOpen(true); }} className="p-2 flex items-center justify-center bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors font-bold gap-1 px-3" title="تحصيل إيراد"><DollarSign size={18} /> <span className="text-xs">تحصيل إيراد</span></button>
                                    <button onClick={() => handleEdit(srv)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"><Edit size={18} /></button>
                                    {srv.status === 'active' && (
                                        <button onClick={() => handleDeactivate(srv.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"><Trash2 size={18} /></button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredServices.length === 0 && (
                            <tr><td colSpan="6" className="p-8 text-center text-gray-500 font-bold">لا توجد خدمات مسجلة</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <CollectServiceRevenueModal 
                isOpen={isRevenueModalOpen} 
                onClose={() => setIsRevenueModalOpen(false)} 
                service={revenueService} 
                onSuccess={() => {
                    alert('تم التحصيل وتسميع المبلغ في الخزنة والمبيعات بنجاح');
                }} 
            />

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">{editingService ? 'تعديل خدمة' : 'إضافة خدمة'}</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block mb-1 font-bold text-gray-700 text-sm">اسم الخدمة</label>
                                <input required type="text" className="w-full border p-2.5 rounded-lg focus:ring-2 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block mb-1 font-bold text-gray-700 text-sm">وصف الخدمة</label>
                                <input type="text" className="w-full border p-2.5 rounded-lg focus:ring-2 outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1 font-bold text-gray-700 text-sm">سعر البيع الافتراضي</label>
                                    <input required type="number" step="any" min="0" className="w-full border p-2.5 rounded-lg focus:ring-2 outline-none text-left" dir="ltr" value={formData.default_price} onChange={e => setFormData({...formData, default_price: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block mb-1 font-bold text-gray-700 text-sm">التكلفة (اختياري)</label>
                                    <input type="number" step="any" min="0" className="w-full border p-2.5 rounded-lg focus:ring-2 outline-none text-left" dir="ltr" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700">حفظ</button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 border-2 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-50">إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
