import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getGoogleGenAI, generateEmbedding } from '../_shared/gemini-client.ts';
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, id } = payload;
    
    if (!id || !type) {
      console.error("Missing payload required fields (id, type):", payload);
      return new Response(JSON.stringify({ message: "Invalid payload: id or type missing" }), { status: 400, headers: corsHeaders });
    }

    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      SERVICE_ROLE_KEY
    );

    const table = type === 'task' ? 'tasks' : 'notes';

    // بازیابی نسخه جدید رکورد
    const { data: record, error: fetchError } = await supabaseClient
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !record) {
      throw new Error(fetchError ? `Fetch error: ${fetchError.message}` : `Record with id ${id} not found in ${table}`);
    }

    // ساخت ترکیب متنی برای برداری کردن داده
    let combinedText = '';
    if (type === 'task') {
      const title = record.title || '';
      const description = record.description || '';
      const tags = Array.isArray(record.tags) ? record.tags.join(' ') : '';
      combinedText = `${title} ${description} ${tags}`.trim();
    } else {
      const title = record.title || '';
      const content = record.content || '';
      const tags = Array.isArray(record.tags) ? record.tags.join(' ') : '';
      combinedText = `${title} ${content} ${tags}`.trim();
    }

    if (!combinedText) {
      return new Response(JSON.stringify({ message: "Constructed content is empty, skipping vectorization" }), { status: 200, headers: corsHeaders });
    }

    // اجرای امبدینگ هوشمند با متد مشترک و هماهنگِ کل سیستم
    const ai = getGoogleGenAI();
    console.log(`Generating embedding for ${type} ID: ${id} with consistent model...`);
    
    const embeddingValues = await generateEmbedding(ai, combinedText);

    // به‌روزرسانی مقدار برداری رکورد
    const { error: updateError } = await supabaseClient
      .from(table)
      .update({ embedding: embeddingValues })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Supabase DB Error during update: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ message: "Vectorized successfully", length: embeddingValues.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Vectorize Error Details:", error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
