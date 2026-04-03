'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import nextDynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AdminPageLayout from '@/components/layout/AdminPageLayout';

// Usar dynamic import com ssr: false para ignorar renderização no servidor (que quebra o build do next)
const ImobiliariaManager = nextDynamic(() => import('@/components/admin/ImobiliariaManager'), { ssr: false });
const DiagnosticoConformidade = nextDynamic(() => import('@/components/admin/DiagnosticoConformidade'), { ssr: false });
import { 
  IoStatsChartOutline, 
  IoDocumentTextOutline, 
  IoLayersOutline, 
  IoTrendingUpOutline,
  IoChevronForwardOutline
} from 'react-icons/io5';
import { Card } from '@/components/ui';

interface Stats {
  totalProperties: number;
  lastUpdate: string | null;
  activeReports: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalProperties: 0,
    lastUpdate: null,
    activeReports: 0
  });
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1. Total de imóveis (usando a tabela correta 'imoveis')
        const { count, error: countError } = await supabase
          .from('imoveis')
          .select('*', { count: 'exact', head: true });
        
        // 2. Última atualização
        const { data: lastLog, error: logError } = await supabase
          .from('logs_ingestao')
          .select('data_lista')
          .not('data_lista', 'is', null)
          .order('executado_em', { ascending: false })
          .limit(1);

        // 3. Relatórios recentes (simulado ou da tabela relatorios_estoque se existir)
        const { data: reports } = await supabase
          .from('logs_ingestao')
          .select('*')
          .order('executado_em', { ascending: false })
          .limit(5);

        setStats({
          totalProperties: count || 0,
          lastUpdate: lastLog?.[0]?.data_lista || null,
          activeReports: reports?.length || 0
        });
        setRecentReports(reports || []);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <AdminPageLayout 
      title="Visão Geral" 
      subtitle="Gerenciamento de dados e relatórios de estoque"
      showLogout={true}
    >
      <div className="flex flex-col gap-10">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-8 group hover:border-[#005CA9]/30 transition-all">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#005CA9]/10 flex items-center justify-center text-[#005CA9]">
                <IoLayersOutline size={24} />
              </div>
              <span className="text-[10px] font-black text-green-600 bg-green-100 px-3 py-1 rounded-full uppercase tracking-widest">Ativo</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Total de Imóveis</p>
            <h3 className="text-4xl font-black text-[#003870] tracking-tighter">
              {loading ? '---' : stats.totalProperties.toLocaleString('pt-BR')}
            </h3>
          </Card>

          <Card className="p-8 group hover:border-[#F9B200]/30 transition-all">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#F9B200]/10 flex items-center justify-center text-[#F9B200]">
                <IoStatsChartOutline size={24} />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Processamentos</p>
            <h3 className="text-4xl font-black text-[#003870] tracking-tighter">
              {loading ? '---' : stats.activeReports}
            </h3>
          </Card>

          <Card className="p-8 group hover:border-[#005CA9]/30 transition-all">
            <div className="flex items-center justify-between mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-400">
                <IoTrendingUpOutline size={24} />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Ultima Sincronização</p>
            <h3 className="text-xl font-black text-[#003870] uppercase tracking-tighter truncate">
              {loading ? '---' : stats.lastUpdate 
                ? String(stats.lastUpdate).split('T')[0].split('-').reverse().join('/')
                : 'Nenhuma'}
            </h3>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Activity Section */}
          <div className="lg:col-span-2">
            <Card className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500">
                  <IoDocumentTextOutline size={24} />
                </div>
                <h2 className="text-xl font-bold text-[#003870] uppercase tracking-tighter">Atividade Recente</h2>
              </div>
              <button className="text-[10px] font-black uppercase tracking-widest text-[#005CA9] hover:underline transition-colors">Ver histórico</button>
            </div>

            <div className="space-y-4">
              {loading ? (
                [1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 animate-pulse rounded-2xl" />)
              ) : recentReports.length > 0 ? (
                recentReports.map((report) => (
                  <div key={report.id} className="p-5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-[#005CA9]/20 transition-all flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400">
                        <IoDocumentTextOutline size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-[#003870] uppercase tracking-tighter">
                          {report.arquivo_csv || 'Processamento'}
                        </p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
                          {report.data_lista ? (
                            (() => {
                              const [y, m, d] = String(report.data_lista).split('T')[0].split('-').slice(0, 3);
                              return `Lista: ${d}/${m}/${y} | `;
                            })()
                          ) : ''}
                          Executado: {report.executado_em ? (
                            (() => {
                              const [date, timePart] = String(report.executado_em).split('T');
                              const [y, m, d] = date.split('-');
                              const t = timePart ? timePart.split('.')[0].slice(0, 5) : '';
                              return `${d}/${m}/${y} ${t}`;
                            })()
                          ) : '---'}
                        </p>
                      </div>
                    </div>
                    <IoChevronForwardOutline className="text-gray-300 group-hover:text-[#005CA9] transition-colors" />
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-400 font-bold uppercase text-[10px] tracking-widest italic">
                  Nenhuma atividade registrada ainda.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Diagnóstico de Conformidade */}
        <section>
          <DiagnosticoConformidade />
        </section>

        {/* Imobiliarias Management Section */}
        <section className="mb-10">
          <ImobiliariaManager />
        </section>
      </div>
    </AdminPageLayout>
  );
}
