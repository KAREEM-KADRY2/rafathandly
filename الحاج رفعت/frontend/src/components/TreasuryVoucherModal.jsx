import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../api';

export default function TreasuryVoucherModal({ isOpen, type, editingVoucher, initialAccountId, onClose, onSuccess }) {
  const isReceipt = (editingVoucher ? editingVoucher.type === 'IN' : type === 'receipt');
  
  const [formData, setFormData] = useState({
    party_type: 'other',
    party_id: '',
    party_name: '',
    amount: '',
    account_id: initialAccountId || 1,
    payment_method: 'نقدي (كاش)',
    transaction_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
    description: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    api.get('/treasury/accounts').then(res => {
      setAccounts(res.data || []);
    }).catch(err => console.error('Error fetching accounts:', err));

    if (editingVoucher) {
      setFormData({
        party_type: editingVoucher.related_entity_type || 'other',
        party_id: editingVoucher.related_entity_id || '',
        party_name: editingVoucher.party_name || '',
        amount: editingVoucher.amount || '',
        account_id: editingVoucher.account_id || 1,
        payment_method: editingVoucher.payment_method || 'نقدي (كاش)',
        transaction_date: editingVoucher.date ? editingVoucher.date.substring(0, 10) : new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
        description: editingVoucher.description || ''
      });
    } else {
      setFormData({
        party_type: 'other',
        party_id: '',
        party_name: '',
        amount: '',
        account_id: initialAccountId || 1,
        payment_method: 'نقدي (كاش)',
        transaction_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }),
        description: ''
      });
    }
  }, [isOpen, editingVoucher]);
  
  // Fetch entities dynamically when party_type changes
  useEffect(() => {
    if (!isOpen) return;
    
    if (formData.party_type === 'other') {
      setEntities([]);
      return;
    }
    
    const fetchEntities = async () => {
      setFetching(true);
      try {
        let res;
        if (formData.party_type === 'customer') {
          res = await api.get('/customers?all=true');
          const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setEntities(data);
        } else if (formData.party_type === 'supplier') {
          res = await api.get('/suppliers?all=true');
          const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setEntities(data.filter(s => s.type !== 'مصنع'));
        } else if (formData.party_type === 'factory') {
          res = await api.get('/suppliers?all=true');
          const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setEntities(data.filter(s => s.type === 'مصنع'));
        } else if (formData.party_type === 'worker') {
          res = await api.get('/workers?all=true');
          const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
          setEntities(data);
        } else if (formData.party_type === 'partner') {
          res = await api.get('/partners?status=active');
          const data = res.data?.partners || (Array.isArray(res.data) ? res.data : []);
          setEntities(data);
        }
      } catch (err) {
        console.error('Error fetching entities:', err);
      } finally {
        setFetching(false);
      }
    };
    
    fetchEntities();
  }, [formData.party_type, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Find the entity name if an ID was selected
      let finalName = formData.party_name;
      if (formData.party_type !== 'other' && formData.party_id) {
        const selected = entities.find(ent => String(ent.id) === String(formData.party_id));
        if (selected) {
          finalName = selected.name;
        }
      }

      if (editingVoucher) {
        await api.put(`/treasury/voucher/${editingVoucher.id}`, { 
          ...formData, 
          party_name: finalName,
          type: editingVoucher.type || (isReceipt ? 'IN' : 'OUT')
        });
      } else {
        await api.post('/treasury/voucher', { 
          ...formData, 
          party_name: finalName,
          type 
        });
      }
      onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || 'حدث خطأ أثناء حفظ السند');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className={`p-4 ${isReceipt ? 'bg-green-600' : 'bg-red-600'} text-white flex justify-between items-center`}>
          <h2 className="text-xl font-bold">
            {editingVoucher 
              ? (isReceipt ? 'تعديل سند قبض' : 'تعديل سند صرف')
              : (isReceipt ? 'إنشاء سند قبض' : 'إنشاء سند صرف')}
          </h2>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                تاريخ السند
              </label>
              <input
                type="date"
                required
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                نوع الجهة المستفيدة
              </label>
              <select
                value={formData.party_type}
                onChange={(e) => setFormData({ ...formData, party_type: e.target.value, party_id: '', party_name: '' })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="customer">عميل</option>
                <option value="supplier">مورد</option>
                <option value="factory">مصنع</option>
                <option value="worker">موظف</option>
                <option value="partner">شريك</option>
                <option value="other">جهة أخرى</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.party_type === 'customer' ? 'اختر العميل' :
                 formData.party_type === 'supplier' ? 'اختر المورد' :
                 formData.party_type === 'factory' ? 'اختر المصنع' :
                 formData.party_type === 'worker' ? 'اختر الموظف' :
                 formData.party_type === 'partner' ? 'اختر الشريك' :
                 'اسم الجهة / الشخص'}
              </label>
              
              {formData.party_type === 'other' ? (
                <input
                  type="text"
                  required
                  placeholder="أدخل اسم الجهة..."
                  value={formData.party_name}
                  onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <select
                  required
                  value={formData.party_id}
                  onChange={(e) => setFormData({ ...formData, party_id: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={fetching}
                >
                  <option value="">
                    {fetching ? 'جاري التحميل...' : '--- اختر من القائمة ---'}
                  </option>
                  {entities.map(ent => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} {ent.phone ? `(${ent.phone})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الخزنة / الحساب المالي ({isReceipt ? 'الجهة التي ستستلم' : 'الجهة التي ستدفع'})
            </label>
            <select
              required
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: Number(e.target.value) })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-medium"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type === 'CASH' ? 'خزنة' : acc.type === 'BANK' ? 'بنك' : 'محفظة'}) - رصيد: {acc.balance?.toLocaleString()} ج.م
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                المبلغ (ج.م)
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-lg text-left"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                طريقة الدفع
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="نقدي (كاش)">نقدي (كاش)</option>
                <option value="تحويل بنكي">تحويل بنكي</option>
                <option value="محفظة إلكترونية">محفظة إلكترونية</option>
                <option value="شيك">شيك</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              البيان / ملاحظات
            </label>
            <textarea
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="اكتب تفاصيل السند هنا..."
            ></textarea>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 text-white py-2 px-4 rounded-lg font-bold ${
                isReceipt ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              } disabled:opacity-50`}
            >
              {loading ? 'جاري الحفظ...' : (editingVoucher ? 'حفظ التعديلات' : 'حفظ السند المالي')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-bold hover:bg-gray-200"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
