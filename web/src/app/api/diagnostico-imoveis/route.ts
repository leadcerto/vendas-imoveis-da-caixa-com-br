import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de negócio
// ─────────────────────────────────────────────────────────────────────────────
const DESCONTO_MINIMO = 30.0
const MODALIDADES_ACEITAS = [
  'venda online',
  'venda direta online'
]

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────
function parseBrl(val: unknown): number {
  if (val === null || val === undefined) return 0
  let s = String(val).replace(/R\$|%/g, '').trim()
  if (!s || s === 'nan' || s === 'None') return 0

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  } else if (s.includes('.')) {
    const parts = s.split('.')
    if (parts[parts.length - 1].length === 3) s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function findCol(headers: string[], fragments: string[]): string | null {
  for (const h of headers) {
    if (fragments.some(f => h.toLowerCase().includes(f.toLowerCase()))) return h
  }
  return null
}

function normalizeID(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Lógica Principal de Diagnóstico
// FIX v2.5.1: Carrega TODOS os imóveis do banco via paginação em vez de
// usar .in() com strings contra coluna bigint (que retornava 0 resultados)
// ─────────────────────────────────────────────────────────────────────────────
async function processarDiagnostico(aprovados: any[], rejeitados: any[], resumoRejeicao: any, rowsLength: number, fileName: string) {
  // Carregar TODOS os imóveis do banco via paginação
  const dbItems: any[] = []
  let page = 0
  const pageSize = 1000
  let lastError: any = null
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('imoveis')
      .select('imovel_caixa_numero, imovel_caixa_post_link_permanente, id_grupo_imovel_caixa, imovel_caixa_cartorio_matricula, imovel_caixa_detalhes_scraping, etapa_processamento, imovel_caixa_post_hashtags, imovel_caixa_post_imagem_destaque, updated_at, id_cep_imovel_caixa')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      lastError = error;
      console.error('[DIAGNOSTICO] Falha na query (pode ser coluna inexistente):', JSON.stringify(error));
      break
    }
    if (!data || data.length === 0) break
    dbItems.push(...data)
    if (data.length < pageSize) break
    page++
  }

  // Carregar Nomes dos Grupos e Selos para o Gráfico
  const { data: gruposRaw } = await supabaseAdmin.from('grupos_imovel').select('id, nome')
  const { data: selosRaw } = await supabaseAdmin.from('imovel_selo_oportunidade').select('imovel_selo_oportunidade_id, imovel_selo_oportunidade_nome')

  const mapaGrupos = new Map(gruposRaw?.map(g => [g.id, g.nome]) || [])
  const mapaSelos = new Map(selosRaw?.map(s => [s.imovel_selo_oportunidade_id, s.imovel_selo_oportunidade_nome]) || [])

  const mapaDB = new Map(dbItems.map(i => [normalizeID(i.imovel_caixa_numero), i]))
  const numerosAprovados = new Set(aprovados.map(a => normalizeID(a.numero)))

  // ── 2. Cruzamento em memória (Conforme as regras do Usuário) ──
  // Conforme no Banco: se repete nas duas listas
  // Novo Cadastro: só na lista Excel
  // Fora de Venda: só no Banco (não atualizado)

  let conformesCount = 0
  let novosCount = 0
  const amostraNovos: any[] = []

  aprovados.forEach((item) => {
    const idNorm = normalizeID(item.numero)
    const match = mapaDB.get(idNorm)
    if (match) conformesCount++
    else {
      novosCount++
      if (amostraNovos.length < 10) amostraNovos.push(item)
    }
  })

  const hoje = new Date()
  const limite120dias = new Date(hoje.setDate(hoje.getDate() - 120))

  const foraDeVendaItens = dbItems.filter(i => !numerosAprovados.has(normalizeID(i.imovel_caixa_numero)))
  const foraDeVendaVencidos = foraDeVendaItens.filter(i => new Date(i.updated_at) < limite120dias).length

  const totalBancoEncontrado = dbItems.length
  const checkStep = (fn: (i: any) => boolean) => dbItems.filter(fn).length

  const passos = [
    { passo: 1, nome: 'Filtros & Importação', finalizado: conformesCount, total: aprovados.length },
    { passo: 2, nome: 'SEO (Slug, Título, Hashtags)', finalizado: checkStep(i => !!(i.imovel_caixa_post_link_permanente && i.imovel_caixa_post_hashtags)), total: totalBancoEncontrado },
    { passo: 3, nome: 'Resolução Financeira & Grupos', finalizado: checkStep(i => i.id_grupo_imovel_caixa !== null && i.id_grupo_imovel_caixa !== undefined), total: totalBancoEncontrado },
    { passo: 4, nome: 'Scraping Site Caixa', finalizado: checkStep(i => !!i.imovel_caixa_detalhes_scraping), total: totalBancoEncontrado },
    { passo: 5, nome: 'Matrícula e Cartório', finalizado: checkStep(i => !!i.imovel_caixa_cartorio_matricula), total: totalBancoEncontrado },
    { passo: 6, nome: 'Localização (CEP)', finalizado: checkStep(i => !!i.id_cep_imovel_caixa), total: totalBancoEncontrado },
    { passo: 7, nome: 'Gestão & Relatórios', finalizado: checkStep(i => !!i.imovel_caixa_post_imagem_destaque), total: totalBancoEncontrado },
  ].map(p => ({
    ...p,
    processando: p.total ? (p.total - p.finalizado) : 0,
    percentual: p.total ? Math.round((p.finalizado / p.total) * 100) : 0,
    status: (p.total && p.finalizado / p.total >= 0.95) ? 'ok' : 'critico',
    detalhes: ''
  }))

  const scoreGeral = Math.round(passos.reduce((acc, p) => acc + p.percentual, 0) / passos.length)

  return {
    arquivo: fileName,
    totalLinhasExcel: rowsLength,
    aprovadosFiltros: aprovados.length,
    aprovadosLista: aprovados,
    rejeitadosFiltros: {
      total: rejeitados.length,
      modalidade: resumoRejeicao.modalidade,
      desconto: resumoRejeicao.desconto,
      modalidadesEncontradas: resumoRejeicao.modalidadesEncontradas,
      amostra: rejeitados.slice(0, 5)
    },
    novos: { total: novosCount, amostra: amostraNovos },
    conformes: { total: conformesCount },
    foraDeVenda: {
      total: foraDeVendaItens.length,
      vencidos: foraDeVendaVencidos,
      amostra: foraDeVendaItens.slice(0, 5).map(i => normalizeID(i.imovel_caixa_numero))
    },
    ultimoErroDB: lastError ? { message: lastError.message, code: lastError.code } : null,
    divergentes: { total: 0, amostra: [] },
    passos,
    scoreGeral,
    totalNoBanco: totalBancoEncontrado,
    gestao: {
      valorTotalEstoque: dbItems.reduce((acc, i) => acc + (i.imovel_caixa_valor_venda || 0), 0),
      countAtivos: dbItems.filter(i => !i.imovel_caixa_vendido).length,
      countVendidos: dbItems.filter(i => i.imovel_caixa_vendido).length,
      distribuicaoGrupos: Array.from(dbItems.reduce((acc, i) => {
        const nome = mapaGrupos.get(i.id_grupo_imovel_caixa) || 'Sem Grupo'
        acc.set(nome, (acc.get(nome) || 0) + 1)
        return acc
      }, new Map<string, number>()) as Map<string, number>).map(([nome, count]) => ({ nome, count })),
      vendasRecentes: {
        dias30: dbItems.filter(i => i.imovel_caixa_vendido && new Date(i.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
        dias60: dbItems.filter(i => i.imovel_caixa_vendido && new Date(i.updated_at) > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)).length,
        dias90: dbItems.filter(i => i.imovel_caixa_vendido && new Date(i.updated_at) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).length
      },
      breakdownPorUF: Array.from(new Set(dbItems.map(i => i.imovel_caixa_endereco_uf).filter(Boolean))).map(uf => {
        const itemsUF = dbItems.filter(i => i.imovel_caixa_endereco_uf === uf)
        return {
          uf,
          valorTotalEstoque: itemsUF.reduce((acc, i) => acc + (i.imovel_caixa_valor_venda || 0), 0),
          countAtivos: itemsUF.filter(i => !i.imovel_caixa_vendido).length,
          countVendidos: itemsUF.filter(i => i.imovel_caixa_vendido).length,
          distribuicaoGrupos: Array.from(itemsUF.reduce((acc, i) => {
            const nome = mapaGrupos.get(i.id_grupo_imovel_caixa) || 'Sem Grupo'
            acc.set(nome, (acc.get(nome) || 0) + 1)
            return acc
          }, new Map<string, number>()) as Map<string, number>).map(([nome, count]) => ({ nome, count })),
          vendasRecentes: {
            dias30: itemsUF.filter(i => i.imovel_caixa_vendido && new Date(i.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
            dias60: itemsUF.filter(i => i.imovel_caixa_vendido && new Date(i.updated_at) > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)).length,
            dias90: itemsUF.filter(i => i.imovel_caixa_vendido && new Date(i.updated_at) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).length
          }
        }
      })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/diagnostico-imoveis — Diagnóstico automático sem Excel
// ─────────────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    // Carregar todos os imóveis do banco em lotes de 1000
    const dbItems: any[] = []
    let page = 0
    const pageSize = 1000
    let getLastError: any = null
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('imoveis')
        .select('imovel_caixa_numero, imovel_caixa_endereco_uf, imovel_caixa_endereco_cidade, imovel_caixa_endereco_bairro, updated_at, imovel_caixa_post_link_permanente, imovel_caixa_post_titulo, imovel_caixa_post_hashtags, imovel_caixa_detalhes_scraping, imovel_caixa_cartorio_matricula, id_cep_imovel_caixa, id_grupo_imovel_caixa, imovel_caixa_post_imagem_destaque, imovel_caixa_link_imagem, imovel_caixa_valor_venda, imovel_caixa_vendido')
        .range(page * pageSize, (page + 1) * pageSize - 1)
      if (error) {
        getLastError = error;
        console.error('[GET DIAG] Erro (verificar colunas):', JSON.stringify(error));
        break
      }
      if (!data || data.length === 0) break
      dbItems.push(...data)
      if (data.length < pageSize) break
      page++
    }

    const totalBancoEncontrado = dbItems.length
    if (totalBancoEncontrado === 0) {
      return NextResponse.json({
        semDados: true,
        mensagem: 'Nenhum imóvel encontrado no banco de dados ou erro na query.',
        debug: getLastError ? { message: getLastError.message, code: getLastError.code } : '0 records'
      })
    }

    const hoje = new Date()
    const limite120dias = new Date(hoje.setDate(hoje.getDate() - 120))
    const itensVencidos = dbItems.filter(i => new Date(i.updated_at) < limite120dias).length

    // Carregar Grupos
    const { data: gruposRaw } = await supabaseAdmin.from('grupos_imovel').select('id, nome')
    const mapaGrupos = new Map(gruposRaw?.map(g => [g.id, g.nome]) || [])

    // Carregar último log de ingestão
    const { data: logData } = await supabaseAdmin
      .from('logs_ingestao')
      .select('arquivo_csv, total_lidos, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const fileName = logData?.arquivo_csv || 'Banco de Dados (Carga Automática)'
    const totalLinhasExcel = logData?.total_lidos || totalBancoEncontrado

    const checkStep = (fn: (i: any) => boolean) => dbItems.filter(fn).length

    const passos = [
      { passo: 1, nome: 'Filtros & Importação', finalizado: totalBancoEncontrado, total: totalBancoEncontrado },
      { passo: 2, nome: 'SEO (Slug, Título, Hashtags)', finalizado: checkStep(i => !!(i.imovel_caixa_post_link_permanente && i.imovel_caixa_post_hashtags)), total: totalBancoEncontrado },
      { passo: 3, nome: 'Resolução Financeira & Grupos', finalizado: checkStep(i => i.id_grupo_imovel_caixa !== null && i.id_grupo_imovel_caixa !== undefined), total: totalBancoEncontrado },
      { passo: 4, nome: 'Scraping Site Caixa', finalizado: checkStep(i => !!i.imovel_caixa_detalhes_scraping), total: totalBancoEncontrado },
      { passo: 5, nome: 'Matrícula e Cartório', finalizado: checkStep(i => !!i.imovel_caixa_cartorio_matricula), total: totalBancoEncontrado },
      { passo: 6, nome: 'Localização (CEP)', finalizado: checkStep(i => !!i.id_cep_imovel_caixa), total: totalBancoEncontrado },
      { passo: 7, nome: 'Gestão & Relatórios', finalizado: checkStep(i => !!i.imovel_caixa_post_imagem_destaque), total: totalBancoEncontrado },
    ].map(p => ({
      ...p,
      processando: p.total ? (p.total - p.finalizado) : 0,
      percentual: p.total ? Math.round((p.finalizado / p.total) * 100) : 0,
      status: (p.total && p.finalizado / p.total >= 0.95) ? 'ok' : 'critico' as 'ok' | 'critico',
      detalhes: ''
    }))

    const scoreGeral = Math.round(passos.reduce((acc, p) => acc + p.percentual, 0) / passos.length)

    const aprovadosLista = dbItems.map(i => ({
      numero: normalizeID(i.imovel_caixa_numero),
      uf: i.imovel_caixa_endereco_uf || '',
      cidade: i.imovel_caixa_endereco_cidade || '',
      bairro: i.imovel_caixa_endereco_bairro || '',
      preco: i.imovel_caixa_valor_venda || 0,
      desconto: 0,
      modalidade: 'venda online'
    }))

    return NextResponse.json({
      arquivo: fileName,
      totalLinhasExcel,
      aprovadosFiltros: totalBancoEncontrado,
      aprovadosLista,
      rejeitadosFiltros: { total: 0, modalidade: 0, desconto: 0, amostra: [] },
      novos: { total: 0, amostra: [] },
      conformes: { total: totalBancoEncontrado },
      foraDeVenda: {
        total: itensVencidos,
        descricao: 'Itens no banco sem atualização há mais de 120 dias (prováveis vendidos)',
        amostra: dbItems.filter(i => new Date(i.updated_at) < limite120dias).slice(0, 5).map(i => normalizeID(i.imovel_caixa_numero))
      },
      divergentes: { total: 0, amostra: [] },
      passos,
      scoreGeral,
      totalNoBanco: totalBancoEncontrado,
      gestao: {
        valorTotalEstoque: dbItems.reduce((acc, i) => acc + (i.imovel_caixa_valor_venda || 0), 0),
        countAtivos: dbItems.filter(i => !i.imovel_caixa_vendido).length,
        countVendidos: dbItems.filter(i => i.imovel_caixa_vendido).length,
        distribuicaoGrupos: Array.from(dbItems.reduce((acc, i) => {
          const nome = mapaGrupos.get(i.id_grupo_imovel_caixa) || 'Sem Grupo'
          acc.set(nome, (acc.get(nome) || 0) + 1)
          return acc
        }, new Map<string, number>()) as Map<string, number>).map(([nome, count]) => ({ nome, count })),
        vendasRecentes: {
          dias30: dbItems.filter(i => i.imovel_caixa_vendido && new Date(i.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length,
          dias60: dbItems.filter(i => i.imovel_caixa_vendido && new Date(i.updated_at) > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)).length,
          dias90: dbItems.filter(i => i.imovel_caixa_vendido && new Date(i.updated_at) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).length
        },
        breakdownPorUF: []
      }
    })
  } catch (err: any) {
    console.error('[GET DIAG Error]:', err)
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diagnostico-imoveis
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // --- MODO REFRESH (JSON) ---
    if (contentType.includes('application/json')) {
      const body = await request.json()
      if (!body.aprovadosLista) return NextResponse.json({ erro: 'Lista de aprovação ausente.' }, { status: 400 })

      const diag = await processarDiagnostico(
        body.aprovadosLista,
        body.rejeitadosFiltros?.amostra || [],
        body.rejeitadosFiltros || { modalidade: 0, desconto: 0 },
        body.totalLinhasExcel || body.aprovadosLista.length,
        body.arquivo || 'Refresh Automático'
      )
      return NextResponse.json(diag)
    }

    // --- MODO UPLOAD (FormData) ---
    const formData = await request.formData()
    const arquivo = formData.get('arquivo') as File | null
    if (!arquivo) return NextResponse.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 })

    const action = formData.get('action') as string | null

    // INGESTÃO EM REAL-TIME
    if (action === 'ingest') {
      const arrayBuffer = await arquivo.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const tempFilePath = path.join(os.tmpdir(), `ingest_${Date.now()}_${arquivo.name}`)
      fs.writeFileSync(tempFilePath, buffer)

      const pythonPath = process.env.PYTHON_PATH || 'python'
      const scriptPath = path.resolve(process.cwd(), '..', 'automation', 'tools', 'etapa1_cadastro_basico.py')

      const { data: logEntry } = await supabaseAdmin
        .from('logs_ingestao')
        .insert({ arquivo_csv: arquivo.name, total_lidos: 0, motivos_rejeicao: { status: 'manual_dashboard' } })
        .select().single()

      const logId = logEntry?.id ? String(logEntry.id) : '0'
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const child = spawn(pythonPath, [scriptPath, tempFilePath, logId], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
          child.stdout.on('data', (d) => controller.enqueue(encoder.encode(d.toString())))
          child.stderr.on('data', (d) => controller.enqueue(encoder.encode(`ERROR: ${d.toString()}`)))
          child.on('close', (code) => {
            controller.enqueue(encoder.encode(`\n--- PROCESSO FINALIZADO (SNC: ${code}) ---`))
            controller.close()
            try { fs.unlinkSync(tempFilePath) } catch (e) { }
          })
        }
      })
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })
    }

    // LER EXCEL E GERAR DIAGNÓSTICO INICIAL
    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true }) as any[]
    if (rows.length === 0) return NextResponse.json({ erro: 'Planilha vazia.' }, { status: 400 })

    const headers = Object.keys(rows[0])
    const cNumero = findCol(headers, ['imovel_caixa_numero', 'imóvel', 'n°', 'nº', 'numero'])
    const cUf = findCol(headers, ['imovel_caixa_endereco_uf', 'uf', 'estado'])
    const cCidade = findCol(headers, ['imovel_caixa_endereco_cidade', 'cidade', 'município'])
    const cBairro = findCol(headers, ['imovel_caixa_endereco_bairro', 'bairro'])
    const cPreco = findCol(headers, ['imovel_caixa_valor_venda', 'preço', 'venda', 'vlr_venda'])
    const cDesconto = findCol(headers, ['imovel_caixa_valor_desconto_percentual', 'desconto', 'perc_desc'])
    const cModalidade = findCol(headers, ['imovel_caixa_modalidade', 'modalidade', 'tp_venda'])

    const aprovados: any[] = []
    const rejeitados: any[] = []
    const resumoRejeicao = { modalidade: 0, desconto: 0, modalidadesEncontradas: {} as Record<string, number> }

    rows.forEach(row => {
      const numero = normalizeID(row[cNumero || ''])
      if (!numero) return
      const modalidade = String(row[cModalidade || ''] || '').trim()
      const descontoRaw = parseBrl(row[cDesconto || ''])
      const desconto = (descontoRaw > 0 && descontoRaw < 1) ? descontoRaw * 100 : descontoRaw

      const item = { numero, uf: String(row[cUf || ''] || '').trim().toUpperCase(), cidade: String(row[cCidade || ''] || '').trim(), bairro: String(row[cBairro || ''] || '').trim(), preco: parseBrl(row[cPreco || '']), desconto, modalidade }
      if (!MODALIDADES_ACEITAS.includes(modalidade.toLowerCase())) {
        resumoRejeicao.modalidade++; resumoRejeicao.modalidadesEncontradas[modalidade] = (resumoRejeicao.modalidadesEncontradas[modalidade] || 0) + 1; rejeitados.push(item)
      } else if (desconto < DESCONTO_MINIMO) {
        resumoRejeicao.desconto++; rejeitados.push(item)
      } else {
        aprovados.push(item)
      }
    })

    const diag = await processarDiagnostico(aprovados, rejeitados, resumoRejeicao, rows.length, arquivo.name)
    return NextResponse.json(diag)

  } catch (err: any) {
    console.error('[API Error]:', err)
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
