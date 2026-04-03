import React from 'react';
import nextDynamic from 'next/dynamic';
import AdminPageLayout from '@/components/layout/AdminPageLayout';

// Forçar que esta rota seja dinâmica para evitar erros de prerenderização com cookies/headers no middleware
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Importar o conteúdo do dashboard apenas no cliente para evitar erros de "Dynamic server usage"
const DashboardClient = nextDynamic(() => import('./DashboardClient'), { ssr: false });

export default function DashboardPage() {
  return (
    <AdminPageLayout 
      title="Visão Geral" 
      subtitle="Gerenciamento de dados e relatórios de estoque"
      showLogout={true}
    >
      <DashboardClient />
    </AdminPageLayout>
  );
}
