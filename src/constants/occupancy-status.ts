export const OCCUPANCY_STATUSES = [
  'not_checked_in',
  'checked_in',
  'checked_out',
] as const

export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number]
