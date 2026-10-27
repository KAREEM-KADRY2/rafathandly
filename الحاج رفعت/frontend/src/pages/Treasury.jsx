import React, { useState, useEffect } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import TreasuryVoucherModal from '../components/TreasuryVoucherModal';
import OpeningBalanceModal from '../components/OpeningBalanceModal';
import AccountDetailsModal from '../components/AccountDetailsModal';
import { Wallet, ArrowRightLeft, Plus, Download, Search, Trash2, FileDown, Edit, FolderOpen } from 'lucide-react';

const Treasury = () => {
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({ total_receipts: 0, total_payments: 0, balance: 0 });
    
    const [selectedAccountForDetails, setSelectedAccountForDetails] = useState(null);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [showEditAccount, setShowEditAccount] = useState(false);
    const [showVoucherModal, setShowVoucherModal] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [voucherType, setVoucherType] = useState('receipt');
    const [showTransfer, setShowTransfer] = useState(false);
    
    const [selectedAccountForOB, setSelectedAccountForOB] = useState(null);
    const [isOBModalOpen, setIsOBModalOpen] = useState(false);
    
    const [newAccount, setNewAccount] = useState({ name: '', type: 'CASH' });
    const [transfer, setTransfer] = useState({ from_account_id: '', to_account_id: '', amount: '', description: '' });

    const [filterAccount, setFilterAccount] = useState('');
    const [filterType, setFilterType] = useState('');

    useEffect(() => {
        fetchAccounts();
        fetchTransactions();
    }, []);

    const fetchAccounts = async () => {
        try {
            const { data } = await api.get('/treasury/accounts');
            setAccounts(Array.isArray(data) ? data : (data?.accounts || []));
        } catch (error) {
            console.error(error);
            setAccounts([]);
        }
    };

    const fetchTransactions = async () => {
        try {
            const { data } = await api.get('/treasury/transactions');
            setTransactions(Array.isArray(data?.transactions) ? data.transactions : (Array.isArray(data) ? data : []));
            setSummary(data?.summary || { total_receipts: 0, total_payments: 0, balance: 0 });
        } catch (error) {
            console.error(error);
            setTransactions([]);
            setSummary({ total_receipts: 0, total_payments: 0, balance: 0 });
        }
    };

    const handleEditVoucher = (voucher) => {
        setEditingVoucher(voucher);
        setVoucherType(voucher.type === 'IN' ? 'receipt' : 'payment');
        setShowVoucherModal(true);
    };

    const handleDeleteVoucher = async (voucher) => {
        if (window.confirm('هل أنت متأكد من حذف هذا السند وعكس كافة تأثيراته المالية وحساباته نهائياً؟')) {
            try {
                await api.delete(`/treasury/voucher/${voucher.id}`);
                fetchTransactions();
                fetchAccounts();
            } catch (error) {
                alert(error.response?.data?.error || 'حدث خطأ أثناء حذف السند');
            }
        }
    };

    const handleAddAccount = async (e) => {
        e.preventDefault();
        try {
            await api.post('/treasury/accounts', newAccount);
            setShowAddAccount(false);
            setNewAccount({ name: '', type: 'CASH' });
            fetchAccounts();
        } catch (error) {
            alert(error.response?.data?.error || 'حدث خطأ');
        }
    };

    const handleUpdateAccount = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/treasury/accounts/${editingAccount.id}`, {
                name: editingAccount.name,
                type: editingAccount.type
            });
            setShowEditAccount(false);
            setEditingAccount(null);
            fetchAccounts();
        } catch (error) {
            alert(error.response?.data?.error || 'حدث خطأ أثناء تعديل الحساب');
        }
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        try {
            await api.post('/treasury/transfer', transfer);
            setShowTransfer(false);
            setTransfer({ from_account_id: '', to_account_id: '', amount: '', description: '' });
            fetchAccounts();
            fetchTransactions();
        } catch (error) {
            alert(error.response?.data?.error || 'حدث خطأ');
        }
    };

    const handleDeleteAccount = async (id) => {
        if (!window.confirm('هل أنت تأكد من رغبتك في حذف هذا الحساب المالي؟')) return;
        try {
            await api.delete(`/treasury/accounts/${id}`);
            fetchAccounts();
        } catch (error) {
            alert(error.response?.data?.error || 'حدث خطأ أثناء حذف الحساب');
        }
    };

    const safeAccounts = Array.isArray(accounts) ? accounts : [];
    const totalMoney = safeAccounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);

    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const filteredTransactions = safeTransactions.filter(t => {
        if (filterAccount && String(t.account_id) !== String(filterAccount)) return false;
        if (filterType && t.type !== filterType) return false;
        return true;
    });

    return (
        <div className="p-6 bg-gray-50 min-h-screen" dir="rtl">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">إدارة الخزنة والحسابات المالية</h1>
                <div className="flex gap-2">
                    <button onClick={() => { setEditingVoucher(null); setVoucherType('receipt'); setShowVoucherModal(true); }} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700">سند قبض</button>
                    <button onClick={() => { setEditingVoucher(null); setVoucherType('payment'); setShowVoucherModal(true); }} className="bg-red-600 text-white px-4 py-2 rounded shadow hover:bg-red-700">سند صرف</button>
                    <button onClick={() => setShowAddAccount(true)} className="bg-blue-600 text-white px-4 py-2 rounded shadow flex items-center gap-2 hover:bg-blue-700">
                        <Plus size={18} /> إضافة حساب
                    </button>
                    <button onClick={() => setShowTransfer(true)} className="bg-gray-600 text-white px-4 py-2 rounded shadow flex items-center gap-2 hover:bg-gray-700">
                        <ArrowRightLeft size={18} /> تحويل بين الحسابات
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-600 text-white rounded-lg shadow p-6 flex flex-col justify-center items-center">
                    <Wallet size={32} className="mb-2" />
                    <h3 className="text-lg font-semibold mb-1">إجمالي السيولة النقدية</h3>
                    <p className="text-2xl font-bold" dir="ltr">{totalMoney.toLocaleString()} ج.م</p>
                </div>
                
                {safeAccounts.map(acc => (
                    <div 
                        key={acc.id} 
                        onClick={() => setSelectedAccountForDetails(acc)}
                        className="bg-white rounded-xl shadow p-5 flex flex-col items-center border-2 border-transparent hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer relative group"
                    >
                        <div className="flex justify-between w-full items-start mb-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingAccount(acc); setShowEditAccount(true); }}
                                className="text-amber-600 hover:text-amber-800 p-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                                title="تعديل الحساب"
                            >
                                <Edit size={16} />
                            </button>
                            <h3 className="text-lg font-black text-gray-800 text-center flex-1">{acc.name}</h3>
                            {acc.id !== 1 ? (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc.id); }} 
                                    className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" 
                                    title="حذف الحساب"
                                >
                                    <Trash2 size={16} />
                                </button>
                            ) : (
                                <div className="w-6"></div>
                            )}
                        </div>
                        <span className="text-xs font-bold text-gray-500 mb-2 bg-gray-100 px-2.5 py-0.5 rounded-full">{acc.type}</span>
                        <p className={`text-2xl font-black mb-3 ${Number(acc.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                            {Number(acc.balance || 0).toLocaleString()} <span className="text-xs font-normal">ج.م</span>
                        </p>
                        
                        <div className="w-full space-y-2 mt-auto pt-2 border-t border-gray-100">
                            <button
                                onClick={(e) => { e.stopPropagation(); setSelectedAccountForDetails(acc); }}
                                className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg font-black flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                                title="فتح الخزنة وعرض كشف الحساب والتحويلات"
                            >
                                <FolderOpen size={15} />
                                <span>فتح الخزنة والتحويلات</span>
                            </button>

                            <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedAccountForOB(acc); setIsOBModalOpen(true); }}
                                className="w-full text-[11px] bg-slate-800 text-white py-1.5 px-2 rounded-lg hover:bg-slate-900 font-bold flex items-center justify-center gap-1 transition-colors"
                                title="إدخال / تعديل الرصيد الافتتاحي لهذا الحساب المالي"
                            >
                                <FileDown size={13} />
                                <span>رصيد افتتاحي</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b flex gap-4 bg-gray-50">
                    <select className="border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" value={filterAccount} onChange={e => setFilterAccount(e.target.value)}>
                        <option value="">كل الحسابات</option>
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                    <select className="border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="">كل الحركات</option>
                        <option value="IN">وارد</option>
                        <option value="OUT">صادر</option>
                        <option value="TRANSFER">تحويل</option>
                    </select>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead className="bg-gray-100 border-b">
                            <tr>
                                <th className="p-3">م</th>
                                <th className="p-3">التاريخ</th>
                                <th className="p-3">الحساب</th>
                                <th className="p-3">النوع</th>
                                <th className="p-3">المبلغ</th>
                                <th className="p-3">البيان</th>
                                <th className="p-3">المستخدم</th>
                                <th className="p-3 text-center">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map((t, i) => (
                                <tr key={t.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3">{i + 1}</td>
                                    <td className="p-3">{new Date(t.date).toLocaleString('ar-EG')}</td>
                                    <td className="p-3 font-semibold">{t.account_name}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-sm ${t.type === 'IN' ? 'bg-green-100 text-green-800' : (t.type === 'OUT' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800')}`}>
                                            {t.type === 'IN' ? 'وارد' : (t.type === 'OUT' ? 'صادر' : 'تحويل')}
                                        </span>
                                    </td>
                                    <td className={`p-3 font-bold ${t.type === 'IN' ? 'text-green-600' : 'text-red-600'}`} dir="ltr">
                                        {(Number(t.amount) || 0).toLocaleString()}
                                    </td>
                                    <td className="p-3">
                                        {t.related_entity_type === 'OPENING_BALANCE' || (t.description && t.description.includes('رصيد افتتاحي')) 
                                            ? 'رصيد الدفتر' 
                                            : t.description}
                                    </td>
                                    <td className="p-3">{t.user}</td>
                                    <td className="p-3 text-center">
                                        {t.related_entity_type !== 'transfer_in' && t.related_entity_type !== 'transfer_out' && t.related_entity_type !== 'OPENING_BALANCE' ? (
                                            <div className="flex justify-center items-center gap-1.5">
                                                <button
                                                    onClick={() => handleEditVoucher(t)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs bg-blue-50 border border-blue-200"
                                                    title="تعديل السند"
                                                >
                                                    <Edit size={14} />
                                                    <span>تعديل</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteVoucher(t)}
                                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 font-bold text-xs bg-red-50 border border-red-200"
                                                    title="حذف السند"
                                                >
                                                    <Trash2 size={14} />
                                                    <span>حذف</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="p-4 text-center text-gray-500">لا توجد حركات مطابقة للبحث</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {showVoucherModal && (
                <TreasuryVoucherModal 
                    isOpen={showVoucherModal} 
                    type={voucherType}
                    editingVoucher={editingVoucher}
                    onClose={() => { setShowVoucherModal(false); setEditingVoucher(null); }} 
                    onSuccess={() => { setShowVoucherModal(false); setEditingVoucher(null); fetchTransactions(); fetchAccounts(); }} 
                />
            )}

            {showAddAccount && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">إضافة حساب مالي جديد</h2>
                        <form onSubmit={handleAddAccount}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">اسم الحساب</label>
                                <input required className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">نوع الحساب</label>
                                <select className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500" value={newAccount.type} onChange={e => setNewAccount({...newAccount, type: e.target.value})}>
                                    <option value="CASH">نقدي</option>
                                    <option value="BANK">بنكي</option>
                                    <option value="EWALLET">محفظة إلكترونية</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setShowAddAccount(false)} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">إلغاء</button>
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">حفظ</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditAccount && editingAccount && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">تعديل بيانات الحساب</h2>
                        <form onSubmit={handleUpdateAccount}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-bold">اسم الحساب</label>
                                <input 
                                    required 
                                    className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
                                    value={editingAccount.name} 
                                    onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} 
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-bold">نوع الحساب</label>
                                <select 
                                    className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500 font-bold" 
                                    value={editingAccount.type} 
                                    onChange={e => setEditingAccount({...editingAccount, type: e.target.value})}
                                >
                                    <option value="CASH">نقدي</option>
                                    <option value="BANK">بنكي</option>
                                    <option value="EWALLET">محفظة إلكترونية</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => { setShowEditAccount(false); setEditingAccount(null); }} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">إلغاء</button>
                                <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 font-bold">حفظ التعديلات</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showTransfer && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                        <h2 className="text-xl font-bold mb-4">تحويل رصيد</h2>
                        <form onSubmit={handleTransfer}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">من حساب</label>
                                <select required className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500" value={transfer.from_account_id} onChange={e => setTransfer({...transfer, from_account_id: e.target.value})}>
                                    <option value="">اختر الحساب</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">إلى حساب</label>
                                <select required className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500" value={transfer.to_account_id} onChange={e => setTransfer({...transfer, to_account_id: e.target.value})}>
                                    <option value="">اختر الحساب</option>
                                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">المبلغ</label>
                                <input required type="number" min="1" className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500" value={transfer.amount} onChange={e => setTransfer({...transfer, amount: e.target.value})} />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2">البيان (اختياري)</label>
                                <input className="w-full border rounded p-2 outline-none focus:ring-2 focus:ring-blue-500" value={transfer.description} onChange={e => setTransfer({...transfer, description: e.target.value})} />
                            </div>
                            <div className="flex justify-end gap-2 mt-6">
                                <button type="button" onClick={() => setShowTransfer(false)} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">إلغاء</button>
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">تحويل</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isOBModalOpen && selectedAccountForOB && (
                <OpeningBalanceModal
                    isOpen={isOBModalOpen}
                    onClose={() => { setIsOBModalOpen(false); setSelectedAccountForOB(null); }}
                    entityType="treasury"
                    entityId={selectedAccountForOB.id}
                    entityName={selectedAccountForOB.name}
                    onSuccess={() => {
                        fetchAccounts();
                        fetchTransactions();
                    }}
                />
            )}

            {selectedAccountForDetails && (
                <AccountDetailsModal
                    isOpen={!!selectedAccountForDetails}
                    accountId={selectedAccountForDetails.id}
                    onClose={() => setSelectedAccountForDetails(null)}
                    onRefreshAccounts={() => {
                        fetchAccounts();
                        fetchTransactions();
                    }}
                />
            )}
        </div>
    );
};

export default Treasury;
