import { DeparturesGroups } from '@/components/bookings/departures-groups'
import { isoDateToInputValue } from '@/lib/dates'

export default async function DeparturesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const initialDate = resolvedSearchParams.date ? isoDateToInputValue(resolvedSearchParams.date) : ''

  return <DeparturesGroups initialDate={initialDate} />
}
