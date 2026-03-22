import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'c:/Users/PICHAU/Desktop/antigravity/venda-imoveis-caixa/web/.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function verify() {
  console.log("Fetching properties with CEP enrichment...");
  const { data, error } = await supabase
    .from('properties')
    .select('*, ceps_imovel(id, cep_status)')
    .limit(20);

  if (error) {
    console.error("Error:", error);
    return;
  }

  const enriched = data.filter(p => p.ceps_imovel);
  console.log(`Found ${data.length} properties.`);
  console.log(`Enriched properties: ${enriched.length}`);
  
  if (enriched.length > 0) {
    console.log("Example enriched property:", enriched[0].title);
  }
}

verify();
