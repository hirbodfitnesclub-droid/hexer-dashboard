import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Initialize Supabase client
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      SERVICE_ROLE_KEY
    );

    const table = type === 'task' ? 'tasks' : 'notes';

    // Fetch the latest version of the record with title, content/description and tags
    const { data: record, error: fetchError } = await supabaseClient
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (fetchError || !record) {
        throw new Error(fetchError ? `Fetch error: ${fetchError.message}` : `Record with id ${id} not found in ${table}`);
    }

    // Construct the combined text input representing all searchable context
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
        return new Response(JSON.stringify({ message: "Constructed content is empty, skipping vectorizaton" }), { status: 200, headers: corsHeaders });
    }

    const API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!API_KEY) throw new Error("Missing GEMINI_API_KEY");
    
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // Use explicit structure to avoid parsing issues
    const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: [
            {
                parts: [{ text: combinedText }]
            }
        ],
    });
    
    // Robust Extraction Logic: Check for both plural (embeddings) and singular (embedding)
    let embeddingValues = null;

    if (response.embeddings && response.embeddings.length > 0 && response.embeddings[0].values) {
        embeddingValues = response.embeddings[0].values;
    } else if (response.embedding && response.embedding.values) {
        embeddingValues = response.embedding.values;
    }

    if (!embeddingValues) {
        console.error("Gemini Response Dump:", JSON.stringify(response));
        throw new Error("Failed to generate embedding: No embedding values returned from Gemini (checked both singular and plural paths).");
    }
    
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
