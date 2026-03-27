import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Invoices } from './pages/Invoices';
import { Inventory } from './pages/Inventory';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { Help } from './pages/Help';
import { PublicPayment } from './pages/PublicPayment';
import { RequireAuth } from './components/RequireAuth';
import { getToken } from './api/client';

function RootRedirect() {
  return <Navigate to={getToken() ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/invoices"
          element={
            <RequireAuth>
              <Invoices />
            </RequireAuth>
          }
        />
        <Route
          path="/inventory"
          element={
            <RequireAuth>
              <Inventory />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth>
              <Reports />
            </RequireAuth>
          }
        />
        <Route
          path="/help"
          element={
            <RequireAuth>
              <Help />
            </RequireAuth>
          }
        />
        <Route path="/pay/:invoiceId" element={<PublicPayment />} />
        <Route path="/" element={<RootRedirect />} />
      </Routes>
    </Router>
  );
}
