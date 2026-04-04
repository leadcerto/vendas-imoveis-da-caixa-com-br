import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // 1. Ranking de Imóveis (Top 10 mais vistos)
    const { data: topProperties } = await supabase
      .rpc('get_top_properties_analytics', { limit_val: 10 });

    // 2. Estatísticas de Eventos (Totais)
    const { data: stats } = await supabase
      .from('analytics_eventos')
      .select('tipo_evento');

    const counts = {
      views: stats?.filter(e => e.tipo_evento === 'view').length || 0,
      whatsapp: stats?.filter(e => e.tipo_evento === 'whatsapp_click').length || 0,
      leads: stats?.filter(e => e.tipo_evento === 'form_submit').length || 0,
    };

    // 3. Imóveis com mais cliques no WhatsApp
    const { data: topWhatsapp } = await supabase
      .rpc('get_top_whatsapp_clicks');

    return NextResponse.json({
      summary: counts,
      topProperties: topProperties || [],
      topWhatsapp: topWhatsapp || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
