
// Migration script: Copy imoveis_caixa from old Supabase to new Supabase
const OLD_URL = 'https://tzbpcadtnkpjjsmkmtvl.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YnBjYWR0bmtwampzbWttdHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MTU2NDUsImV4cCI6MjA4ODI5MTY0NX0.eTfdApgJz4n2Kxi0KWIK81IpzJBJ4jUkqEaX56a49x4';

const NEW_URL = 'https://mhlcjaprpkveernmiohx.supabase.co';
const NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1obGNqYXBycGt2ZWVybm1pb2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzMyMDUsImV4cCI6MjA4ODc0OTIwNX0.lpa8NUgR1bWPurUB1WzcaURThXf2bh67_VQKovXj9Sw';

const BATCH_SIZE = 500;

const COLUMNS = 'numero_imovel,data_geracao,uf,cidade,bairro,endereco,preco_venda,valor_avaliacao,desconto_percentual,aceita_financiamento,descricao,modalidade_venda,link_imovel,nivel_destaque,saldo_devedor_atual,valor_venda_acelerada,previsao_lucro,quartos,area_privativa,garagem,matricula,comarca,oficio,inscricao_imobiliaria,averbacao_leiloes,ocupacao,created_at,wp_post_id,wp_post_url,wp_publicado,atualizado_em,tipo_imovel,cep,complemento,banheiros,permite_fgts,aceita_recursos_proprios,observacoes,url_matricula,raspado_em,status_processamento,data_importacao,data_atualizacao,aceita_financiamento_sbpe,apenas_vista,regra_condominio,regra_tributos,anotacoes,scraping_realizado,data_scraping,tentativas_scraping,cep_normalizado';

async function fetchBatch(offset) {
  const url = `${OLD_URL}/rest/v1/imoveis_caixa?select=${encodeURIComponent(COLUMNS)}&order=numero_imovel.asc&offset=${offset}&limit=${BATCH_SIZE}`;
  const res = await fetch(url, {
    headers: {
      'apikey': OLD_KEY,
      'Authorization': `Bearer ${OLD_KEY}`,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fetch failed at offset ${offset}: ${res.status} - ${text}`);
  }
  return res.json();
}

async function insertBatch(rows) {
  const url = `${NEW_URL}/rest/v1/imoveis_caixa`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': NEW_KEY,
      'Authorization': `Bearer ${NEW_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert failed: ${res.status} - ${text}`);
  }
}

async function main() {
  console.log('Starting migration of imoveis_caixa...');
  let offset = 0;
  let totalInserted = 0;

  while (true) {
    const rows = await fetchBatch(offset);
    if (rows.length === 0) break;
    
    await insertBatch(rows);
    totalInserted += rows.length;
    console.log(`Migrated ${totalInserted} rows (batch at offset ${offset})`);
    
    offset += BATCH_SIZE;
  }

  console.log(`\nMigration complete! Total rows migrated: ${totalInserted}`);
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
