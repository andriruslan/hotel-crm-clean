import { DepartureRoomPage } from '@/components/bookings/departure-room-page'
import { isoDateToInputValue } from '@/lib/dates'

export default async function DepartureBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { bookingId } = await params
  const resolvedSearchParams = await searchParams
  const initialDate = resolvedSearchParams.date ? isoDateToInputValue(resolvedSearchParams.date) : ''

  return <DepartureRoomPage bookingId={bookingId} initialDate={initialDate} />
}
