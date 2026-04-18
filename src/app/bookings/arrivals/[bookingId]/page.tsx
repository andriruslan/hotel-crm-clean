import { ArrivalRoomPage } from '@/components/bookings/arrival-room-page'
import { isoDateToInputValue } from '@/lib/dates'

export default async function ArrivalBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { bookingId } = await params
  const resolvedSearchParams = await searchParams
  const initialDate = resolvedSearchParams.date ? isoDateToInputValue(resolvedSearchParams.date) : ''

  return <ArrivalRoomPage bookingId={bookingId} initialDate={initialDate} />
}
