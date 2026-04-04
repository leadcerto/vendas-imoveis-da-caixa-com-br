import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imovel_id, tipo_evento, sessao_id, valor_metric, metadados } = body;

    if (!tipo_evento) {
      return NextResponse.json({ error: 'Tipo de evento é obrigatório' }, { status: 400 });
    }

    // Inserir o evento no banco
    const { error } = await supabase
      .from('analytics_eventos')
      .insert({
        imovel_id: imovel_id || null,
        tipo_evento,
        sessao_id: sessao_id || null,
        valor_metric: valor_metric || 0,
        metadados: metadados || {},
      });

    if (error) {
      console.error('Erro ao registrar evento analytics:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro interno analytics:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
