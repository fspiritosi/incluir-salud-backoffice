import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function onlyDigits(s: string) {
  return (s.match(/\d+/g)?.join('') || '')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const id = (searchParams.get('id') || '').trim()
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500)

    const supabase = await createClient()

    let query = supabase
      .from('pacientes')
      .select('id, nombre, apellido, documento, ubicacion')
      .order('apellido', { ascending: true })
      .limit(limit)

    const qDigits = onlyDigits(q)

    if (id) {
      query = query.eq('id', id)
    } else if (q) {
      const tokens = normalize(q).split(' ').filter(Boolean)
      if (qDigits) {
        query = query.ilike('documento', `%${qDigits}%`)
      } else if (tokens.length > 0) {
        // Use first token to narrow down in DB, then filter all tokens in memory
        const t0 = tokens[0]
        query = query.or(
          `apellido.ilike.%${t0}%,nombre.ilike.%${t0}%`
        )
      }
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const normQ = normalize(q)
    const tokens = normQ ? normQ.split(' ').filter(Boolean) : []

    const filtered = (data || []).filter((row) => {
      if (id) return true
      if (!q) return true
      const raw = `${row.apellido} ${row.nombre} ${row.documento || ''}`
      const hay = normalize(raw)
      const hayDigits = onlyDigits(raw)
      const tokensMatch = tokens.every((t) => hay.includes(t))
      const dniMatch = qDigits ? hayDigits.includes(qDigits) : false
      return tokensMatch || dniMatch
    })

    const mapped = filtered.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      apellido: row.apellido,
      documento: row.documento ?? undefined,
      tiene_ubicacion: Boolean(row.ubicacion),
    }))

    return NextResponse.json({ data: mapped })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error buscando pacientes'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
