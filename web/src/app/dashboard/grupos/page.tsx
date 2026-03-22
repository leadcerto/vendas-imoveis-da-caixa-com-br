"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  IoArrowBackOutline, 
  IoAddOutline, 
  IoSaveOutline,
  IoTrashOutline,
  IoExpandOutline,
  IoCloseOutline
} from 'react-icons/io5';
import Link from 'next/link';

interface GrupoImovel {
  id: number;
  nome: string;
  valor_minimo: number;
  valor_maximo: number;
  // Compra
  compra_financiamento_entrada_caixa: number;
  compra_financiamento_entrada_normal: number;
  compra_financiamento_prestacao: number;
  compra_registro: number;
  compra_despachante: number;
  compra_desocupacao: number;
  // Venda
  venda_reforma: number;
  venda_impostos: number;
  venda_tempo_meses: number;
  venda_despesas: number;
  venda_despesas_extras: number;
  venda_aceleracao: number;
  // ROI
  aluguel_roi_comum: number;
  aluguel_roi_caixa: number;
  // Honorarios
  honorario_leiloeiro: number;
  honorarios_corretagem: number;
  honorarios_corretagem_caixa: number;
}

export default function GruposManagementPage() {
  const [grupos, setGrupos] = useState<GrupoImovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoImovel | null>(null);

  useEffect(() => {
    fetchGrupos();
  }, []);

  async function fetchGrupos() {
    setLoading(true);
    const { data } = await supabase
      .from('grupos_imovel')
      .select('*')
      .order('id', { ascending: true });
    
    if (data) setGrupos(data);
    setLoading(false);
  }

  const handleInputChange = (id: number, field: keyof GrupoImovel, value: string | number) => {
    setGrupos(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    if (selectedGrupo && selectedGrupo.id === id) {
      setSelectedGrupo({ ...selectedGrupo, [field]: value });
    }
  };

  async function handleSaveRow(grupo: GrupoImovel, closeAfter = false) {
    const { error } = await supabase
      .from('grupos_imovel')
      .update(grupo)
      .eq('id', grupo.id);
    
    if (error) {
       alert('Erro ao salvar: ' + error.message);
    } else {
       if (!closeAfter) alert('✅ Sucesso! Grupo ' + grupo.nome + ' atualizado.');
       if (closeAfter) setSelectedGrupo(null);
    }
  }

  async function handleSaveAll() {
    if (!confirm('Deseja salvar as alterações de TODOS os grupos?')) return;
    setSavingAll(true);
    
    // In a real production app, we might want a single RPC or a more optimized batch update,
    // but for this small table, Promise.all with individual updates is safe and reliable.
    const promises = grupos.map(grupo => 
      supabase.from('grupos_imovel').update(grupo).eq('id', grupo.id)
    );
    
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    
    if (errors.length > 0) {
      alert(`Ocorreram erros ao salvar alguns grupos. Verifique a conexão.`);
    } else {
      alert(`✅ Sucesso! Todos os ${grupos.length} grupos foram atualizados com sucesso.`);
    }
    setSavingAll(false);
  }

  async function handleAddNew() {
    const newGrupo = {
      nome: 'Novo Grupo',
      valor_minimo: 0,
      valor_maximo: 0,
      compra_financiamento_entrada_caixa: 0.05,
      compra_financiamento_entrada_normal: 0.20,
      compra_financiamento_prestacao: 0.01,
      compra_registro: 0.04,
      compra_despachante: 0,
      compra_desocupacao: 0,
      venda_reforma: 0,
      venda_impostos: 0.06,
      venda_tempo_meses: 6,
      venda_despesas: 0,
      venda_despesas_extras: 0,
      venda_aceleracao: 0,
      aluguel_roi_comum: 0.005,
      aluguel_roi_caixa: 0.007,
      honorario_leiloeiro: 0.05,
      honorarios_corretagem: 0.06,
      honorarios_corretagem_caixa: 0.05
    };

    const { data, error } = await supabase
      .from('grupos_imovel')
      .insert([newGrupo])
      .select();
    
    if (error) {
      alert(error.message);
    } else {
      fetchGrupos();
      if (data && data[0]) setSelectedGrupo(data[0]);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Excluir este grupo?')) return;
    const { error } = await supabase.from('grupos_imovel').delete().eq('id', id);
    if (error) alert(error.message);
    fetchGrupos();
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans p-2 overflow-x-hidden">
      <div className="mx-auto space-y-4 max-w-[100vw]">
        
        {/* Compact Header */}
        <div className="flex items-center justify-between border-b pb-2 px-2">
          <div className="flex items-center gap-4">
             <Link href="/dashboard" className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500">
                <IoArrowBackOutline size={20} />
             </Link>
             <h1 className="text-lg font-bold">Administração de Grupos (Tabela)</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSaveAll}
              disabled={savingAll || grupos.length === 0}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-all shadow-sm active:scale-95 ${
                savingAll ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <IoSaveOutline size={16} /> {savingAll ? 'SALVANDO...' : 'SALVAR TUDO'}
            </button>
            <button 
              onClick={handleAddNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <IoAddOutline size={16} /> ADICIONAR LINHA
            </button>
          </div>
        </div>

        {/* Excel Table */}
        <div className="border border-gray-300 shadow-sm overflow-x-auto rounded-sm">
          <table className="w-full text-left border-collapse min-w-[1800px] table-fixed">
            <thead className="bg-gray-100 text-[10px] font-bold uppercase text-gray-700 border-b">
              <tr className="divide-x divide-gray-300">
                <th className="px-2 py-2 w-12 text-center bg-gray-200 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">#</th>
                <th className="px-2 py-2 w-48 sticky left-12 z-10 bg-gray-100 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">NOME DO GRUPO</th>
                <th className="px-2 py-2 w-32 text-center">V. MÍNIMO (R$)</th>
                <th className="px-2 py-2 w-32 text-center">V. MÁXIMO (R$)</th>
                {/* Seção Compra */}
                <th className="px-2 py-2 w-20 text-center bg-blue-100/50">REG (%)</th>
                <th className="px-2 py-2 w-20 text-center bg-blue-100/50">ENT CX (%)</th>
                <th className="px-2 py-2 w-20 text-center bg-blue-100/50">ENT NOR (%)</th>
                <th className="px-2 py-2 w-20 text-center bg-blue-100/50">PREST (%)</th>
                <th className="px-2 py-2 w-20 text-center bg-blue-100/50">DESP (R$)</th>
                <th className="px-2 py-2 w-20 text-center bg-blue-100/50">DESOC (R$)</th>
                {/* Seção Venda */}
                <th className="px-2 py-2 w-20 text-center bg-orange-100/50">REFORMA (%)</th>
                <th className="px-2 py-2 w-20 text-center bg-orange-100/50">IMP (%)</th>
                <th className="px-2 py-2 w-20 text-center bg-orange-100/50">TEMPO (M)</th>
                <th className="px-2 py-2 w-20 text-center bg-orange-100/50">ACEL (%)</th>
                {/* Seção ROI */}
                <th className="px-2 py-2 w-20 text-center bg-green-100/50">ROI COMUM</th>
                <th className="px-2 py-2 w-20 text-center bg-green-100/50">ROI CAIXA</th>
                {/* Honorarios */}
                <th className="px-2 py-2 w-20 text-center bg-purple-100/50">HON LEIL (%)</th>
                <th className="px-2 py-2 w-20 text-center bg-purple-100/50">HON COR (%)</th>
                <th className="px-2 py-2 w-20 text-center bg-purple-100/50">HON CX (%)</th>
                {/* Ações */}
                <th className="px-2 py-2 w-28 text-center bg-gray-50 sticky right-0 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={20} className="p-10 text-center animate-pulse tracking-widest text-gray-400">BUSCANDO DADOS DO SERVIDOR...</td></tr>
              ) : grupos.map((grupo) => (
                <tr key={grupo.id} className="divide-x divide-gray-200 hover:bg-blue-50/20 transition-colors">
                  <td className="px-2 py-1.5 text-center text-[10px] font-mono text-gray-400 shadow-inner bg-gray-50 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">{grupo.id}</td>
                  <td className="p-0.5 sticky left-12 z-10 bg-white group-hover:bg-blue-50/20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                    <input 
                      className="w-full h-8 px-2 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs font-bold border border-transparent hover:border-gray-200 rounded"
                      value={grupo.nome}
                      onChange={(e) => handleInputChange(grupo.id, 'nome', e.target.value)}
                    />
                  </td>
                  <td className="p-0.5">
                    <input 
                      type="number"
                      className="w-full h-8 px-2 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-right border border-transparent hover:border-gray-200 rounded"
                      value={grupo.valor_minimo}
                      onChange={(e) => handleInputChange(grupo.id, 'valor_minimo', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5">
                    <input 
                      type="number"
                      className="w-full h-8 px-2 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-right border border-transparent hover:border-gray-200 rounded"
                      value={grupo.valor_maximo}
                      onChange={(e) => handleInputChange(grupo.id, 'valor_maximo', Number(e.target.value))}
                    />
                  </td>
                  {/* Compra */}
                  <td className="p-0.5 bg-blue-50/10">
                    <input 
                      type="number" step="0.001"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded text-blue-700 font-bold"
                      value={grupo.compra_registro}
                      onChange={(e) => handleInputChange(grupo.id, 'compra_registro', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-blue-50/10">
                    <input 
                      type="number" step="0.001"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded text-green-700 font-bold"
                      value={grupo.compra_financiamento_entrada_caixa}
                      onChange={(e) => handleInputChange(grupo.id, 'compra_financiamento_entrada_caixa', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-blue-50/10">
                    <input 
                      type="number" step="0.001"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded"
                      value={grupo.compra_financiamento_entrada_normal}
                      onChange={(e) => handleInputChange(grupo.id, 'compra_financiamento_entrada_normal', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-blue-50/10">
                    <input 
                      type="number" step="0.001"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded font-mono"
                      value={grupo.compra_financiamento_prestacao}
                      onChange={(e) => handleInputChange(grupo.id, 'compra_financiamento_prestacao', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-blue-50/10">
                    <input 
                      type="number"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-right border border-transparent hover:border-gray-200 rounded"
                      value={grupo.compra_despachante}
                      onChange={(e) => handleInputChange(grupo.id, 'compra_despachante', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-blue-50/10">
                    <input 
                      type="number"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-right border border-transparent hover:border-gray-200 rounded"
                      value={grupo.compra_desocupacao}
                      onChange={(e) => handleInputChange(grupo.id, 'compra_desocupacao', Number(e.target.value))}
                    />
                  </td>
                  {/* Venda */}
                  <td className="p-0.5 bg-orange-50/10">
                    <input 
                      type="number" step="0.01"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded"
                      value={grupo.venda_reforma}
                      onChange={(e) => handleInputChange(grupo.id, 'venda_reforma', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-orange-50/10">
                    <input 
                      type="number" step="0.01"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded"
                      value={grupo.venda_impostos}
                      onChange={(e) => handleInputChange(grupo.id, 'venda_impostos', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-orange-50/10">
                    <input 
                      type="number"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded"
                      value={grupo.venda_tempo_meses}
                      onChange={(e) => handleInputChange(grupo.id, 'venda_tempo_meses', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-orange-50/10">
                    <input 
                      type="number" step="0.01"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded font-bold text-orange-600"
                      value={grupo.venda_aceleracao}
                      onChange={(e) => handleInputChange(grupo.id, 'venda_aceleracao', Number(e.target.value))}
                    />
                  </td>
                  {/* ROI */}
                  <td className="p-0.5 bg-green-50/10">
                    <input 
                      type="number" step="0.0001"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded"
                      value={grupo.aluguel_roi_comum}
                      onChange={(e) => handleInputChange(grupo.id, 'aluguel_roi_comum', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-green-50/10">
                    <input 
                      type="number" step="0.0001"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded font-bold text-blue-600"
                      value={grupo.aluguel_roi_caixa}
                      onChange={(e) => handleInputChange(grupo.id, 'aluguel_roi_caixa', Number(e.target.value))}
                    />
                  </td>
                   {/* Honorarios */}
                   <td className="p-0.5 bg-purple-50/10">
                    <input 
                      type="number" step="0.01"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded"
                      value={grupo.honorario_leiloeiro}
                      onChange={(e) => handleInputChange(grupo.id, 'honorario_leiloeiro', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-purple-50/10">
                    <input 
                      type="number" step="0.01"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded"
                      value={grupo.honorarios_corretagem}
                      onChange={(e) => handleInputChange(grupo.id, 'honorarios_corretagem', Number(e.target.value))}
                    />
                  </td>
                  <td className="p-0.5 bg-purple-50/10">
                    <input 
                      type="number" step="0.01"
                      className="w-full h-8 px-1 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none text-xs text-center border border-transparent hover:border-gray-200 rounded"
                      value={grupo.honorarios_corretagem_caixa}
                      onChange={(e) => handleInputChange(grupo.id, 'honorarios_corretagem_caixa', Number(e.target.value))}
                    />
                  </td>
                  {/* Ações */}
                  <td className="px-2 py-1.5 flex justify-center gap-1 sticky right-0 z-10 bg-gray-50 shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                    <button 
                      onClick={() => handleSaveRow(grupo)}
                      className="h-8 w-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded transition-all shadow-sm active:scale-90"
                      title="SALVAR"
                    >
                      <IoSaveOutline size={14} />
                    </button>
                    <button 
                      onClick={() => setSelectedGrupo(grupo)}
                      className="h-8 w-8 flex items-center justify-center bg-gray-800 hover:bg-black text-white rounded transition-all shadow-sm active:scale-90"
                      title="ABRIR VERTICAL"
                    >
                      <IoExpandOutline size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(grupo.id)}
                      className="h-8 w-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded transition-all border border-red-100 active:scale-90"
                      title="EXCLUIR"
                    >
                      <IoTrashOutline size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center text-[9px] text-gray-400 uppercase font-black px-2 py-4">
           <span>* Use 0.05 para 5%</span>
           <span className="flex items-center gap-2">
              <IoExpandOutline className="text-gray-900" /> Clique no ícone de expansão para editar na vertical
           </span>
           <span>© 2026 Portal de Investimentos</span>
        </div>
      </div>

      {/* Vertical Edit Modal */}
      {selectedGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-gray-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Edição Vertical</h2>
                <h3 className="text-xl font-bold">{selectedGrupo.nome}</h3>
              </div>
              <button 
                onClick={() => setSelectedGrupo(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <IoCloseOutline size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
              <Section title="Identificação">
                <Field label="Nome do Grupo" value={selectedGrupo.nome} onChange={(v) => handleInputChange(selectedGrupo.id, 'nome', v)} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Valor Mínimo (R$)" type="number" value={selectedGrupo.valor_minimo} onChange={(v) => handleInputChange(selectedGrupo.id, 'valor_minimo', Number(v))} />
                  <Field label="Valor Máximo (R$)" type="number" value={selectedGrupo.valor_maximo} onChange={(v) => handleInputChange(selectedGrupo.id, 'valor_maximo', Number(v))} />
                </div>
              </Section>

              <Section title="Parâmetros de Compra" color="blue">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Registro / ITBI (%)" type="number" step="0.001" value={selectedGrupo.compra_registro} onChange={(v) => handleInputChange(selectedGrupo.id, 'compra_registro', Number(v))} />
                  <Field label="Prestação (%)" type="number" step="0.001" value={selectedGrupo.compra_financiamento_prestacao} onChange={(v) => handleInputChange(selectedGrupo.id, 'compra_financiamento_prestacao', Number(v))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Entrada CAIXA (%)" type="number" step="0.001" value={selectedGrupo.compra_financiamento_entrada_caixa} onChange={(v) => handleInputChange(selectedGrupo.id, 'compra_financiamento_entrada_caixa', Number(v))} />
                  <Field label="Entrada Normal (%)" type="number" step="0.001" value={selectedGrupo.compra_financiamento_entrada_normal} onChange={(v) => handleInputChange(selectedGrupo.id, 'compra_financiamento_entrada_normal', Number(v))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Custos Despachante (R$)" type="number" value={selectedGrupo.compra_despachante} onChange={(v) => handleInputChange(selectedGrupo.id, 'compra_despachante', Number(v))} />
                  <Field label="Custos Desocupação (R$)" type="number" value={selectedGrupo.compra_desocupacao} onChange={(v) => handleInputChange(selectedGrupo.id, 'compra_desocupacao', Number(v))} />
                </div>
              </Section>

              <Section title="Parâmetros de Venda" color="orange">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Reforma Est. (%)" type="number" step="0.01" value={selectedGrupo.venda_reforma} onChange={(v) => handleInputChange(selectedGrupo.id, 'venda_reforma', Number(v))} />
                  <Field label="Impostos Venda (%)" type="number" step="0.01" value={selectedGrupo.venda_impostos} onChange={(v) => handleInputChange(selectedGrupo.id, 'venda_impostos', Number(v))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tempo Revenda (Meses)" type="number" value={selectedGrupo.venda_tempo_meses} onChange={(v) => handleInputChange(selectedGrupo.id, 'venda_tempo_meses', Number(v))} />
                  <Field label="Aceleração (%)" type="number" step="0.01" value={selectedGrupo.venda_aceleracao} onChange={(v) => handleInputChange(selectedGrupo.id, 'venda_aceleracao', Number(v))} />
                </div>
              </Section>

              <Section title="Projeções de ROI" color="green">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="ROI Aluguel Comum" type="number" step="0.0001" value={selectedGrupo.aluguel_roi_comum} onChange={(v) => handleInputChange(selectedGrupo.id, 'aluguel_roi_comum', Number(v))} />
                  <Field label="ROI Aluguel Caixa" type="number" step="0.0001" value={selectedGrupo.aluguel_roi_caixa} onChange={(v) => handleInputChange(selectedGrupo.id, 'aluguel_roi_caixa', Number(v))} />
                </div>
              </Section>

              <Section title="Honorários e Comissões" color="purple">
                <Field label="Honorários Leiloeiro (%)" type="number" step="0.01" value={selectedGrupo.honorario_leiloeiro} onChange={(v) => handleInputChange(selectedGrupo.id, 'honorario_leiloeiro', Number(v))} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Honorários Corretagem (%)" type="number" step="0.01" value={selectedGrupo.honorarios_corretagem} onChange={(v) => handleInputChange(selectedGrupo.id, 'honorarios_corretagem', Number(v))} />
                  <Field label="Honorários Corretagem Caixa (%)" type="number" step="0.01" value={selectedGrupo.honorarios_corretagem_caixa} onChange={(v) => handleInputChange(selectedGrupo.id, 'honorarios_corretagem_caixa', Number(v))} />
                </div>
              </Section>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3 mt-auto">
              <button 
                onClick={() => setSelectedGrupo(null)}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-200 rounded-lg transition-all"
              >
                Fechar
              </button>
              <button 
                onClick={() => handleSaveRow(selectedGrupo, true)}
                className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 active:scale-95"
              >
                <IoSaveOutline size={16} /> Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        input[type="number"]::-webkit-inner-spin-button, 
        input[type="number"]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #bbb;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children, color = "gray" }: { title: string, children: React.ReactNode, color?: string }) {
  const colorMap: any = {
    blue: "text-blue-600 border-blue-100",
    orange: "text-orange-600 border-orange-100",
    green: "text-green-600 border-green-100",
    purple: "text-purple-600 border-purple-100",
    gray: "text-gray-900 border-gray-100"
  };

  return (
    <div className="space-y-4">
      <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] pb-2 border-b-2 ${colorMap[color]}`}>{title}</h4>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", step }: { label: string, value: any, onChange: (v: string) => void, type?: string, step?: string }) {
  return (
    <div className="space-y-1.5 flex-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide ml-1">{label}</label>
      <input 
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-50 border border-gray-200 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white outline-none transition-all font-medium"
      />
    </div>
  );
}
