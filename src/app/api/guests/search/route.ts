import { NextRequest, NextResponse } from 'next/server'
import { normalizePhone } from '@/lib/phone'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const rawPhone = request.nextUrl.searchParams.get('phone') || ''
    const phone = normalizePhone(rawPhone)

    if (!phone) {
      return NextResponse.json({ ok: false, error: 'Потрібно передати телефон для пошуку' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('guests')
      .select('id, full_name, phone, birth_date, guest_note')
      .eq('phone', phone)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, guest: data || null })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}
