"use client";

import React from 'react';
import AdminLayout from '../components/AdminLayout';

export default function ReportsPage() {
  return (
    <AdminLayout>
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Relatórios de Estoque</h1>
        <p className="text-gray-400">Histórico completo de snapshots e análises de mercado.</p>
      </div>
      
      <div className="p-12 rounded-3xl bg-white/5 border border-white/10 text-center">
        <p className="text-gray-500 italic">Módulo de listagem detalhada de relatórios em desenvolvimento.</p>
      </div>
    </AdminLayout>
  );
}
