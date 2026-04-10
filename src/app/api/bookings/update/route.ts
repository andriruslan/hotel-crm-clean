import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    ok: true,
    message: 'Booking update API works',
  })
}
