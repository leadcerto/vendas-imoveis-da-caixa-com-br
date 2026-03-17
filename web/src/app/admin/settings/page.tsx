"use client";

import React from 'react';
import AdminLayout from '../components/AdminLayout';

export default function SettingsPage() {
  return (
    <AdminLayout>
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Configurações</h1>
        <p className="text-gray-400">Gerenciamento de credenciais e parâmetros do sistema.</p>
      </div>
      
      <div className="p-12 rounded-3xl bg-white/5 border border-white/10 text-center">
        <p className="text-gray-500 italic">Módulo de configurações em desenvolvimento.</p>
      </div>
    </AdminLayout>
  );
}
