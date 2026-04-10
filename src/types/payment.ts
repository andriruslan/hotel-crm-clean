export type Payment = {
  id: string
  booking_id: string
  payment_date: string
  method: 'cash' | 'card'
  amount: number
  comment: string
  created_at: string
}
