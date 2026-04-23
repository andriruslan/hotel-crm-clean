import { Suspense } from 'react'
import { NewBookingForm } from '@/components/bookings/new-booking-form'

export default function NewBookingPage() {
  return (
    <Suspense fallback={null}>
      <NewBookingForm />
    </Suspense>
  )
}
