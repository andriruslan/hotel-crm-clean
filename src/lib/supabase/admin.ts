import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseAdminInstance: SupabaseClient | null = null

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('На сервері не задано NEXT_PUBLIC_SUPABASE_URL. Додай цю змінну у Vercel Environment Variables.')
  }

  if (!serviceRoleKey) {
    throw new Error('На сервері не задано SUPABASE_SERVICE_ROLE_KEY. Додай цю змінну у Vercel Environment Variables.')
  }

  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey)
  }

  return supabaseAdminInstance
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = getSupabaseAdmin()
    const value = Reflect.get(client, property, receiver)

    if (typeof value === 'function') {
      return value.bind(client)
    }

    return value
  },
})
