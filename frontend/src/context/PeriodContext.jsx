import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const PeriodContext = createContext();

export function PeriodProvider({ children }) {
  const [periods, setPeriods] = useState([]);
  const [activePeriod, setActivePeriod] = useState(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState('all'); // 'all' or period_id
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await api.get('/periods');
      if (res.data) {
        const fetchedPeriods = res.data.periods || [];
        // Keep sorted chronologically by ID ascending
        const sortedPeriods = [...fetchedPeriods].sort((a, b) => a.id - b.id);
        setPeriods(sortedPeriods);
        const openPeriod = res.data.activePeriod || sortedPeriods.find(p => p.status === 'OPEN');
        setActivePeriod(openPeriod);
      }
    } catch (err) {
      console.error('Error fetching periods:', err);
    } finally {
      setLoading(false);
    }
  };

  const startNewPeriod = async (name, startDate, endDate, notes) => {
    const res = await api.post('/periods/start-new', { 
      name, 
      start_date: startDate, 
      end_date: endDate, 
      notes 
    });
    await fetchPeriods();
    if (res.data?.period) {
      setSelectedPeriodId(res.data.period.id.toString());
    }
    return res.data;
  };

  const closePeriod = async (id) => {
    const res = await api.post(`/periods/${id}/close`);
    await fetchPeriods();
    return res.data;
  };

  const reopenPeriod = async (id, password) => {
    const res = await api.post(`/periods/${id}/reopen`, { password });
    await fetchPeriods();
    setSelectedPeriodId(id.toString());
    return res.data;
  };

  const selectedPeriod = selectedPeriodId === 'all' 
    ? null 
    : periods.find(p => p.id.toString() === selectedPeriodId.toString());

  const isSelectedPeriodClosed = selectedPeriod ? selectedPeriod.status === 'CLOSED' : false;

  return (
    <PeriodContext.Provider value={{
      periods,
      activePeriod,
      selectedPeriodId,
      setSelectedPeriodId,
      selectedPeriod,
      isSelectedPeriodClosed,
      fetchPeriods,
      startNewPeriod,
      closePeriod,
      reopenPeriod,
      loading
    }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  return useContext(PeriodContext);
}
