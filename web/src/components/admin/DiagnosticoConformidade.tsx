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
  aprovadosLista: ItemAmostra[]; // Adicionado para persistência e refresh
  rejeitadosFiltros: {
    total: number;
    modalidade: number;
    desconto: number;
    modalidadesEncontradas?: Record<string, number>;
    amostra: ItemAmostra[]
  };
  gestao?: {
    valorTotalEstoque: number;
    countAtivos: number;
    countVendidos: number;
    distribuicaoGrupos: { nome: string; count: number }[];
    vendasRecentes: {
      dias30: number;
      dias60: number;
      dias90: number;
    };
    breakdownPorUF: {
      uf: string;
      valorTotalEstoque: number;
      countAtivos: number;
      countVendidos: number;
      distribuicaoGrupos: { nome: string; count: number }[];
      vendasRecentes: {
        dias30: number;
        dias60: number;
        dias90: number;
      };
    }[];
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

function formatETC(seconds: number) {
  if (seconds <= 0 || !isFinite(seconds)) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `~${h}h ${m}min`;
  if (m > 0) return `~${m}min`;
  return '< 1min';
}

function PassoCard({
  passo,
  isIngesting,
  currentStep,
  history
}: {
  passo: PassoResult;
  isIngesting: boolean;
  currentStep: number;
  history?: { t: number, c: number }[]
}) {
  let status: 'ok' | 'parcial' | 'critico' | 'pending' = passo.status;

  if (isIngesting) {
    if (passo.passo < currentStep) status = 'ok';
    else if (passo.passo === currentStep) status = 'parcial';
    else status = 'pending';
  }

  const isOk = status === 'ok';
  const isParcial = status === 'parcial' || (passo.percentual > 0 && passo.percentual < 100);
  const isPending = !isOk && !isParcial;

  const bg = isOk ? 'border-green-200 bg-green-50/40' : isParcial ? 'border-blue-200 bg-blue-50/40' : 'border-red-200 bg-red-50/40 opacity-60';
  const textColor = isOk ? 'text-green-700' : isParcial ? 'text-blue-700' : 'text-red-700';
  const Icon = isOk ? IoCheckmarkCircleOutline : isParcial ? IoRefreshOutline : IoAlertCircleOutline;

  // Cálculo de ETC baseado no histórico
  let etcLabel = null;
  if (isParcial && history && history.length >= 2) {
    const start = history[0];
    const end = history[history.length - 1];
    const dt = (end.t - start.t) / 1000; // segundos
    const dc = end.c - start.c;
    if (dc > 0 && dt > 0) {
      const rate = dc / dt; // itens por segundo
      const remaining = passo.total - passo.finalizado;
      etcLabel = formatETC(remaining / rate);
    }
  }

  return (
    <div className={`rounded-2xl border p-5 transition-all hover:shadow-md ${bg} ${isParcial && !isIngesting ? 'ring-1 ring-blue-100' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOk ? 'bg-green-100' : isParcial ? 'bg-blue-100' : 'bg-red-100'}`}>
          <Icon size={22} className={textColor + (isParcial ? ' animate-spin' : '')} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className={`text-[11px] font-black uppercase tracking-widest ${textColor}`}>
              Passo {passo.passo} — {passo.nome}
            </p>
            <span className={`text-xs font-black ${textColor} shrink-0`}>
              {passo.percentual}%
            </span>
          </div>

          <div className="h-1.5 rounded-full bg-white/60 border border-white/80 overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isOk ? 'bg-green-500' : isParcial ? 'bg-blue-500' : 'bg-red-500'}`}
              style={{ width: `${passo.percentual}%` }}
            />
          </div>

          <div className="flex justify-between items-end">
            <p className="text-[10px] text-gray-500 font-semibold leading-tight">
              {isOk ? 'Concluído' : isParcial ? `${passo.finalizado.toLocaleString('pt-BR')} de ${passo.total.toLocaleString('pt-BR')} itens` : 'Aguardando...'}
            </p>
            {etcLabel && (
              <div className="text-right">
                <p className="text-[8px] text-blue-400 font-black uppercase tracking-widest">Tempo Estimado</p>
                <p className="text-[10px] text-blue-600 font-black">{etcLabel}</p>
              </div>
            )}
          </div>
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
  const [activeTab, setActiveTab] = useState<'geral' | 'novos' | 'conforme' | 'fora' | 'config'>('geral');
  const [expandedPasso, setExpandedPasso] = useState<number | null>(null);
  const [filtroUF, setFiltroUF] = useState<string>('all');
  const [status, setStatus] = useState<'idle' | 'carregando' | 'erro'>('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const [progresso, setProgresso] = useState('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionLog, setIngestionLog] = useState<string[]>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [refreshHistory, setRefreshHistory] = useState<Record<number, { t: number, c: number }[]>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Carregar automaticamente do banco de dados ao montar
  React.useEffect(() => {
    const carregarDoBanco = async () => {
      setStatus('carregando');
      setProgresso('Carregando diagnóstico do banco de dados...');
      try {
        const res = await fetch('/api/diagnostico-imoveis');
        const json = await res.json();
        if (!res.ok || json.semDados) {
          setStatus('idle');
          return;
        }
        setResultado(json as DiagnosticoResult);
        setLastUpdateTime(new Date().toLocaleTimeString());
        setStatus('idle');
      } catch (e) {
        console.error('Erro ao carregar diagnóstico automático:', e);
        setStatus('idle');
      }
    };
    carregarDoBanco();
  }, []);

  // 2. (Removido) Persistência no LocalStorage descontinuada — dados carregados direto do banco

  // 3. Lógica de Refresh (JSON)
  const handleRefresh = async (isAuto = false) => {
    if (!resultado || !resultado.aprovadosLista) return;

    if (!isAuto) setStatus('carregando');
    setProgresso('Atualizando status do banco (Sincronismo)...');

    try {
      const res = await fetch('/api/diagnostico-imoveis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultado),
      });

      const json = await res.json() as DiagnosticoResult;
      if (!res.ok) throw new Error((json as any).erro || 'Erro no refresh.');

      // Atualizar Histórico de Velocidade
      const now = Date.now();
      setRefreshHistory(prev => {
        const next = { ...prev };
        json.passos.forEach(p => {
          const h = next[p.passo] || [];
          const newH = [...h, { t: now, c: p.finalizado }].slice(-20); // Manter as últimas 20 amostras
          next[p.passo] = newH;
        });
        return next;
      });

      setResultado(json);
      setLastUpdateTime(new Date().toLocaleTimeString());
      setStatus('idle');
    } catch (err: any) {
      if (!isAuto) {
        setMensagemErro(err.message);
        setStatus('erro');
      }
    }
  };

  // 4. Temporizador de Auto-Refresh
  React.useEffect(() => {
    if (autoRefresh && resultado) {
      refreshTimerRef.current = setInterval(() => {
        handleRefresh(true);
      }, 30000); // 30 segundos
    } else {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    }
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  }, [autoRefresh, resultado]);

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
      setLastUpdateTime(new Date().toLocaleTimeString());
      setStatus('idle');
    } catch (err: any) {
      setMensagemErro(err.message);
      setStatus('erro');
    }

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
          return newLog.slice(-100);
        });

        setTimeout(() => {
          logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err: any) {
      setIngestionLog(prev => [...prev, `❌ ERRO: ${err.message}`]);
    } finally {
      setIsIngesting(false);
      setIngestionLog(prev => [...prev, '✨ BINGO! Processo concluído com sucesso.', '--- FINALIZADO ---']);
      handleRefresh(true); // Atualiza após ingestão
    }
  };

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
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[#003870] uppercase tracking-tighter">
            Diagnóstico de Conformidade
          </h2>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
            {resultado ? 'Modo Monitoramento Ativo' : 'Carregue o Excel da CAIXA para verificar os 7 passos'}
          </p>
        </div>
        {resultado && (
          <div className="text-right">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sincronizado às</p>
            <p className="text-sm font-black text-[#003870]">{lastUpdateTime}</p>
          </div>
        )}
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
          {/* Controles de Monitoramento */}
          <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-3xl gap-4">
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Analisando Cache de</p>
              <p className="font-black text-[#003870] uppercase tracking-tighter text-sm truncate max-w-[250px]">{resultado.arquivo}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {/* Toggle Auto-Refresh */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${autoRefresh ? 'translate-x-5' : ''}`}></div>
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Auto-Refresh</span>
              </label>

              <button
                onClick={() => handleRefresh(false)}
                disabled={status === 'carregando'}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#005CA9] bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 disabled:opacity-50"
              >
                <IoRefreshOutline size={14} className={status === 'carregando' ? 'animate-spin' : ''} /> Atualizar Agora
              </button>

              <button
                onClick={() => {
                  if (confirm('Isso limpará o cache local. Deseja continuar?')) {
                    setResultado(null);
                    setStatus('idle');
                    setLastFile(null);
                    setIngestionLog([]);
                    setAutoRefresh(false);
                    localStorage.removeItem('caixa_ultimo_diagnostico');
                  }
                }}
                className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-500"
              >
                Limpar Cache
              </button>

              {!isIngesting && lastFile && (
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {resultado.passos.map(p => (
                <PassoCard
                  key={p.passo}
                  passo={p}
                  isIngesting={isIngesting || isFinished}
                  currentStep={isFinished ? 8 : currentStep}
                  history={refreshHistory[p.passo]}
                />
              ))}
            </div>
          </div>

          {/* Seções expansíveis */}
          <div className="space-y-3">
            <SecaoAmostra
              titulo="Com Divergências de Valores"
              total={resultado.divergentes?.total || 0}
              color="border-amber-200 bg-amber-50/30 text-amber-700"
              icon={IoWarningOutline}
              itens={resultado.divergentes?.amostra || []}
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

            <SecaoAmostra
              titulo="Fora de Venda (Sumiram da Lista)"
              total={resultado.foraDeVenda.total}
              color="border-gray-200 bg-gray-50/50 text-gray-700"
              icon={IoInformationCircleOutline}
              itens={resultado.foraDeVenda.amostra}
              renderItem={(item, i) => (
                <div key={i} className="text-xs p-3 bg-white rounded-xl border border-gray-100 flex justify-between gap-2">
                  <span className="font-black text-[#003870]">#{item.numero}</span>
                  <span className="text-gray-500">{item.cidade}/{item.uf}</span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Pendente Remoção</span>
                </div>
              )}
            >
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-[10px] text-blue-700 font-bold">
                ℹ️ Estes imóveis estão no seu banco de dados mas NÃO constam nesta nova lista da CAIXA.
                Se eles permanecerem ausentes por mais de 120 dias, o sistema os removerá automaticamente.
              </div>
            </SecaoAmostra>
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
            </div>
          )}
        </div>
      )}
      {/* Rodapé de Versão */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">
          Monitoramento de Conformidade v2.6.2-STABLE · 2026-04-04
        </p>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest text-right">
            {autoRefresh ? 'Auto-Refresh Ativo (30s)' : 'Sincronismo Manual'}
          </span>
        </div>
      </div>
    </Card>
  );
}
