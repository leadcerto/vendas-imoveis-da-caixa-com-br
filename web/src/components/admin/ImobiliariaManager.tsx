'use client';

import React, { useState, useEffect } from 'react';
import { 
  IoBusinessOutline, 
  IoMailOutline, 
  IoLogoWhatsapp, 
  IoGlobeOutline, 
  IoLocationOutline, 
  IoPersonOutline, 
  IoImageOutline,
  IoAddOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoSaveOutline,
  IoCloseOutline,
  IoDocumentTextOutline
} from 'react-icons/io5';
import { supabase } from '@/lib/supabase';
import { Button, Card, Input } from '@/components/ui';

interface Imobiliaria {
  imobiliaria_id?: number;
  imobiliaria_nome: string;
  imobiliaria_whatsapp_numero: string;
  imobiliaria_whatsapp_botao: string;
  imobiliaria_email: string;
  imobiliaria_cnpj: string;
  imobiliaria_creci: string;
  imobiliaria_responsavel_nome: string;
  imobiliaria_responsavel_telefone: string;
  imobiliaria_responsavel_email: string;
  imobiliaria_site: string;
  imobiliaria_img_450x450: string;
  imobiliaria_img_600x600: string;
  imobiliaria_img_150x150: string;
  imobiliaria_uf: string;
  imobiliaria_endereco_bairro: string;
  imobiliaria_endereco_cep: string;
  imobiliaria_endereco_logradouro: string;
  imobiliaria_endereco_cidade: string;
  imobiliaria_endereco_complemento: string;
  imobiliaria_uf_atendimento: string;
}

const initialForm: Imobiliaria = {
  imobiliaria_nome: '',
  imobiliaria_whatsapp_numero: '',
  imobiliaria_whatsapp_botao: '',
  imobiliaria_email: '',
  imobiliaria_cnpj: '',
  imobiliaria_creci: '',
  imobiliaria_responsavel_nome: '',
  imobiliaria_responsavel_telefone: '',
  imobiliaria_responsavel_email: '',
  imobiliaria_site: '',
  imobiliaria_img_450x450: '',
  imobiliaria_img_600x600: '',
  imobiliaria_img_150x150: '',
  imobiliaria_uf: '',
  imobiliaria_endereco_bairro: '',
  imobiliaria_endereco_cep: '',
  imobiliaria_endereco_logradouro: '',
  imobiliaria_endereco_cidade: '',
  imobiliaria_endereco_complemento: '',
  imobiliaria_uf_atendimento: ''
};

export default function ImobiliariaManager() {
  const [imobiliarias, setImobiliarias] = useState<Imobiliaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Imobiliaria>(initialForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchImobiliarias();
  }, []);

  const fetchImobiliarias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('imobiliarias')
        .select('*')
        .order('imobiliaria_nome');
      
      if (error) throw error;
      setImobiliarias(data || []);
    } catch (error) {
      console.error('Error fetching imobiliarias:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (imob: Imobiliaria) => {
    // Garantir que campos nulos se tornem strings vazias para o formulário
    const sanitizedImob = { ...imob };
    Object.keys(sanitizedImob).forEach(key => {
      if (sanitizedImob[key as keyof Imobiliaria] === null) {
        (sanitizedImob as any)[key] = '';
      }
    });

    setForm(sanitizedImob);
    setEditingId(imob.imobiliaria_id || null);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Remover o ID do payload para não conflitar com a identidade
      const { imobiliaria_id, ...payload } = form;

      if (editingId) {
        const { error } = await supabase
          .from('imobiliarias')
          .update(payload)
          .eq('imobiliaria_id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('imobiliarias')
          .insert(payload);
        if (error) throw error;
      }
      
      await fetchImobiliarias();
      setShowForm(false);
      setForm(initialForm);
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta imobiliária?')) return;
    
    try {
      const { error } = await supabase
        .from('imobiliarias')
        .delete()
        .eq('imobiliaria_id', id);
      if (error) throw error;
      fetchImobiliarias();
    } catch (error: any) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F9B200]/10 flex items-center justify-center text-[#F9B200]">
            <IoBusinessOutline size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#003870] uppercase tracking-tighter">Imobiliárias Parceiras</h2>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Gerencie os parceiros de atendimento</p>
          </div>
        </div>
        {!showForm && (
          <Button icon={<IoAddOutline size={18} />} onClick={handleAddNew}>
            Cadastrar Nova
          </Button>
        )}
      </div>

      {showForm ? (
        <Card className="p-8 border-[#005CA9]/20 shadow-lg">
          <div className="flex items-center justify-between mb-10 pb-6 border-b border-gray-100">
            <h3 className="text-lg font-black text-[#003870] uppercase tracking-tighter">
              {editingId ? 'Editar Imobiliária' : 'Novo Cadastro'}
            </h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-red-500 transition-colors">
              <IoCloseOutline size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Seção: Dados Básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Input 
                label="Nome da Imobiliária" 
                placeholder="Ex: Imobiliária Silva" 
                required
                icon={<IoBusinessOutline />}
                value={form.imobiliaria_nome}
                onChange={e => setForm({...form, imobiliaria_nome: e.target.value})}
              />
              <Input 
                label="CNPJ" 
                placeholder="00.000.000/0001-00" 
                icon={<IoDocumentTextOutline />}
                value={form.imobiliaria_cnpj}
                onChange={e => setForm({...form, imobiliaria_cnpj: e.target.value})}
              />
              <Input 
                label="CRECI" 
                placeholder="Ex: 12345-J" 
                icon={<IoDocumentTextOutline />}
                value={form.imobiliaria_creci}
                onChange={e => setForm({...form, imobiliaria_creci: e.target.value})}
              />
            </div>

            {/* Seção: Contato */}
            <div className="bg-gray-50/50 p-8 rounded-[24px] border border-gray-100 space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#005CA9]">Informações de Contato</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Input 
                  label="WhatsApp de Atendimento" 
                  placeholder="Ex: 5521999999999" 
                  icon={<IoLogoWhatsapp />}
                  value={form.imobiliaria_whatsapp_numero}
                  onChange={e => setForm({...form, imobiliaria_whatsapp_numero: e.target.value})}
                />
                <Input 
                  label="E-mail Comercial" 
                  placeholder="contato@empresa.com" 
                  icon={<IoMailOutline />}
                  value={form.imobiliaria_email}
                  onChange={e => setForm({...form, imobiliaria_email: e.target.value})}
                />
                <Input 
                  label="Site Oficial" 
                  placeholder="https://www.site.com" 
                  icon={<IoGlobeOutline />}
                  value={form.imobiliaria_site}
                  onChange={e => setForm({...form, imobiliaria_site: e.target.value})}
                />
              </div>
            </div>

            {/* Seção: Responsável */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input 
                label="Nome do Responsável" 
                icon={<IoPersonOutline />}
                value={form.imobiliaria_responsavel_nome}
                onChange={e => setForm({...form, imobiliaria_responsavel_nome: e.target.value})}
              />
              <Input 
                label="WhatsApp do Responsável" 
                icon={<IoLogoWhatsapp />}
                value={form.imobiliaria_responsavel_telefone}
                onChange={e => setForm({...form, imobiliaria_responsavel_telefone: e.target.value})}
              />
              <Input 
                label="E-mail do Responsável" 
                icon={<IoMailOutline />}
                value={form.imobiliaria_responsavel_email}
                onChange={e => setForm({...form, imobiliaria_responsavel_email: e.target.value})}
              />
            </div>

            {/* Seção: Endereço */}
            <div className="bg-gray-50/50 p-8 rounded-[24px] border border-gray-100 space-y-6">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#005CA9]">Endereço da Sede</p>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Input 
                    label="Logradouro" 
                    icon={<IoLocationOutline />}
                    value={form.imobiliaria_endereco_logradouro}
                    onChange={e => setForm({...form, imobiliaria_endereco_logradouro: e.target.value})}
                  />
                  <Input 
                    label="Bairro" 
                    value={form.imobiliaria_endereco_bairro}
                    onChange={e => setForm({...form, imobiliaria_endereco_bairro: e.target.value})}
                  />
                  <Input 
                    label="CEP" 
                    value={form.imobiliaria_endereco_cep}
                    onChange={e => setForm({...form, imobiliaria_endereco_cep: e.target.value})}
                  />
                  <Input 
                    label="Cidade" 
                    value={form.imobiliaria_endereco_cidade}
                    onChange={e => setForm({...form, imobiliaria_endereco_cidade: e.target.value})}
                  />
                  <Input 
                    label="Estado (UF)" 
                    maxLength={2}
                    value={form.imobiliaria_uf}
                    onChange={e => setForm({...form, imobiliaria_uf: e.target.value.toUpperCase()})}
                  />
                  <Input 
                    label="Complemento" 
                    value={form.imobiliaria_endereco_complemento}
                    onChange={e => setForm({...form, imobiliaria_endereco_complemento: e.target.value})}
                  />
               </div>
            </div>

            {/* Seção: Atendimento e Imagens */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F9B200]">Regra de Atendimento</p>
                <Input 
                  label="UF de Atendimento (Ex: RJ, SP)" 
                  maxLength={2}
                  required
                  placeholder="Estado onde a imobiliária atende"
                  icon={<IoGlobeOutline />}
                  value={form.imobiliaria_uf_atendimento}
                  onChange={e => setForm({...form, imobiliaria_uf_atendimento: e.target.value.toUpperCase()})}
                />
                <p className="text-[9px] text-gray-400 uppercase tracking-widest leading-relaxed">
                  Os imóveis publicados nesta UF exibirão os dados desta imobiliária para contato.
                </p>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#005CA9]">Links de Imagens e Branding</p>
                <div className="space-y-4">
                  <Input label="URL Botão WhatsApp (350x100)" icon={<IoImageOutline />} value={form.imobiliaria_whatsapp_botao} onChange={e => setForm({...form, imobiliaria_whatsapp_botao: e.target.value})} />
                  <div className="grid grid-cols-3 gap-4">
                    <Input label="150x150" value={form.imobiliaria_img_150x150} onChange={e => setForm({...form, imobiliaria_img_150x150: e.target.value})} />
                    <Input label="450x450" value={form.imobiliaria_img_450x450} onChange={e => setForm({...form, imobiliaria_img_450x450: e.target.value})} />
                    <Input label="600x600" value={form.imobiliaria_img_600x600} onChange={e => setForm({...form, imobiliaria_img_600x600: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-8 border-t border-gray-100">
              <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button variant="primary" type="submit" loading={saving} icon={<IoSaveOutline size={18} />}>
                Salvar Imobiliária
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Imobiliária</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Atendimento</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">WhatsApp</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-8 py-6 h-20 bg-gray-50/20" />
                    </tr>
                  ))
                ) : imobiliarias.length > 0 ? (
                  imobiliarias.map((imob) => (
                    <tr key={imob.imobiliaria_id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <p className="font-bold text-[#003870] uppercase tracking-tighter">{imob.imobiliaria_nome}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{imob.imobiliaria_email || 'Sem e-mail'}</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-blue-50 text-[#005CA9] rounded-full text-[10px] font-black uppercase tracking-widest">
                          {imob.imobiliaria_uf_atendimento}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-green-600 font-bold text-xs">
                          <IoLogoWhatsapp />
                          {imob.imobiliaria_whatsapp_numero}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEdit(imob)}
                            className="p-2 text-gray-400 hover:text-[#005CA9] hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <IoPencilOutline size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(imob.imobiliaria_id!)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <IoTrashOutline size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest italic">
                      Nenhuma imobiliária cadastrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
