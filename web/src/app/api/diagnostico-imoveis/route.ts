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
  let s = String(val).trim();
  
  // Trata notação científica (ex: 1.4444e+12)
  if (s.toLowerCase().includes('e')) {
    const num = Number(s);
    if (!isNaN(num)) return BigInt(Math.floor(num)).toString();
  }

  // Remove .0 que o Excel coloca em números
  if (s.endsWith('.0')) s = s.slice(0, -2);
  
  // Remove qualquer caractere que não seja número (evita "14.444.054.718-00")
  const numeric = s.replace(/[^\d]/g, '');
  
  // Se parece um ID da CAIXA (geralmente 13 a 15 dígitos), retorna
  return numeric;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diagnostico-imoveis
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const arquivo = formData.get('arquivo') as File | null

    if (!arquivo) return NextResponse.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 })

    const action = formData.get('action') as string | null

    // ── INGESTÃO EM REAL-TIME ──────────────────────────────────
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
            try { fs.unlinkSync(tempFilePath) } catch (e) {}
          })
        }
      })
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })
    }

    // ── 1. Ler o Excel ───────────────────────────────────────────────────────
    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true }) as any[]

    if (rows.length === 0) return NextResponse.json({ erro: 'Planilha vazia.' }, { status: 400 })

    const headers = Object.keys(rows[0])
    const cNumero     = findCol(headers, ['imovel', 'imóvel', 'n°', 'nº', 'numero', 'n.'])
    const cUf         = findCol(headers, ['uf', 'estado', 'funda'])
    const cCidade     = findCol(headers, ['cidade', 'município', 'municipio'])
    const cBairro     = findCol(headers, ['bairro'])
    const cPreco      = findCol(headers, ['preço de venda', 'preco', 'venda', 'vlr_venda'])
    const cAvaliacao  = findCol(headers, ['avaliação', 'preco_avaliacao', 'vlr_avali'])
    const cDesconto   = findCol(headers, ['desconto', 'perc_desc'])
    const cModalidade = findCol(headers, ['modalidade', 'tp_venda'])

    // ── 2. Processar e Filtrar ────────────────────────────────────────────────
    const ufsNoExcel = new Set<string>()
    const aprovados: any[] = []
    const rejeitados: any[] = []
    const resumoRejeicao = { modalidade: 0, desconto: 0, modalidadesEncontradas: {} as Record<string, number> }

    rows.forEach(row => {
      const numero = normalizeID(row[cNumero || ''])
      if (!numero) return

      const uf = String(row[cUf || ''] || '').trim().toUpperCase()
      const modalidade = String(row[cModalidade || ''] || '').trim()
      const descontoRaw = parseBrl(row[cDesconto || ''])
      const desconto = (descontoRaw > 0 && descontoRaw < 1) ? descontoRaw * 100 : descontoRaw
      
      const item = {
        numero,
        uf,
        cidade: String(row[cCidade || ''] || '').trim(),
        bairro: String(row[cBairro || ''] || '').trim(),
        preco: parseBrl(row[cPreco || '']),
        desconto,
        modalidade
      }

      if (uf) ufsNoExcel.add(uf)

      const modValida = MODALIDADES_ACEITAS.includes(modalidade.toLowerCase())
      const descValido = desconto >= DESCONTO_MINIMO

      if (!modValida) {
        resumoRejeicao.modalidade++
        resumoRejeicao.modalidadesEncontradas[modalidade] = (resumoRejeicao.modalidadesEncontradas[modalidade] || 0) + 1
        rejeitados.push(item)
      } else if (!descValido) {
        resumoRejeicao.desconto++
        rejeitados.push(item)
      } else {
        aprovados.push(item)
      }
    })

    // ── 3. Carregar DB (Apenas para as UFs do Excel) ──────────────────────────
    let dbItems: any[] = []
    const ufsArray = Array.from(ufsNoExcel)
    if (ufsArray.length > 0) {
      const { data } = await supabaseAdmin
        .from('imoveis')
        .select('imovel_caixa_numero, imovel_caixa_endereco_uf, imovel_caixa_endereco_cidade, imovel_caixa_endereco_bairro, updated_at, imovel_caixa_post_link_permanente, imovel_caixa_post_titulo, imovel_caixa_post_hashtags, imovel_caixa_detalhes_scraping, imovel_caixa_cartorio_matricula, id_cep_imovel_caixa, id_grupo_imovel_caixa, imovel_caixa_post_imagem_destaque')
        .in('imovel_caixa_endereco_uf', ufsArray)
      if (data) dbItems = data
    }

    const mapaDB = new Map(dbItems.map(i => [normalizeID(i.imovel_caixa_numero), i]))
    const numerosAprovados = new Set(aprovados.map(a => a.numero))

    // ── 4. Cruzamento ────────────────────────────────────────────────────────
    let conformesCount = 0
    let novosCount = 0
    const amostraNovos: any[] = []

    aprovados.forEach(item => {
      if (mapaDB.has(item.numero)) {
        conformesCount++
      } else {
        novosCount++
        if (amostraNovos.length < 10) amostraNovos.push(item)
      }
    })

    // ── 5. Fora de Venda (DB - Aprovados) ────────────────────────────────────
    const foraDeVendaItens = dbItems.filter(i => !numerosAprovados.has(normalizeID(i.imovel_caixa_numero)))
    
    // ── 6. Diagnóstico dos 7 passos (Média do Banco para as UFs analisadas) ───
    const totalVendaUf = dbItems.length
    const checkStep = (fn: (i: any) => boolean) => dbItems.filter(fn).length
    
    const passos = [
      { passo: 1, nome: 'Filtros & Importação', finalizado: conformesCount, processando: novosCount, total: aprovados.length },
      { passo: 2, nome: 'SEO (Slug, Título, Hashtags)', finalizado: checkStep(i => !!(i.imovel_caixa_post_link_permanente && i.imovel_caixa_post_hashtags)), total: totalVendaUf },
      { passo: 3, nome: 'Resolução Financeira & Grupos', finalizado: checkStep(i => !!i.id_grupo_imovel_caixa), total: totalVendaUf },
      { passo: 4, nome: 'Scraping Site Caixa', finalizado: checkStep(i => !!i.imovel_caixa_detalhes_scraping), total: totalVendaUf },
      { passo: 5, nome: 'Matrícula e Cartório', finalizado: checkStep(i => !!i.imovel_caixa_cartorio_matricula), total: totalVendaUf },
      { passo: 6, nome: 'Localização (CEP)', finalizado: checkStep(i => !!i.id_cep_imovel_caixa), total: totalVendaUf },
      { passo: 7, nome: 'Imagens & Capa', finalizado: checkStep(i => !!i.imovel_caixa_post_imagem_destaque), total: totalVendaUf },
    ].map(p => ({
      ...p,
      processando: p.total ? (p.total - p.finalizado) : 0,
      percentual: p.total ? Math.round((p.finalizado / p.total) * 100) : 0,
      status: (p.total && p.finalizado / p.total >= 0.95) ? 'ok' : 'critico',
      detalhes: ''
    }))

    const scoreGeral = Math.round(passos.reduce((acc, p) => acc + p.percentual, 0) / passos.length)

    return NextResponse.json({
      arquivo: arquivo.name,
      totalLinhasExcel: rows.length,
      aprovadosFiltros: aprovados.length,
      rejeitadosFiltros: {
        total: rejeitados.length,
        modalidade: resumoRejeicao.modalidade,
        desconto: resumoRejeicao.desconto,
        modalidadesEncontradas: resumoRejeicao.modalidadesEncontradas,
        amostra: rejeitados.slice(0, 5)
      },
      novos: { total: novosCount, amostra: amostraNovos },
      conformes: { total: conformesCount },
      foraDeVenda: { total: foraDeVendaItens.length, amostra: foraDeVendaItens.slice(0, 5).map(i => ({ numero: i.imovel_caixa_numero, uf: i.imovel_caixa_endereco_uf, cidade: i.imovel_caixa_endereco_cidade })) },
      divergentes: { total: 0, amostra: [] }, // Reservado para checks de preço divergente depois
      passos,
      scoreGeral,
      totalNoBanco: totalVendaUf,
      debug: {
        excel_sample: aprovados.slice(0, 5).map(i => i.numero),
        db_sample: dbItems.slice(0, 5).map(i => normalizeID(i.imovel_caixa_numero)),
        matched: conformesCount,
        column_mapping: { cNumero, cUf, cCidade, cPreco, cDesconto, cModalidade },
        headers: headers.slice(0, 10)
      }
    })

  } catch (err: any) {
    console.error('[API Error]:', err)
    return NextResponse.json({ erro: err.message }, { status: 500 })
  }
}
