import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')

  if (!fs.existsSync(envPath)) {
    return
  }

  const content = fs.readFileSync(envPath, 'utf8')

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')

    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadLocalEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const shouldRun = process.argv.includes('--yes')

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables.')
  process.exit(1)
}

if (!shouldRun) {
  console.log('Run with confirmation: npm run reset:bookings -- --yes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)
const chunkSize = 500

async function fetchBookingIds() {
  return fetchIds('bookings')
}

async function fetchGuestIds() {
  return fetchIds('guests')
}

async function fetchIds(table) {
  const ids = []
  let from = 0

  while (true) {
    const to = from + chunkSize - 1
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .order('id', { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    ids.push(...data.map((item) => item.id))

    if (data.length < chunkSize) {
      break
    }

    from += chunkSize
  }

  return ids
}

async function deleteInChunks(table, column, ids) {
  for (let index = 0; index < ids.length; index += chunkSize) {
    const slice = ids.slice(index, index + chunkSize)

    const { error } = await supabase
      .from(table)
      .delete()
      .in(column, slice)

    if (error) {
      throw error
    }
  }
}

async function main() {
  const bookingIds = await fetchBookingIds()

  if (bookingIds.length > 0) {
    await deleteInChunks('payments', 'booking_id', bookingIds)
    await deleteInChunks('bookings', 'id', bookingIds)
  }

  const guestIds = await fetchGuestIds()

  if (guestIds.length > 0) {
    await deleteInChunks('guests', 'id', guestIds)
  }

  console.log(`Deleted ${bookingIds.length} bookings, related payments, and ${guestIds.length} guests.`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
