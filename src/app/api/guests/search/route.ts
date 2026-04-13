import { NextRequest, NextResponse } from 'next/server'
import { getPhoneSearchCandidates, normalizePhone } from '@/lib/phone'
import { supabaseAdmin } from '@/lib/supabase/admin'

const UNKNOWN_GUEST_NAME = 'Гість без ПІБ'
const UNKNOWN_GUEST_BIRTH_DATE = '1900-01-01'

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
      .in('phone', getPhoneSearchCandidates(phone))
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ ok: true, guest: null })
    }

    return NextResponse.json({
      ok: true,
      guest: {
        id: data.id,
        full_name: data.full_name === UNKNOWN_GUEST_NAME ? '' : data.full_name || '',
        phone: normalizePhone(data.phone || ''),
        birth_date: data.birth_date === UNKNOWN_GUEST_BIRTH_DATE ? '' : data.birth_date || '',
        guest_note: data.guest_note || '',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Невідома помилка' },
      { status: 500 }
    )
  }
}
