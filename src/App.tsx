import React, { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { CustomerPortal } from './components/CustomerPortal';
import { PublicEntryPage } from './components/PublicEntryPage';
import { fetchPublicConfig } from './utils/apiClient';

type RouteView =
  | { type: 'PUBLIC'; notFoundCode?: string }
  | { type: 'CUSTOMER'; kodeUnik: string }
  | { type: 'ADMIN' };

function parseLocationRoute(): RouteView {
  const pathname = window.location.pathname || '/';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return { type: 'ADMIN' };
  }
  const match = pathname.match(/^\/c\/([^/]+)/i);
  if (match && match[1]) {
    return { type: 'CUSTOMER', kodeUnik: decodeURIComponent(match[1]).trim().toUpperCase() };
  }
  return { type: 'PUBLIC' };
}

export default function App() {
  const [route, setRoute] = useState<RouteView>(() => parseLocationRoute());
  const [studioBranding, setStudioBranding] = useState<{
    nama_studio: string;
    logo_url: string;
  }>({
    nama_studio: 'LOUIS BRIDES',
    logo_url: '',
  });

  const navigateTo = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setRoute(parseLocationRoute());
  }, []);

  useEffect(() => {
    const handlePop = () => {
      setRoute(parseLocationRoute());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    fetchPublicConfig()
      .then((res) => {
        setStudioBranding({
          nama_studio: res.studio.nama_studio || 'LOUIS BRIDES',
          logo_url: res.studio.logo_url || '',
        });
      })
      .catch(() => {});
  }, []);

  if (route.type === 'ADMIN') {
    return (
      <AdminDashboard
        onLogout={() => {
          navigateTo('/');
        }}
      />
    );
  }

  if (route.type === 'CUSTOMER') {
    return (
      <CustomerPortal
        kodeUnik={route.kodeUnik}
        onNotFound={(code) => {
          window.history.replaceState({}, '', `/c/${encodeURIComponent(code)}`);
          setRoute({ type: 'PUBLIC', notFoundCode: code });
        }}
      />
    );
  }

  return (
    <PublicEntryPage
      studioName={studioBranding.nama_studio}
      logoUrl={studioBranding.logo_url}
      notFoundCode={route.notFoundCode}
      onOpenCustomerCode={(code) => navigateTo(`/c/${encodeURIComponent(code)}`)}
      onOpenAdminLogin={() => navigateTo('/admin')}
    />
  );
}
