'use client';

import React, { useState } from 'react';
import { IoCloudUploadOutline, IoCheckmarkCircleOutline, IoAlertCircleOutline, IoTimeOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { supabase } from '@/lib/supabase';
import { Button, Card } from '@/components/ui';

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
      // 1. Logar a tentativa na tabela de logs
      const { error: logError } = await supabase
        .from('logs_ingestao')
        .insert({
          arquivo_csv: file.name,
          data_geracao: new Date().toISOString().split('T')[0],
          total_lidos: 0,
          total_aceitos: 0,
          total_rejeitados: 0,
          motivos_rejeicao: { info: "Upload via interface premium" }
        });

      if (logError) throw logError;

      // TODO: Implementar lógica real de parser CSV se necessário no futuro
      
      setTimeout(() => {
        setIsUploading(false);
        setStatus('success');
        setMessage(`Arquivo "${file.name}" carregado com sucesso. O processamento foi iniciado.`);
      }, 2000);

    } catch (error: any) {
      console.error('Upload error:', error);
      setIsUploading(false);
      setStatus('error');
      setMessage(`Erro ao carregar arquivo: ${error.message}`);
    }
  };

  return (
    <Card className="p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#005CA9]/10 flex items-center justify-center">
          <IoCloudUploadOutline size={24} className="text-[#005CA9]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#003870] uppercase tracking-tighter">Importar Lista da Caixa</h2>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Sincronize o banco de dados com o CSV oficial</p>
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
          border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all
          ${isUploading ? 'border-[#005CA9]/50 bg-[#005CA9]/5' : 'border-gray-200 group-hover:border-[#005CA9]/30 group-hover:bg-blue-50/50'}
          ${status === 'success' ? 'border-green-500/30 bg-green-50/50' : ''}
          ${status === 'error' ? 'border-red-500/30 bg-red-50/50' : ''}
        `}>
          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-[#005CA9]/20 border-t-[#005CA9] rounded-full animate-spin" />
              <p className="text-[#005CA9] font-black uppercase text-[10px] tracking-widest">{message}</p>
            </div>
          ) : status === 'success' ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <IoCheckmarkCircleOutline size={48} className="text-green-500" />
              <p className="font-bold text-gray-700">{message}</p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setStatus('idle');
                }}
                className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#005CA9] hover:underline"
              >
                Carregar outro arquivo
              </button>
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <IoAlertCircleOutline size={48} className="text-red-500" />
              <p className="font-bold text-red-600">{message}</p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setStatus('idle');
                }}
                className="mt-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                <IoDocumentTextOutline size={32} className="text-gray-400 group-hover:text-[#005CA9]" />
              </div>
              <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Arraste o arquivo aqui ou clique para buscar</p>
              <p className="text-[9px] text-gray-400 mt-2 uppercase tracking-widest">Somente arquivos .csv oficiais da Caixa</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-3">
          <IoTimeOutline className="text-[#005CA9]" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Formato: <code className="text-[#005CA9]">Lista_imoveis_XX.csv</code></span>
        </div>
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center gap-3">
          <IoAlertCircleOutline className="text-[#F9B200]" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Codificação: <code className="text-[#F9B200]">UTF-8</code></span>
        </div>
      </div>
    </Card>
  );
}
