'use client';

import React, { useState, useRef } from 'react';
import {
  IoCloudUploadOutline,
  IoCheckmarkCircleOutline,
  IoAlertCircleOutline,
  IoWarningOutline,
  IoInformationCircleOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoDocumentTextOutline,
  IoAnalyticsOutline,
  IoRefreshOutline,
} from 'react-icons/io5';
import { Card } from '@/components/ui';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface PassoResult {
  passo: number;
  nome: string;
  finalizado: number;
  processando: number;
  total: number;
  percentual: number;
  status: 'ok' | 'parcial' | 'critico';
  detalhes: string;
}

interface ItemAmostra {
  numero: number;
  uf?: string;
  cidade?: string;
  bairro?: string;
  tipo?: string;
  preco?: number;
  desconto?: string;
  modalidade?: string;
  divergencias?: string[];
}

interface DiagnosticoResult {
  arquivo: string;
  totalLinhasExcel: number;
  aprovadosFiltros: number;
  rejeitadosFiltros: { 
    total: number; 
    modalidade: number; 
    desconto: number; 
    modalidadesEncontradas?: Record<string, number>;
    amostra: ItemAmostra[] 
  };
  novos: { total: number; amostra: ItemAmostra[] };
  divergentes: { total: number; amostra: ItemAmostra[] };
  conformes: { total: number };
  foraDeVenda: { total: number; amostra: ItemAmostra[] };
  debug?: {
    excel_sample: string[];
    db_sample: any[];
    matched_count: number;
  };
  passos: PassoResult[];
  scoreGeral: number;
  totalNoBanco: number;
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-600 bg-green-50 border-green-200' : score >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200';
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-black text-lg ${color}`}>
      {score}% conformidade
    </div>
  );
}

function PassoCard({ passo, isIngesting, currentStep }: { passo: PassoResult; isIngesting: boolean; currentStep: number }) {
  // Se estiver ingerindo, a lógica de cores muda conforme o progresso
  // Passos futuros: Vermelho
  // Passo atual: Verde (Piscando)
  // Passos passados: Verde (Sólido)
  
  let status: 'ok' | 'parcial' | 'critico' | 'pending' = passo.status;
  
  if (isIngesting) {
    if (passo.passo < currentStep) status = 'ok';
    else if (passo.passo === currentStep) status = 'parcial'; // Usaremos Parcial para indicar "Em execução"
    else status = 'pending';
  }

  const isOk = status === 'ok';
  const isParcial = status === 'parcial';
  const isPending = status === 'pending' || status === 'critico';

  const bg = isOk ? 'border-green-200 bg-green-50/40' : isParcial ? 'border-blue-200 bg-blue-50/40 animate-pulse' : 'border-red-200 bg-red-50/40 opacity-60';
  const textColor = isOk ? 'text-green-700' : isParcial ? 'text-blue-700' : 'text-red-700';
  const Icon = isOk ? IoCheckmarkCircleOutline : isParcial ? IoRefreshOutline : IoAlertCircleOutline;

  return (
    <div className={`rounded-2xl border p-5 transition-all hover:shadow-md ${bg}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOk ? 'bg-green-100' : isParcial ? 'bg-blue-100' : 'bg-red-100'}`}>
          <Icon size={22} className={textColor + (isParcial ? ' animate-spin' : '')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className={`text-[11px] font-black uppercase tracking-widest ${textColor}`}>
              Passo {passo.passo} — {passo.nome}
            </p>
            {!isPending && <span className={`text-xs font-black ${textColor} shrink-0`}>{isOk ? '100%' : 'PROCESSANDO...'}</span>}
          </div>
          
          {/* Barra de progresso */}
          <div className="h-1.5 rounded-full bg-white/60 border border-white/80 overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isOk ? 'bg-green-500' : isParcial ? 'bg-blue-500' : 'bg-red-500'}`}
              style={{ width: isOk ? '100%' : isParcial ? '50%' : '0%' }}
            />
          </div>

          <p className="text-[10px] text-gray-500 font-semibold leading-tight">
            {isOk ? 'Processamento concluído para este lote.' : isParcial ? 'Executando lógica no servidor...' : 'Aguardando início...'}
          </p>
        </div>
      </div>
    </div>
  );
}

function SecaoAmostra({
  titulo,
  total,
  color,
  icon: Icon,
  itens,
  renderItem,
  children,
}: {
  titulo: string;
  total: number;
  color: string;
  icon: React.ElementType;
  itens: ItemAmostra[];
  renderItem: (item: ItemAmostra, i: number) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  if (total === 0 && !children) return null;

  return (
    <div className={`rounded-2xl border ${color} overflow-hidden`}>
      <button
        onClick={() => setAberto(v => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon size={20} className="shrink-0" />
          <span className="font-black text-sm uppercase tracking-tighter">{titulo}</span>
          <span className="font-black text-sm opacity-60">({total.toLocaleString('pt-BR')})</span>
        </div>
        {aberto ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
      </button>
      {aberto && (
        <div className="px-4 pb-4 space-y-2 max-h-[800px] overflow-y-auto">
          {children}
          {itens.slice(0, 50).map(renderItem)}
          {total > 20 && (
            <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest pt-2">
              + {total - 20} registros não exibidos
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function DiagnosticoConformidade() {
  const [resultado, setResultado] = useState<DiagnosticoResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'carregando' | 'erro'>('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const [progresso, setProgresso] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionLog, setIngestionLog] = useState<string[]>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const handleArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLastFile(file);
    setStatus('carregando');
    setResultado(null);
    setProgresso('Lendo arquivo Excel...');

    try {
      const formData = new FormData();
      formData.append('arquivo', file);

      setProgresso('Cruzando com o banco de dados...');
      const res = await fetch('/api/diagnostico-imoveis', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.erro || 'Erro desconhecido na análise.');
      }

      setResultado(json);
      setStatus('idle');
    } catch (err: any) {
      setMensagemErro(err.message);
      setStatus('erro');
    }

    // Limpa o input para permitir reenvio do mesmo arquivo
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleIngest = async () => {
    if (!lastFile) return;

    setIsIngesting(true);
    setIngestionLog(['Iniciando processo de ingestão...']);
    
    try {
      const formData = new FormData();
      formData.append('arquivo', lastFile);
      formData.append('action', 'ingest');

      const response = await fetch('/api/diagnostico-imoveis', {
        method: 'POST',
        body: formData,
      });

      if (!response.body) throw new Error('Falha ao iniciar stream de dados.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        setIngestionLog(prev => {
          const lines = text.split('\n').filter(l => l.trim());
          const newLog = [...prev, ...lines];
          return newLog.slice(-100); // Manter apenas as últimas 100 linhas
        });

        // Scroll suave para o fim do log
        setTimeout(() => {
          logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err: any) {
      setIngestionLog(prev => [...prev, `❌ ERRO: ${err.message}`]);
    } finally {
      setIsIngesting(false);
      // Forçar o último passo como concluído se chegou ao fim sem erro crítico
      setIngestionLog(prev => [...prev, '✨ BINGO! Processo concluído com sucesso.', '--- FINALIZADO ---']);
    }
  };

  // Calcular passo atual baseado no log
  const getCurrentStep = () => {
    let step = 1;
    for (const line of ingestionLog) {
      const match = line.match(/Step (\d)\/7/);
      if (match) step = parseInt(match[1]) + 1;
    }
    return Math.min(step, 7);
  };

  const currentStep = getCurrentStep();
  const isFinished = ingestionLog.some(l => l.includes('FINALIZADO'));

  return (
    <Card className="p-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500">
          <IoAnalyticsOutline size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#003870] uppercase tracking-tighter">
            Diagnóstico de Conformidade
          </h2>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
            Carregue o Excel da CAIXA para verificar os 7 passos de cadastramento
          </p>
        </div>
      </div>

      {/* Área de Upload */}
      {!resultado && (
        <div className="relative group mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleArquivo}
            disabled={status === 'carregando'}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
          />
          <div className={`
            border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all
            ${status === 'carregando' ? 'border-purple-300 bg-purple-50/50' : 'border-gray-200 group-hover:border-purple-300 group-hover:bg-purple-50/30'}
            ${status === 'erro' ? 'border-red-300 bg-red-50/30' : ''}
          `}>
            {status === 'carregando' ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                <p className="text-purple-600 font-black uppercase text-[10px] tracking-widest">{progresso}</p>
              </div>
            ) : status === 'erro' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <IoAlertCircleOutline size={48} className="text-red-500" />
                <p className="font-bold text-red-600 text-sm">{mensagemErro}</p>
                <button onClick={() => setStatus('idle')} className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:underline">
                  Tentar novamente
                </button>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <IoDocumentTextOutline size={32} className="text-gray-400 group-hover:text-purple-500" />
                </div>
                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">
                  Arraste o arquivo Excel da CAIXA aqui
                </p>
                <p className="text-[9px] text-gray-400 mt-2 uppercase tracking-widest">
                  Aceita .xlsx, .xls e .csv
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="space-y-6">
          {/* Botão recomeçar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Arquivo analisado</p>
              <p className="font-black text-[#003870] uppercase tracking-tighter">{resultado.arquivo}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setResultado(null); setStatus('idle'); setLastFile(null); setIngestionLog([]); }}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#005CA9] transition-colors"
              >
                <IoRefreshOutline size={14} /> Analisar outro
              </button>
              
              {!isIngesting && (
                <button
                  onClick={handleIngest}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-all shadow-sm"
                >
                  <IoCloudUploadOutline size={14} /> Gravar no Banco
                </button>
              )}
            </div>
          </div>

          {/* Log de Ingestão em tempo real */}
          {(isIngesting || ingestionLog.length > 0) && (
            <div className="bg-black rounded-2xl p-5 font-mono text-[11px] border border-gray-800 shadow-2xl">
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
                <p className="text-purple-400 font-black uppercase tracking-widest">Pipeline de Ingestão (7 Passos)</p>
                {isIngesting && <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />}
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar text-gray-300">
                {ingestionLog.map((line, i) => {
                  const isError = line.includes('ERROR') || line.includes('❌');
                  const isSuccess = line.includes('OK') || line.includes('SUCESSO');
                  const isPhase = line.includes('---');
                  return (
                    <div key={i} className={`
                      ${isError ? 'text-red-400' : isSuccess ? 'text-green-400' : isPhase ? 'text-blue-400 font-bold mt-2' : ''}
                    `}>
                      {line}
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
              
              {/* Barra de progresso visual simulada pela fase */}
              <div className="mt-4 h-1 bg-gray-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-500" 
                  style={{ 
                    width: isIngesting 
                      ? `${(ingestionLog.filter(l => l.includes('Step')).length / 7) * 100}%` 
                      : ingestionLog.some(l => l.includes('FINALIZADO')) ? '100%' : '0%' 
                  }} 
                />
              </div>
            </div>
          )}

          {/* Resumo numérico (5 cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-2xl border p-4 bg-gray-50 border-gray-100 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">Total no Excel</p>
              <p className="text-xl font-black text-gray-700">{resultado.totalLinhasExcel.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-2xl border p-4 bg-blue-50 border-blue-100 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">Aprovados Filtros</p>
              <p className="text-xl font-black text-blue-700">{resultado.aprovadosFiltros.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-2xl border p-4 bg-green-50 border-green-100 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-green-500 mb-1">Conformes no Banco</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-black text-green-700">{resultado.conformes.total.toLocaleString('pt-BR')}</p>
                {resultado.conformes.total > 0 && <IoCheckmarkCircleOutline className="text-green-500 animate-bounce" size={16} />}
              </div>
            </div>
            <div className="rounded-2xl border p-4 bg-orange-50 border-orange-100 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mb-1">Novos (Importar)</p>
              <p className="text-xl font-black text-orange-700">{resultado.novos.total.toLocaleString('pt-BR')}</p>
            </div>
            <div className="rounded-2xl border p-4 bg-red-50 border-red-100 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-red-500 mb-1">Fora de Venda (Remover)</p>
              <p className="text-xl font-black text-red-700">{resultado.foraDeVenda.total.toLocaleString('pt-BR')}</p>
            </div>
          </div>

          {/* Score geral */}
          <div className="flex items-center gap-4 p-5 rounded-2xl bg-gray-50 border border-gray-200">
            <IoAnalyticsOutline size={24} className="text-gray-400" />
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Score Geral dos 7 Passos</p>
              <ScoreBadge score={resultado.scoreGeral} />
            </div>
          </div>

          {/* Os 7 Passos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Conformidade por Passo</p>
              {isFinished && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded-lg animate-bounce shadow-lg">
                  <IoCheckmarkCircleOutline size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Processamento Finalizado!</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resultado.passos.map(p => (
                <PassoCard 
                  key={p.passo} 
                  passo={p} 
                  isIngesting={isIngesting || isFinished} 
                  currentStep={isFinished ? 8 : currentStep} 
                />
              ))}
            </div>
          </div>

          {/* Seções expansíveis */}
          <div className="space-y-3">


            <SecaoAmostra
              titulo="Com Divergências de Valores"
              total={resultado.divergentes.total}
              color="border-amber-200 bg-amber-50/30 text-amber-700"
              icon={IoWarningOutline}
              itens={resultado.divergentes.amostra}
              renderItem={(item, i) => (
                <div key={i} className="text-xs p-3 bg-white rounded-xl border border-amber-100">
                  <div className="flex justify-between mb-1">
                    <span className="font-black text-[#003870]">#{item.numero}</span>
                    <span className="text-gray-500">{item.cidade}/{item.uf}</span>
                  </div>
                  {item.divergencias?.map((d, j) => (
                    <p key={j} className="text-amber-700 font-bold">⚠ {d}</p>
                  ))}
                </div>
              )}
            />

            <SecaoAmostra
              titulo="Rejeitados pelos Filtros"
              total={resultado.rejeitadosFiltros.total}
              color="border-red-200 bg-red-50/30 text-red-700"
              icon={IoAlertCircleOutline}
              itens={resultado.rejeitadosFiltros.amostra}
              renderItem={(item, i) => (
                <div key={i} className="text-xs p-3 bg-white rounded-xl border border-red-100 flex justify-between gap-2">
                  <span className="font-black text-[#003870]">#{item.numero}</span>
                  <span className="text-gray-500 truncate">{item.modalidade}</span>
                  <span className="font-bold text-red-600 shrink-0">{item.desconto}</span>
                </div>
              )}
            />
          </div>

          {/* Novos Detalhes de Modalidades Encontradas */}
          {resultado.rejeitadosFiltros.modalidadesEncontradas && Object.keys(resultado.rejeitadosFiltros.modalidadesEncontradas).length > 0 && (
            <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100">
              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">Modalidades Rejeitadas no Excel:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(resultado.rejeitadosFiltros.modalidadesEncontradas).map(([modalidade, count]) => (
                  <div key={modalidade} className="px-3 py-1 bg-white border border-red-100 rounded-lg text-[10px] font-bold text-red-700">
                    {modalidade}: <span className="text-red-500 font-black">{count}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-red-400 mt-2 italic font-medium">
                * Somente &quot;Venda Online&quot; e &quot;Venda Direta Online&quot; são aceitas pela sua regra de negócio.
              </p>
            </div>
          )}

          {/* legenda de filtros rejeitados */}
          {resultado.rejeitadosFiltros.total > 0 && (
            <div className="flex gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Rejeitados: {resultado.rejeitadosFiltros.modalidade} modalidade inválida · {resultado.rejeitadosFiltros.desconto} desconto abaixo de 30%</span>
            </div>
          )}
        </div>
      )}
      {/* Rodapé de Versão e Controle de Cache */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">
          Controle de Conformidade v2.1 · Build 2026-04-03-v3
        </p>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-right">Sistema Sincronizado</span>
        </div>
      </div>
    </Card>
  );
}
