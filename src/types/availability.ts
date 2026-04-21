export type AvailabilityItem = {
  room_id: string
  room_number: string
  building_name: string
  room_type_name: string
  base_capacity: number
  max_capacity: number
  base_price_per_night: number
  extra_bed_price_per_night: number
  guests_count: number
  nights: number
  extra_beds_count: number
  free_extra_beds_count: number
  price_base_total: number
  price_extra_total: number
  price_total: number
  free_dates: string[]
  occupied_booking_ids_by_date: Record<string, string>
  free_dates_count: number
  is_fully_available: boolean
}
