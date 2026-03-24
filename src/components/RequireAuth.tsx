import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../api/client';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
