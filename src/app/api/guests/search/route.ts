import { NextRequest, NextResponse } from 'next/server'
import { getPhoneSearchCandidates, normalizePhone } from '@/lib/phone'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const UNKNOWN_GUEST_NAME = '\u0413\u043e\u0441\u0442\u044c \u0431\u0435\u0437 \u041f\u0406\u0411'
const UNKNOWN_GUEST_BIRTH_DATE = '1900-01-01'

export async function GET(request: NextRequest) {
  try {
    const rawPhone = request.nextUrl.searchParams.get('phone') || ''
    const phone = normalizePhone(rawPhone)

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: '\u041f\u043e\u0442\u0440\u0456\u0431\u043d\u043e \u043f\u0435\u0440\u0435\u0434\u0430\u0442\u0438 \u0442\u0435\u043b\u0435\u0444\u043e\u043d \u0434\u043b\u044f \u043f\u043e\u0448\u0443\u043a\u0443' },
        { status: 400 }
      )
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
      { ok: false, error: error instanceof Error ? error.message : '\u041d\u0435\u0432\u0456\u0434\u043e\u043c\u0430 \u043f\u043e\u043c\u0438\u043b\u043a\u0430' },
      { status: 500 }
    )
  }
}
