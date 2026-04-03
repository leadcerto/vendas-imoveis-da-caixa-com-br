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
// Constantes de negócio (idênticas ao ingest_caixa_csv.py)
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

  // 1.234,56 → 1234.56
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (s.includes(',')) {
    s = s.replace(',', '.')
  } else if (s.includes('.')) {
    const parts = s.split('.')
    if (parts[parts.length - 1].length === 3) {
      s = s.replace(/\./g, '') // milhar BR
    }
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

// Extrai o número do imóvel da URL (fallback dado notação científica no Excel)
function extrairNumeroFromLink(link: string): number | null {
  const m = link?.match(/hdnimovel=(\d+)/i)
  return m ? parseInt(m[1]) : null
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/diagnostico-imoveis
// Body: multipart/form-data com campo "arquivo" (Excel .xlsx ou .xls)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const arquivo = formData.get('arquivo') as File | null

    if (!arquivo) {
      return NextResponse.json({ erro: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const action = formData.get('action') as string | null

    // ── INGESTÃO EM REAL-TIME (STREAMING) ──────────────────────────────────
    if (action === 'ingest') {
      const arrayBuffer = await arquivo.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      // Salvar arquivo temporário para o script Python
      const tempDir = os.tmpdir()
      const tempFilePath = path.join(tempDir, `ingest_${Date.now()}_${arquivo.name}`)
      fs.writeFileSync(tempFilePath, buffer)

      const pythonPath = process.env.PYTHON_PATH || 'python'
      const scriptPath = path.resolve(process.cwd(), '..', 'automation', 'tools', 'etapa1_cadastro_basico.py')

      // Criar entrada de log para acompanhar
      const { data: logEntry } = await supabaseAdmin
        .from('logs_ingestao')
        .insert({ 
          arquivo_csv: arquivo.name,
          total_lidos: 0,
          motivos_rejeicao: { status: 'manual_dashboard' }
        })
        .select()
        .single()

      const logId = logEntry?.id ? String(logEntry.id) : '0'

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const child = spawn(pythonPath, [scriptPath, tempFilePath, logId], {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
          })

          child.stdout.on('data', (data) => {
            controller.enqueue(encoder.encode(data.toString()))
          })

          child.stderr.on('data', (data) => {
            // Também enviamos erros para o log de streaming para o usuário ver
            controller.enqueue(encoder.encode(`ERROR: ${data.toString()}`))
          })

          child.on('close', (code) => {
            controller.enqueue(encoder.encode(`\n--- PROCESSO FINALIZADO (SNC: ${code}) ---`))
            controller.close()
            // Limpar arquivo temporário
            try { fs.unlinkSync(tempFilePath) } catch (e) {}
          })
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // ── 1. Ler o Excel ───────────────────────────────────────────────────────
    const buffer = Buffer.from(await arquivo.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    
    // Usamos raw: true para pegar valores numéricos sem formatação científica do Excel
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: true, 
    })

    if (rows.length === 0) {
      return NextResponse.json({ erro: 'Planilha vazia ou sem dados reconhecíveis.' }, { status: 400 })
    }

    const headers = Object.keys(rows[0])

    // ── 2. Mapear colunas ────────────────────────────────────────────────────
    const cNumero    = findCol(headers, ['imovel', 'imóvel', 'n°', 'nº', 'numero'])
    const cUf        = findCol(headers, ['uf', 'estado'])
    const cCidade    = findCol(headers, ['cidade', 'município', 'municipio'])
    const cBairro    = findCol(headers, ['bairro'])
    const cPreco     = findCol(headers, ['preço de venda', 'preco', 'venda'])
    const cAvaliacao = findCol(headers, ['avaliação', 'avaliacao', 'preço de avaliação'])
    const cDesconto  = findCol(headers, ['desconto'])
    const cModalidade= findCol(headers, ['modalidade'])
    const cFinanc    = findCol(headers, ['financiamento', 'admite financiamento'])
    const cLink      = findCol(headers, ['link', 'url', 'acesso'])
    const cTipo      = findCol(headers, ['tipo de imóvel', 'tipo'])

    // ── 3. Processar linhas ──────────────────────────────────────────────────
    const itensMapeados: {
      numero: string
      uf: string
      cidade: string
      bairro: string
      preco: number
      avaliacao: number
      desconto: number
      modalidade: string
      financiamento: boolean
      tipo: string
      link: string
    }[] = []

    let rejeitados_modalidade = 0
    let rejeitados_desconto = 0
    const modalidades_encontradas: Record<string, number> = {}

    for (const row of rows) {
      // Número do imóvel (Tratar BigInt e Notação Científica)
      let numero: string | null = null
      if (cNumero) {
        const val = row[cNumero]
        if (typeof val === 'number') {
          // Garante que números grandes (BigInt) não fiquem em notação científica
          // 1.5e12 -> "1500000000000"
          numero = BigInt(Math.floor(val)).toString()
        } else {
          const raw = String(val ?? '').trim()
          // Remove tudo que não for dígito
          const apenasNumeros = raw.replace(/[^\d]/g, '')
          if (apenasNumeros.length > 0) numero = apenasNumeros
        }

        // Fallback para Link se falhar acima
        if (!numero || numero.length < 5) {
          const extraido = extrairNumeroFromLink(String(row[cLink ?? ''] ?? ''))
          if (extraido) numero = String(extraido)
        }
      }

      if (!numero) continue;

      const modalidade = String(row[cModalidade ?? ''] ?? '').trim()
      const desconto_raw = parseBrl(row[cDesconto ?? ''])
      const desconto = desconto_raw > 0 && desconto_raw < 1 ? desconto_raw * 100 : desconto_raw
      const preco = parseBrl(row[cPreco ?? ''])
      const avaliacao = parseBrl(row[cAvaliacao ?? ''])

      // Classificar filtros
      const modalidade_valida = MODALIDADES_ACEITAS.includes(modalidade.toLowerCase())
      const desconto_valido = desconto >= DESCONTO_MINIMO

      if (!modalidade_valida) { 
        rejeitados_modalidade++; 
        modalidades_encontradas[modalidade] = (modalidades_encontradas[modalidade] || 0) + 1
      }
      if (modalidade_valida && !desconto_valido) { rejeitados_desconto++; }

      itensMapeados.push({
        numero,
        uf:        String(row[cUf ?? ''] ?? '').trim().toUpperCase(),
        cidade:    String(row[cCidade ?? ''] ?? '').trim(),
        bairro:    String(row[cBairro ?? ''] ?? '').trim(),
        preco,
        avaliacao,
        desconto,
        modalidade,
        financiamento: ['sim', 's', 'true', '1'].includes(String(row[cFinanc ?? ''] ?? '').toLowerCase()),
        tipo:      String(row[cTipo ?? ''] ?? '').trim(),
        link:      String(row[cLink ?? ''] ?? '').trim(),
      })
    }

    const aprovados = itensMapeados.filter(
      i => MODALIDADES_ACEITAS.includes(i.modalidade.toLowerCase()) && i.desconto >= DESCONTO_MINIMO
    )
    const rejeitados_todos = itensMapeados.filter(
      i => !MODALIDADES_ACEITAS.includes(i.modalidade.toLowerCase()) || i.desconto < DESCONTO_MINIMO
    )

    const { count: totalNoBanco } = await supabaseAdmin
      .from('imoveis')
      .select('*', { count: 'exact', head: true })

    // ── 4. Buscar banco de dados ─────────────────────────────────────────────
    const numerosAprovados = aprovados.map(i => i.numero)
    const PAGE_SIZE = 500
    const bancoDados: any[] = []

    for (let i = 0; i < numerosAprovados.length; i += PAGE_SIZE) {
      const chunk = numerosAprovados.slice(i, i + PAGE_SIZE)
      const { data, error } = await supabaseAdmin
        .from('imoveis')
        .select(`
          imovel_caixa_numero,
          imovel_caixa_endereco_uf,
          imovel_caixa_endereco_cidade,
          imovel_caixa_endereco_bairro,
          imovel_caixa_post_link_permanente,
          imovel_caixa_post_titulo,
          imovel_caixa_post_descricao,
          imovel_caixa_post_hashtags,
          imovel_caixa_post_imagem_destaque,
          imovel_caixa_detalhes_scraping,
          imovel_caixa_cartorio_matricula,
          imovel_caixa_endereco_logradouro,
          id_cep_imovel_caixa,
          id_grupo_imovel_caixa,
          imovel_caixa_descricao_tipo,
          atualizacoes_imovel(
            imovel_caixa_valor_venda,
            imovel_caixa_valor_avaliacao,
            imovel_caixa_valor_desconto_percentual,
            imovel_caixa_modalidade,
            imovel_caixa_pagamento_fgts
          )
        `)
        .in('imovel_caixa_numero', chunk)

      if (!error && data) bancoDados.push(...data)
    }

    // Montar mapa de BD por número (normalizado para string)
    const mapaDB = new Map<string, any>()
    for (const item of bancoDados) {
      mapaDB.set(String(item.imovel_caixa_numero), item)
    }

    // ── 5. Cruzamento ────────────────────────────────────────────────────────
    const novos: typeof aprovados = []
    const conformes: (typeof aprovados[0] & { status_seo: string, status_scraping: string, status_cep: string })[] = []
    const divergentes: (typeof aprovados[0] & { divergencias: string[] })[] = []

    // Contadores de checks dos 7 passos
    let semSeo = 0, semHashtag = 0, semScraping = 0, semMatricula = 0, semCep = 0, semLocalizacao = 0, semGrupo = 0, semLogradouro = 0, semCapa = 0

    for (const item of aprovados) {
      const db = mapaDB.get(item.numero)

      if (!db) {
        novos.push(item)
        continue
      }

      // Verificações dos 7 passos
      const temSeo = !!(db.imovel_caixa_post_link_permanente && db.imovel_caixa_post_titulo)
      const temHashtag = !!(db.imovel_caixa_post_hashtags)
      const temScraping = !!(db.imovel_caixa_detalhes_scraping)
      const temMatricula = !!(db.imovel_caixa_cartorio_matricula)
      const temCep = !!(db.id_cep_imovel_caixa)
      const temGrupo = !!(db.id_grupo_imovel_caixa)
      const temLogradouro = !!(db.imovel_caixa_endereco_logradouro)
      const temCapa = !!(db.imovel_caixa_post_imagem_destaque)

      if (!temSeo) semSeo++
      if (!temHashtag) semHashtag++
      if (!temScraping) semScraping++
      if (!temMatricula) semMatricula++
      if (!temCep) semCep++
      if (!temGrupo) semGrupo++
      if (!temLogradouro) semLogradouro++
      if (!temCapa) semCapa++

      // Verificar divergências de valores financeiros
      const ultimaAtualizacao = db.atualizacoes_imovel?.[0] ?? db.atualizacoes_imovel
      const divergencias: string[] = []

      if (ultimaAtualizacao) {
        const precoDb = parseFloat(ultimaAtualizacao.imovel_caixa_valor_venda ?? '0')
        const avalDb = parseFloat(ultimaAtualizacao.imovel_caixa_valor_avaliacao ?? '0')
        const descDb = parseFloat(ultimaAtualizacao.imovel_caixa_valor_desconto_percentual ?? '0')

        if (Math.abs(precoDb - item.preco) > 0.01) {
          divergencias.push(`Valor venda: R$ ${precoDb.toLocaleString('pt-BR')} → R$ ${item.preco.toLocaleString('pt-BR')}`)
        }
        if (Math.abs(avalDb - item.avaliacao) > 0.01) {
          divergencias.push(`Valor avaliação: R$ ${avalDb.toLocaleString('pt-BR')} → R$ ${item.avaliacao.toLocaleString('pt-BR')}`)
        }
        if (Math.abs(descDb - item.desconto) > 0.1) {
          divergencias.push(`Desconto: ${descDb.toFixed(1)}% → ${item.desconto.toFixed(1)}%`)
        }
      } else {
        divergencias.push('Sem registro em atualizacoes_imovel')
      }

      if (divergencias.length > 0) {
        divergentes.push({ ...item, divergencias })
      } else {
        conformes.push({
          ...item,
          status_seo: temSeo ? 'ok' : 'ausente',
          status_scraping: temScraping ? 'ok' : 'ausente',
          status_cep: temCep ? 'ok' : 'ausente',
        })
      }
    }

    // ── 6. Score dos 7 passos ────────────────────────────────────────────────
    const totalBanco = bancoDados.length
    const passos = [
      { 
        passo: 1, 
        nome: 'Filtros & Importação', 
        finalizado: aprovados.length - novos.length, 
        processando: novos.length, 
        total: aprovados.length, 
        detalhes: novos.length > 0 ? `${novos.length} novos imóveis aguardando gravação.` : 'Todos os imóveis deste lote já estão no banco.' 
      },
      { 
        passo: 2, 
        nome: 'SEO (slug, título, hashtags)', 
        finalizado: totalBanco - semSeo - semHashtag, 
        processando: semSeo + semHashtag, 
        total: totalBanco, 
        detalhes: `${semSeo} sem slug/título, ${semHashtag} sem hashtags.` 
      },
      { 
        passo: 3, 
        nome: 'Resolução Financeira & Grupos', 
        finalizado: totalBanco - semLocalizacao, 
        processando: semLocalizacao, 
        total: totalBanco, 
        detalhes: `${semLocalizacao} aguardando categorização de grupos.` 
      },
      { 
        passo: 4, 
        nome: 'Scraping Detalhado (Site Caixa)', 
        finalizado: totalBanco - semScraping, 
        processando: semScraping, 
        total: totalBanco, 
        detalhes: `${semScraping} aguardando extração de FGTS e Matrícula.` 
      },
      { 
        passo: 5, 
        nome: 'Matrícula e Cartório', 
        finalizado: totalBanco - semMatricula, 
        processando: semMatricula, 
        total: totalBanco, 
        detalhes: `${semMatricula} aguardando dados de cartório.` 
      },
      { 
        passo: 6, 
        nome: 'Enriquecimento de Localização (CEP)', 
        finalizado: totalBanco - semCep, 
        processando: semCep, 
        total: totalBanco, 
        detalhes: `${semCep} imóveis aguardando processamento de coordenadas e endereço via IA.` 
      },
      { 
        passo: 7, 
        nome: 'Imagens & Vitrine (Capa)', 
        finalizado: totalBanco - semCapa, 
        processando: semCapa, 
        total: totalBanco, 
        detalhes: `${semCapa} sem imagem de destaque na vitrine.` 
      },
    ].map(p => ({
      ...p,
      ok: p.finalizado, 
      percentual: p.total > 0 ? Math.round((p.finalizado / p.total) * 100) : 0,
      status: p.finalizado === p.total ? 'ok' : (p.total > 0 && p.finalizado / p.total >= 0.8) ? 'parcial' : 'critico',
    }))

    const scoreGeral = Math.round(passos.reduce((acc, p) => acc + p.percentual, 0) / passos.length)

    return NextResponse.json({
      arquivo: arquivo.name,
      totalLinhasExcel: rows.length,
      aprovadosFiltros: aprovados.length,
      rejeitadosFiltros: {
        total: rejeitados_todos.length,
        modalidade: rejeitados_modalidade,
        desconto: rejeitados_desconto,
        modalidadesEncontradas: modalidades_encontradas,
        amostra: rejeitados_todos.slice(0, 15).map(i => ({
          numero: i.numero,
          modalidade: i.modalidade,
          desconto: `${i.desconto.toFixed(1)}%`,
          uf: i.uf,
          cidade: i.cidade,
          bairro: i.bairro,
        }))
      },
      novos: {
        total: novos.length,
        amostra: novos.slice(0, 20).map(i => ({
          numero: i.numero,
          uf: i.uf,
          cidade: i.cidade,
          bairro: i.bairro,
          tipo: i.tipo,
          preco: i.preco,
          desconto: `${i.desconto.toFixed(1)}%`,
        }))
      },
      divergentes: {
        total: divergentes.length,
        amostra: divergentes.slice(0, 20).map(i => ({
          numero: i.numero,
          uf: i.uf,
          cidade: i.cidade,
          bairro: i.bairro,
          divergencias: i.divergencias,
        }))
      },
      conformes: {
        total: conformes.length,
      },
      passos: passos,
      scoreGeral,
      totalNoBanco: totalNoBanco || 0,
    })

  } catch (err: any) {
    console.error('[diagnostico-imoveis] Erro:', err)
    return NextResponse.json({ erro: err.message || 'Erro interno do servidor.' }, { status: 500 })
  }
}
