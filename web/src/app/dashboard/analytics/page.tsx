"use client";

import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  IoStatsChartOutline, IoLogoWhatsapp, IoMailOutline, IoEyeOutline,
  IoTrendingUpOutline, IoArrowBackOutline
} from 'react-icons/io5';
import Link from 'next/link';

const COLORS = ['#005CA9', '#F9B200', '#25D366', '#FF9D2E', '#9333ea'];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/dados')
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005CA9]"></div>
      </div>
    );
  }

  const convRate = data?.summary?.views > 0 
    ? ((data.summary.whatsapp / data.summary.views) * 100).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-gray-50 p-8 md:p-12 pb-20">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-[#005CA9] transition-colors text-[10px] font-black uppercase tracking-widest mb-4">
              <IoArrowBackOutline /> Voltar ao Dashboard
            </Link>
            <h1 className="text-4xl font-black text-[#003870] tracking-tighter uppercase font-montserrat">
              Relatórios & <span className="text-[#005CA9]">Performance</span>
            </h1>
            <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em]">Passo 7 — Business Intelligence do Portfólio</p>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
             <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500">
               <IoTrendingUpOutline size={20} />
             </div>
             <div>
               <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Conversão Geral</p>
               <p className="text-lg font-black text-gray-800">{convRate}% <span className="text-xs text-gray-400 font-normal">Whats / Views</span></p>
             </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4 group hover:border-[#005CA9]/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#005CA9]">
              <IoEyeOutline size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Visualizações Totais</p>
              <h3 className="text-4xl font-black text-[#003870] tracking-tighter">{data?.summary?.views?.toLocaleString('pt-BR')}</h3>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4 group hover:border-green-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-500">
              <IoLogoWhatsapp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Contatos WhatsApp</p>
              <h3 className="text-4xl font-black text-[#003870] tracking-tighter">{data?.summary?.whatsapp?.toLocaleString('pt-BR')}</h3>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-4 group hover:border-orange-500/30 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500">
              <IoMailOutline size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Leads Qualificados</p>
              <h3 className="text-4xl font-black text-[#003870] tracking-tighter">{data?.summary?.leads?.toLocaleString('pt-BR')}</h3>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Top Products (Views) */}
          <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#003870] uppercase tracking-tight">🏆 Imóveis Mais Populares</h3>
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Baseado em Views</span>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.topProperties || []} layout="vertical" margin={{ left: 40, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="titulo" 
                    type="category" 
                    width={150} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#6b7280' }}
                    tickFormatter={(val) => val.length > 20 ? `${val.substring(0, 20)}...` : val}
                  />
                  <Tooltip 
                     cursor={{ fill: '#f9fafb' }}
                     contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="views_count" fill="#005CA9" radius={[0, 10, 10, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* WhatsApp Interest (Pie Chart) */}
          <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-[#003870] uppercase tracking-tight">📱 Cliques em WhatsApp</h3>
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Conversões p/ Imóvel</span>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.topWhatsapp || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="whatsapp_count"
                    nameKey="titulo"
                  >
                    {(data?.topWhatsapp || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Real-time Insights */}
        <div className="bg-[#003870] p-12 rounded-[50px] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-full bg-[#005CA9] skew-x-12 translate-x-32 opacity-20"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
            <div className="w-24 h-24 rounded-[32px] bg-white/10 flex items-center justify-center text-white backdrop-blur-xl">
              <IoStatsChartOutline size={48} />
            </div>
            <div className="space-y-4">
              <h3 className="text-3xl font-black text-white uppercase tracking-tight font-montserrat">Maximize seus Resultados</h3>
              <p className="text-blue-100 font-bold max-w-xl">
                O rastreamento visual do **Microsoft Clarity** está ativo. 
                Acesse o portal do Clarity para ver gravações reais de tela e descobrir exatamente por que os usuários desistem de clicar no WhatsApp em certos imóveis.
              </p>
              <button className="px-8 py-3 bg-white text-[#003870] rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all">
                Acessar Portal Clarity
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
