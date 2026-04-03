import nextDynamic from 'next/dynamic';
import AdminPageLayout from '@/components/layout/AdminPageLayout';
import DashboardClient from './DashboardClient';

// Forçar que esta rota seja dinâmica para evitar erros de prerenderização com cookies/headers no middleware
export const dynamic = 'force-dynamic';
export const revalidate = 0;



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
