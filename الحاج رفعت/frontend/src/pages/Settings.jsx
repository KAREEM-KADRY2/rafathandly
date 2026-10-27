import React, { useState, useEffect, useRef } from 'react';
import { Building2, Printer, Package, UserCheck, HardDrive, Settings as SettingsIcon, Save, CheckCircle, AlertCircle, Upload, Key, Download, FileText, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import api from '../api';
import EditItemModal from '../components/EditItemModal';
import ChangeInventoryPasswordModal from '../components/ChangeInventoryPasswordModal';
import { useSettings } from '../context/SettingsContext';

export default function Settings() {
  const { fetchSettings: refreshGlobalSettings, updateSettingsState } = useSettings();
  const [activeTab, setActiveTab] = useState('company'); // company, invoice, products, account, backup
  const [isChangeInvPasswordModalOpen, setIsChangeInvPasswordModalOpen] = useState(false);
  const [settings, setSettings] = useState({
    company_name: '',
    company_tagline: '',
    company_phone1: '',
    company_phone2: '',
    company_address: '',
    company_tax_number: '',
    company_logo: '/logo.jpg',
    invoice_number_format: 'INV-{ID}',
    invoice_default_title: 'فاتورة مبيعات',
    invoice_show_logo: 'true',
    invoice_print_format: 'A4',
    system_currency: 'ج.م',
    system_date_format: 'YYYY-MM-DD',
    system_language: 'ar',
    system_direction: 'rtl'
  });

  const [userInfo, setUserInfo] = useState({
    name: 'المدير العام',
    username: 'admin',
    role: 'مدير النظام'
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const [backupInfo, setBackupInfo] = useState({
    available: true,
    status: '🟢 تعمل بشكل ممتاز (محمية ومحدثة)',
    last_backup: 'جاري التحميل...',
    file_name: '-',
    file_size: '-'
  });

  const [inventoryItems, setInventoryItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', text: '' }

  // Restore Modal State
  const [restoreFile, setRestoreFile] = useState(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsRes, userRes, backupRes, invRes] = await Promise.all([
        api.get('/settings'),
        api.get('/settings/user'),
        api.get('/settings/backup/info'),
        api.get('/inventory/items')
      ]);

      if (settingsRes.data) {
        setSettings(prev => ({ ...prev, ...settingsRes.data }));
      }
      if (userRes.data) {
        setUserInfo(userRes.data);
      }
      if (backupRes.data) {
        setBackupInfo(backupRes.data);
      }
      if (invRes.data) {
        setInventoryItems(invRes.data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key, val) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    updateSettingsState(updated);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/settings/company', {
        company_name: settings.company_name,
        company_tagline: settings.company_tagline,
        company_phone1: settings.company_phone1,
        company_phone1_label: settings.company_phone1_label,
        company_phone2: settings.company_phone2,
        company_phone2_label: settings.company_phone2_label,
        company_address: settings.company_address,
        company_tax_number: settings.company_tax_number,
        company_logo: settings.company_logo
      });
      updateSettingsState(settings);
      refreshGlobalSettings();
      showToast('تم حفظ بيانات الشركة بنجاح');
      fetchData();
    } catch (err) {
      showToast('حدث خطأ أثناء حفظ بيانات الشركة', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInvoiceSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', {
        invoice_number_format: settings.invoice_number_format,
        invoice_default_title: settings.invoice_default_title,
        invoice_show_logo: settings.invoice_show_logo,
        invoice_print_format: settings.invoice_print_format,
        system_currency: settings.system_currency
      });
      updateSettingsState(settings);
      refreshGlobalSettings();
      showToast('تم حفظ إعدادات الفواتير والطباعة بنجاح');
    } catch (err) {
      showToast('حدث خطأ أثناء حفظ إعدادات الفواتير', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.new_password || passwordForm.new_password.trim().length < 3) {
      showToast('يرجى كتابة كلمة المرور الجديدة (3 أحرف أو أرقام على الأقل)', 'error');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast('كلمتا المرور الجديدة وتأكيدها غير متطابقتين', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/settings/user/password', {
        new_password: passwordForm.new_password
      });
      showToast(res.data?.message || 'تم تعيين وتحديث كلمة المرور بنجاح');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      showToast(err.response?.data?.error || 'حدث خطأ أثناء حفظ كلمة المرور', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      showToast('جاري إنشاء وتحميل النسخة الاحتياطية المعتمدة (.db)...');
      window.open(`${api.defaults.baseURL}/settings/backup/download`, '_blank');
      setTimeout(() => {
        showToast('تم إنشاء النسخة الاحتياطية بنجاح');
        fetchData();
      }, 1500);
    } catch (err) {
      showToast('حدث خطأ أثناء إنشاء النسخة الاحتياطية', 'error');
    }
  };

  const handleDownloadReadableBackup = async () => {
    try {
      window.open(`${api.defaults.baseURL}/settings/backup/download-json`, '_blank');
      showToast('جاري تحميل ملف البيانات القابل للقراءة (.json)...');
    } catch (err) {
      showToast('حدث خطأ أثناء تحميل ملف البيانات', 'error');
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRestoreFile(file);
      setIsRestoreModalOpen(true);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreFile) return;

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('backup_file', restoreFile);

      const res = await api.post('/settings/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast(res.data?.message || 'تم إنشاء النسخة الوقائية واستعادة قاعدة البيانات بنجاح');
      setIsRestoreModalOpen(false);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchData();
      refreshGlobalSettings();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'ملف النسخة الاحتياطية غير صالح أو تالف، ولم يتم تغيير البيانات الحالية.';
      showToast(errorMsg, 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleCancelRestore = () => {
    setIsRestoreModalOpen(false);
    setRestoreFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      handleFieldChange('company_logo', reader.result);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return <div className="p-8 text-center font-bold text-lg">جاري تحميل إعدادات النظام...</div>;
  }

  const navTabs = [
    { id: 'company', label: 'بيانات الشركة', icon: <Building2 size={18} /> },
    { id: 'invoice', label: 'الفواتير والطباعة', icon: <Printer size={18} /> },
    { id: 'products', label: 'المنتجات والوحدات', icon: <Package size={18} /> },
    { id: 'account', label: 'الحساب والمستخدم', icon: <UserCheck size={18} /> },
    { id: 'backup', label: 'النسخ الاحتياطي والاستعادة', icon: <HardDrive size={18} /> }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-5 left-5 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 text-white font-bold text-base transition-all ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <AlertCircle size={22} /> : <CheckCircle size={22} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <SettingsIcon size={26} className="text-blue-600" />
            إعدادات النظام
          </h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">إدارة بيانات الشركة، الفواتير، الوحدات، والنسخ الاحتياطي والاستعادة</p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-100 flex flex-wrap gap-2 overflow-x-auto">
        {navTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* SECTION 1: COMPANY INFO */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-100 flex items-center gap-2">
            <Building2 className="text-blue-600" size={22} />
            بيانات الهوية والشركة
          </h2>

          <form onSubmit={handleSaveCompany} className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white flex items-center justify-center">
                <img src={settings.company_logo || '/logo.jpg'} alt="Logo" className="w-full h-full object-contain" onError={e => e.target.src = '/logo.jpg'} />
              </div>
              <div className="space-y-2 text-center sm:text-right">
                <label className="block text-sm font-bold text-gray-700">شعار الشركة (اللوجو)</label>
                <p className="text-xs text-gray-500">يتم استخدامه في الفواتير المطبوعة وفواتير الواتساب والتقارير</p>
                <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-2 shadow-sm transition-colors">
                  <Upload size={16} />
                  اختر صورة جديدة
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">اسم الشركة / المؤسسة</label>
                <input
                  required
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  value={settings.company_name}
                  onChange={e => handleFieldChange('company_name', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الوصف / التخصص</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  placeholder="مثال: مقاولات وتوريدات مواد البناء"
                  value={settings.company_tagline}
                  onChange={e => handleFieldChange('company_tagline', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">مسمى الهاتف الأول</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  placeholder="مثال: الإدارة"
                  value={settings.company_phone1_label || ''}
                  onChange={e => handleFieldChange('company_phone1_label', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف الأول</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  dir="ltr"
                  placeholder="01000000000"
                  value={settings.company_phone1 || ''}
                  onChange={e => handleFieldChange('company_phone1', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">مسمى الهاتف الثاني</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  placeholder="مثال: الحسابات"
                  value={settings.company_phone2_label || ''}
                  onChange={e => handleFieldChange('company_phone2_label', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف الثاني</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  dir="ltr"
                  placeholder="01000000000"
                  value={settings.company_phone2 || ''}
                  onChange={e => handleFieldChange('company_phone2', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">العنوان والفرع الرئيسي</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  value={settings.company_address}
                  onChange={e => handleFieldChange('company_address', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">الرقم الضريبي (إن وجد)</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  placeholder="مثال: 100-200-300"
                  value={settings.company_tax_number}
                  onChange={e => handleFieldChange('company_tax_number', e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-md disabled:opacity-50 transition-all"
              >
                <Save size={18} />
                {saving ? 'جاري الحفظ...' : 'حفظ بيانات الشركة'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 2: INVOICES & PRINTING */}
      {activeTab === 'invoice' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 pb-3 border-b border-gray-100 flex items-center gap-2">
            <Printer className="text-blue-600" size={22} />
            إعدادات الفواتير والتصميم المطبوع
          </h2>

          <form onSubmit={handleSaveInvoiceSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">صيغة رقم الفاتورة التلقائية</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  value={settings.invoice_number_format}
                  onChange={e => handleFieldChange('invoice_number_format', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">العنوان الافتراضي للفاتورة</label>
                <input
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  value={settings.invoice_default_title}
                  onChange={e => handleFieldChange('invoice_default_title', e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">مقاس الطباعة</label>
                <select
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800 bg-white"
                  value={settings.invoice_print_format}
                  onChange={e => handleFieldChange('invoice_print_format', e.target.value)}
                >
                  <option value="A4">A4 - ورقة كاملة قياسية</option>
                  <option value="A5">A5 - نصف ورقة</option>
                  <option value="Thermal">طابعة إيصالات حرارية (80mm)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">إظهار اللوجو على الفاتورة والـ PDF</label>
                <select
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800 bg-white"
                  value={settings.invoice_show_logo}
                  onChange={e => handleFieldChange('invoice_show_logo', e.target.value)}
                >
                  <option value="true">إظهار الشعار بوضوح</option>
                  <option value="false">إخفاء الشعار</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-md disabled:opacity-50 transition-all"
              >
                <Save size={18} />
                {saving ? 'جاري الحفظ...' : 'حفظ إعدادات الفواتير'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 3: PRODUCTS & UNITS */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Package className="text-blue-600" size={22} />
              تحويلات المنتجات والوحدات المعتمدة
            </h2>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed font-medium">
            تعرض هذه الشاشة قائمة جميع منتجات المخزن ومعاملات التحويل الخاصة بكل منتج (مثل: أسمنت 1 طن = 20 شكارة، جبس 1 طن = 33 شكارة). يمكنك تعديل معاملات التحويل مباشرة.
          </p>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                <tr>
                  <th className="p-4">اسم الصنف</th>
                  <th className="p-4">الوحدة الأساسية</th>
                  <th className="p-4">الوحدة الثانوية للبيع</th>
                  <th className="p-4">معامل التحويل (الطن كم شكارة)</th>
                  <th className="p-4">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map(item => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4 font-black text-gray-900">{item.name}</td>
                    <td className="p-4 font-bold text-gray-700">{item.unit || '-'}</td>
                    <td className="p-4 font-bold text-gray-700">{item.secondary_unit || '-'}</td>
                    <td className="p-4 font-bold">
                      {item.secondary_unit && item.conversion_factor ? (
                        <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs border border-emerald-200">
                          1 {item.unit} = {item.conversion_factor} {item.secondary_unit}
                        </span>
                      ) : (
                        <span className="text-gray-400">غير محدد</span>
                      )}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded-lg text-xs font-bold transition-all border border-blue-200"
                      >
                        تعديل التحويل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingItem && (
            <EditItemModal
              item={editingItem}
              onClose={() => setEditingItem(null)}
              onSuccess={() => {
                setEditingItem(null);
                fetchData();
              }}
            />
          )}
        </div>
      )}

      {/* SECTION 4: USER & ACCOUNT */}
      {activeTab === 'account' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-8">
          <h2 className="text-xl font-bold text-gray-800 pb-3 border-b border-gray-100 flex items-center gap-2">
            <UserCheck className="text-blue-600" size={22} />
            بيانات الحساب وتغيير كلمة المرور
          </h2>

          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-wrap gap-6 items-center justify-between">
            <div className="flex flex-wrap gap-6 items-center">
              <div>
                <p className="text-xs text-blue-700 font-bold">الاسم الحالي:</p>
                <p className="text-base font-black text-blue-900">{userInfo.name}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700 font-bold">اسم المستخدم:</p>
                <p className="text-base font-black text-blue-900">{userInfo.username}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700 font-bold">الصلاحية:</p>
                <p className="text-base font-black text-emerald-800">{userInfo.role || 'مدير النظام'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true);
                try {
                  const res = await api.put('/settings/user', {
                    name: userInfo.name,
                    username: userInfo.username
                  });
                  if (res.data?.user) setUserInfo(res.data.user);
                  showToast('تم تحديث بيانات الحساب بنجاح');
                } catch (err) {
                  showToast(err.response?.data?.error || 'حدث خطأ أثناء تحديث بيانات الحساب', 'error');
                } finally {
                  setSaving(false);
                }
              }}
              className="space-y-4 border-l-0 md:border-l border-gray-100 md:pl-8"
            >
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <UserCheck size={18} className="text-blue-600" />
                تعديل اسم الحساب والاسم المستعار
              </h3>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">اسم المسؤول / المدير</label>
                <input
                  required
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  value={userInfo.name}
                  onChange={e => setUserInfo({ ...userInfo, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">اسم المستخدم (Username)</label>
                <input
                  required
                  type="text"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold text-gray-800"
                  value={userInfo.username}
                  onChange={e => setUserInfo({ ...userInfo, username: e.target.value })}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md disabled:opacity-50 transition-all"
                >
                  <Save size={18} />
                  {saving ? 'جاري الحفظ...' : 'حفظ بيانات الحساب'}
                </button>
              </div>
            </form>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <Key size={18} className="text-blue-600" />
                تغيير كلمة المرور
              </h3>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور الجديدة</label>
                <input
                  required
                  type="password"
                  placeholder="أدخل كلمة المرور الجديدة"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold"
                  value={passwordForm.new_password}
                  onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">تأكيد كلمة المرور الجديدة</label>
                <input
                  required
                  type="password"
                  placeholder="أعيد كتابة كلمة المرور الجديدة"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-bold"
                  value={passwordForm.confirm_password}
                  onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md disabled:opacity-50 transition-all"
                >
                  <Save size={18} />
                  {saving ? 'جاري الحفظ...' : 'تحديث كلمة المرور'}
                </button>
              </div>
            </form>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center gap-2">
              <Key className="text-blue-600" size={18} />
              أمان وتصاريح المخزن
            </h3>
            
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-4 items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-800">كلمة مرور تسوية المخزن</p>
                <p className="text-xs text-gray-500 mt-0.5">تُستخدم لتأكيد إجراء عمليات تسوية الرصيد والجرد في المخزن</p>
                <p className="text-lg font-black text-gray-700 tracking-widest mt-1">••••••••</p>
              </div>
              <button
                type="button"
                onClick={() => setIsChangeInvPasswordModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm"
              >
                <Key size={18} />
                تغيير كلمة المرور
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <HardDrive className="text-blue-600" size={24} />
              النسخ الاحتياطي والاستعادة
            </h2>
            <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 flex items-center gap-1">
              <ShieldCheck size={14} /> نظام آمن ومستقل offline
            </span>
          </div>

          {/* 4 Primary System Info Elements & Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Element 1: Database Health Status */}
            <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1">
              <p className="text-xs font-bold text-emerald-800">حالة النسخة الاحتياطية</p>
              <p className="text-base font-black text-emerald-900 mt-1">
                {backupInfo?.status || '🟢 تعمل بشكل ممتاز'}
              </p>
              <p className="text-[11px] text-emerald-700 font-medium">حجم الحفظ الحقيقي: {backupInfo?.file_size || backupInfo?.db_size_mb || '-'}</p>
            </div>

            {/* Element 2: Last Successful Backup */}
            <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-1">
              <p className="text-xs font-bold text-blue-800">آخر نسخة احتياطية</p>
              <p className="text-sm font-black text-blue-900 mt-1 truncate" dir="ltr">
                {backupInfo?.last_backup || 'لم يتم إنشاء نسخة احتياطية بعد'}
              </p>
              <p className="text-[11px] text-blue-700 font-medium truncate" dir="ltr">
                {backupInfo?.file_name || '-'}
              </p>
            </div>

            {/* Element 3: Create Backup Button */}
            <div className="p-5 bg-white border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl space-y-3 flex flex-col justify-between transition-all shadow-sm">
              <div>
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                  <Download className="text-emerald-600" size={18} />
                  إنشاء نسخة احتياطية
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                  حفظ نسخة آمنة وشاملة (.db) يمكنك نقلها لفلاشة USB أو كمبيوتر آخر.
                </p>
              </div>
              <button
                onClick={handleCreateBackup}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Download size={16} />
                <span>إنشاء نسخة احتياطية</span>
              </button>
            </div>

            {/* Element 4: Restore Backup Button */}
            <div className="p-5 bg-white border-2 border-purple-200 hover:border-purple-400 rounded-2xl space-y-3 flex flex-col justify-between transition-all shadow-sm">
              <div>
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                  <Upload className="text-purple-600" size={18} />
                  استعادة نسخة احتياطية
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                  اختيار ملف نسخة احتياطية (.db) واسترجاع كافة البيانات بأمان.
                </p>
              </div>
              <label className="cursor-pointer w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all">
                <Upload size={16} />
                <span>استعادة نسخة احتياطية</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".db"
                  className="hidden"
                  onChange={handleFileSelected}
                />
              </label>
            </div>
          </div>

          {/* Offline Guide & Readable Data Export */}
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <FileText className="text-blue-600" size={20} />
                  تصدير نسخة بيانات نصية للعرض والطباعة (.json)
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                  ملف نصي شامل يمكنك فتحه على الموبايل أو الكمبيوتر لمراجعة البيانات وجداول المبيعات في أي وقت.
                </p>
              </div>
              <button
                onClick={handleDownloadReadableBackup}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-xs whitespace-nowrap"
              >
                <FileText size={16} />
                <span>تصدير ملف القراءة (.json)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION RESTORE MODAL */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-gray-100" dir="rtl">
            <div className="flex items-center gap-3 text-amber-600 pb-3 border-b border-gray-100">
              <AlertTriangle size={28} />
              <h3 className="text-xl font-black text-gray-900">استعادة نسخة احتياطية</h3>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
              <p className="text-sm font-bold text-amber-900 leading-relaxed">
                سيتم استبدال البيانات الحالية ببيانات النسخة الاحتياطية المحددة.
              </p>
              <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                سيتم إنشاء نسخة أمان من البيانات الحالية قبل الاستعادة.
              </p>
            </div>

            {restoreFile && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                <p className="font-bold text-gray-700">الملف المحدد للاستعادة:</p>
                <p className="font-black text-blue-900 text-sm break-all" dir="ltr">{restoreFile.name}</p>
                <div className="flex justify-between text-gray-500 pt-1 font-semibold">
                  <span>الحجم: {(restoreFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <span>التاريخ: {new Date(restoreFile.lastModified).toLocaleDateString('ar-EG')}</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelRestore}
                disabled={restoring}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-xl text-sm transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="flex-1 bg-purple-700 hover:bg-purple-800 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {restoring ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>جاري الاستعادة...</span>
                  </>
                ) : (
                  <span>متابعة الاستعادة</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ChangeInventoryPasswordModal
        isOpen={isChangeInvPasswordModalOpen}
        onClose={() => setIsChangeInvPasswordModalOpen(false)}
        onSuccess={(msg) => showToast(msg)}
      />
    </div>
  );
}
