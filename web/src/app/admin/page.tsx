"use client";

import React, { useEffect, useState } from 'react';
import AdminLayout from './components/AdminLayout';
import CSVUpload from './components/CSVUpload';
import { supabase } from '@/lib/supabase';
import { 
  IoStatsChartOutline, 
  IoDocumentTextOutline, 
  IoLayersOutline, 
  IoTrendingUpOutline,
  IoChevronForwardOutline
} from 'react-icons/io5';

interface Stats {
  totalProperties: number;
  lastUpdate: string | null;
  activeReports: number;
}

export default function AdminDashboard() {
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
        // 1. Total de imóveis
        const { count, error: countError } = await supabase
          .from('imoveis_caixa')
          .select('*', { count: 'exact', head: true });
        
        // 2. Última atualização (usando executado_em da tabela logs_ingestao)
        const { data: lastLog, error: logError } = await supabase
          .from('logs_ingestao')
          .select('executado_em')
          .order('executado_em', { ascending: false })
          .limit(1);

        // 3. Relatórios recentes (usando data_criacao da tabela relatorios_estoque)
        const { data: reports, error: reportError } = await supabase
          .from('relatorios_estoque')
          .select('*')
          .order('data_criacao', { ascending: false })
          .limit(5);

        setStats({
          totalProperties: count || 0,
          lastUpdate: lastLog?.[0]?.executado_em || 'Nunca',
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
    <AdminLayout>
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Visão Geral</h1>
        <p className="text-gray-400">Gerenciamento de dados e relatórios de estoque.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <IoLayersOutline size={20} />
            </div>
            <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-full">+12%</span>
          </div>
          <p className="text-sm text-gray-400 mb-1">Total de Imóveis</p>
          <h3 className="text-3xl font-bold">{loading ? '...' : stats.totalProperties.toLocaleString('pt-BR')}</h3>
        </div>

        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <IoStatsChartOutline size={20} />
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Relatórios Ativos</p>
          <h3 className="text-3xl font-bold">{loading ? '...' : stats.activeReports}</h3>
        </div>

        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
              <IoTrendingUpOutline size={20} />
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Última Atualização</p>
          <h3 className="text-lg font-bold truncate">
            {loading ? '...' : stats.lastUpdate && stats.lastUpdate !== 'Nunca' 
              ? new Date(stats.lastUpdate).toLocaleDateString('pt-BR') 
              : 'Nenhuma'}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <section>
          <CSVUpload />
        </section>

        {/* Reports List */}
        <section className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                <IoDocumentTextOutline size={24} />
              </div>
              <h2 className="text-xl font-bold">Relatórios Recentes</h2>
            </div>
            <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">Ver todos</button>
          </div>

          <div className="space-y-4">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 animate-pulse rounded-2xl" />)
            ) : recentReports.length > 0 ? (
              recentReports.map((report) => (
                <div key={report.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-gray-400">
                      <IoDocumentTextOutline size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{new Date(report.data_criacao).toLocaleDateString('pt-BR')}</p>
                      <p className="text-xs text-gray-500">{report.total_imoveis} imóveis processados</p>
                    </div>
                  </div>
                  <IoChevronForwardOutline className="text-gray-600 group-hover:text-white transition-colors" />
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 italic">
                Nenhum relatório gerado ainda.
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
