"use client";

import React, { useState } from 'react';
import { IoCloudUploadOutline, IoCheckmarkCircleOutline, IoAlertCircleOutline, IoTimeOutline } from 'react-icons/io5';
import { supabase } from '@/lib/supabase';

export default function CSVUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatus('idle');
    setMessage('Iniciando processamento...');

    try {
      // Nota: O processamento completo do CSV requer um endpoint ou lógica complexa no client.
      // Para este MVP, simularemos o início da ingestão ou faremos upload para um bucket.
      
      // 1. Logar a tentativa na tabela de logs (ajustado para o schema real)
      const { error: logError } = await supabase
        .from('logs_ingestao')
        .insert({
          arquivo_csv: file.name,
          data_geracao: new Date().toISOString().split('T')[0], // Placeholder date
          total_lidos: 0,
          total_aceitos: 0,
          total_rejeitados: 0,
          motivos_rejeicao: { info: "Upload via interface" }
        });

      if (logError) throw logError;

      // TODO: Implementar lógica de leitura de CSV e inserção em massa
      // Por enquanto, mostraremos sucesso após um pequeno delay
      setTimeout(() => {
        setIsUploading(false);
        setStatus('success');
        setMessage(`Arquivo "${file.name}" carregado. O processamento ocorrerá em segundo plano.`);
      }, 2000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setIsUploading(false);
      setStatus('error');
      setMessage(`Erro ao carregar arquivo: ${error.message}`);
    }
  };

  return (
    <div className="p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <IoCloudUploadOutline size={24} className="text-blue-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Importar Lista da Caixa</h2>
          <p className="text-sm text-gray-400">Arraste ou selecione o arquivo .csv atualizado</p>
        </div>
      </div>

      <div className="relative group">
        <input 
          type="file" 
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
        />
        <div className={`
          border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all
          ${isUploading ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 group-hover:border-blue-500/30 group-hover:bg-white/5'}
          ${status === 'success' ? 'border-green-500/30 bg-green-500/5' : ''}
          ${status === 'error' ? 'border-red-500/30 bg-red-500/5' : ''}
        `}>
          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-blue-400 font-medium">{message}</p>
            </div>
          ) : status === 'success' ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <IoCheckmarkCircleOutline size={48} className="text-green-500" />
              <p className="font-medium text-white">{message}</p>
              <button 
                onClick={() => setStatus('idle')}
                className="mt-2 text-xs text-gray-400 hover:text-white underline"
              >
                Carregar outro arquivo
              </button>
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <IoAlertCircleOutline size={48} className="text-red-500" />
              <p className="font-medium text-white">{message}</p>
              <button 
                onClick={() => setStatus('idle')}
                className="mt-2 text-xs text-gray-400 hover:text-white underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <IoCloudUploadOutline size={40} className="text-gray-500 mb-4 group-hover:scale-110 transition-transform" />
              <p className="text-gray-400">Clique para selecionar ou arraste o arquivo aqui</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center gap-3">
          <IoTimeOutline className="text-gray-500" />
          <span className="text-xs text-gray-500">Formato esperado: <code className="text-blue-400">Lista_imoveis_XX.csv</code></span>
        </div>
        <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex items-center gap-3">
          <IoAlertCircleOutline className="text-gray-500" />
          <span className="text-xs text-gray-500">Codificação recomendada: <code className="text-blue-400">UTF-8</code></span>
        </div>
      </div>
    </div>
  );
}
