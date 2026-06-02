import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

export async function getAuthUser(authHeader: string | null): Promise<{ user: any; supabaseClient: SupabaseClient }> {
  if (!authHeader) {
    const error: any = new Error("Missing Authorization header");
    error.status = 401;
    throw error;
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    const authError: any = new Error("Unauthorized");
    authError.status = 401;
    throw authError;
  }

  return { user, supabaseClient };
}
