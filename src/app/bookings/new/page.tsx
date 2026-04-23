import { Suspense } from 'react'
import { NewBookingForm } from '@/components/bookings/new-booking-form'

type NewBookingSearchParams = {
  source?: string
  roomId?: string
  rooms?: string
  roomSelections?: string
}

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<NewBookingSearchParams>
}) {
  const resolvedSearchParams = await searchParams
  const compactFromAvailability = Boolean(
    resolvedSearchParams.source === 'availability' ||
      resolvedSearchParams.roomId ||
      resolvedSearchParams.rooms ||
      resolvedSearchParams.roomSelections
  )

  return (
    <Suspense fallback={null}>
      <NewBookingForm compactFromAvailability={compactFromAvailability} />
    </Suspense>
  )
}
