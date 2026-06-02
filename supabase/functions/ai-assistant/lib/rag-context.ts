import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';
import { generateEmbedding } from '../../_shared/gemini-client.ts';

export async function buildRagContext(
  supabaseClient: SupabaseClient,
  ai: GoogleGenAI,
  message: string
): Promise<{ contextString: string; citations: any[] }> {
  if (!message || !message.trim()) {
    return { contextString: '', citations: [] };
  }

  try {
    const embedding = await generateEmbedding(ai, message);

    const { data: documents, error: matchError } = await supabaseClient.rpc('hybrid_search', {
      p_query_embedding: embedding,
      p_query_text: message,
      p_match_count: 5
    });

    if (matchError) {
      console.error("hybrid_search RPC error:", matchError);
      return { contextString: '', citations: [] };
    }

    let contextString = "";
    let citations: any[] = [];

    if (documents && documents.length > 0) {
      citations = documents.map((doc: any) => ({
        id: doc.id,
        type: doc.type,
        title: doc.title || (doc.snippet ? (doc.snippet.split(' ').slice(0, 5).join(' ') + '...') : ''),
        similarity: doc.score
      }));

      contextString += "\n\nRelevant Context from User Memory (Hybrid Search):\n";
      documents.forEach((doc: any) => {
        contextString += `- [${doc.type.toUpperCase()}] ${doc.title} (Excerpt: ${doc.snippet}) (ID: ${doc.id})\n`;
      });
    }

    return { contextString, citations };
  } catch (error) {
    console.error("Embedding / Hybrid RAG Error caught gracefully:", error);
    return { contextString: '', citations: [] };
  }
}
