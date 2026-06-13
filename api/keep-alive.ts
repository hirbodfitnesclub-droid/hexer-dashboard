import { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage & { headers: Record<string, any> }, res: ServerResponse) {
  // 1. Check authorization header
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader !== 'Bearer MySuperSecretKeepAlive2026!') {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Unauthorized' }));
  }

  // 2. Read Supabase environment variables supportively
  const supabaseUrl = 
    process.env.VITE_ANALYTICS_SUPABASE_URL || 
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL || 
    process.env.SUPABASE_URL ||
    'https://rvgiidesehuaqqncqilu.supabase.co';

  const supabaseAnonKey = 
    process.env.VITE_ANALYTICS_SUPABASE_ANON_KEY || 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    process.env.VITE_SUPABASE_ANON_KEY || 
    process.env.SUPABASE_ANON_KEY ||
    '';

  try {
    // 3. Simple GET request using fetch to the base Supabase REST endpoint
    // to keep the database awake
    const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/`;
    
    // Set headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (supabaseAnonKey) {
      headers['apikey'] = supabaseAnonKey;
      headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
    }

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    const status = response.status;
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ 
      success: true, 
      status, 
      message: 'Keep alive request sent successfully'
    }));
  } catch (error: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ 
      success: false, 
      error: error.message || 'An error occurred' 
    }));
  }
}
