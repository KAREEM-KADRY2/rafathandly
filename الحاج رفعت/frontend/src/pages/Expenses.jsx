import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Expenses() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/expenses/workers');
  }, [navigate]);
  return null;
}
