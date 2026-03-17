"use client";

import React from 'react';
import AdminLayout from '../components/AdminLayout';
import CSVUpload from '../components/CSVUpload';

export default function ImportPage() {
  return (
    <AdminLayout>
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Importar Dados</h1>
        <p className="text-gray-400">Carregue arquivos CSV da Caixa para atualizar o banco de dados.</p>
      </div>
      
      <div className="max-w-3xl">
        <CSVUpload />
      </div>
    </AdminLayout>
  );
}
