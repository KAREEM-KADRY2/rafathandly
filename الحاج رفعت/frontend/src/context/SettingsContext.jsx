import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    company_name: '',
    company_tagline: '',
    company_phone1: '',
    company_phone1_label: '',
    company_phone2: '',
    company_phone2_label: '',
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
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data && Object.keys(res.data).length > 0) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error('Error fetching global settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings.company_name) {
      document.title = `نظام إدارة ${settings.company_name}`;
    }
  }, [settings.company_name]);

  const updateSettingsState = (newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, fetchSettings, updateSettingsState, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext;
