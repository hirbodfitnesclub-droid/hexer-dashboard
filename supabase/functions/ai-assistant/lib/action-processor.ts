import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'npm:@google/genai';
import { generateEmbedding } from '../../_shared/gemini-client.ts';

export async function processActions(
  actions: any[],
  supabaseClient: SupabaseClient,
  ai: GoogleGenAI,
  userId: string
): Promise<any[]> {
  const actionResults: any[] = [];
  if (!actions || !Array.isArray(actions)) {
    return actionResults;
  }

  const actionPromises = actions.map(async (item) => {
    const currentAction = item.action;
    const params = item.params || {};

    if (currentAction === 'CHAT' || !currentAction) return;

    try {
      let result = null;

      if (currentAction === 'CREATE_TASK') {
        const taskTitle = params.title || "تسک جدید";
        const { data, error } = await supabaseClient.rpc('create_task_with_tags', {
          p_title: taskTitle,
          p_description: params.description || null,
          p_project_id: params.projectId || null,
          p_due_date: params.dueDate || null,
          p_priority: params.priority || 'medium',
          p_tags: params.tags || []
        });
        if (error) throw error;
        if (data && data.length > 0) {
          result = { type: 'task', operation: 'create', data: data[0] };
        }
      } 
      else if (currentAction === 'CREATE_NOTE') {
        const finalContent = params.content || params.description || "";
        const finalTitle = params.title || (finalContent.length > 20 ? finalContent.substring(0, 20) + "..." : finalContent) || "یادداشت جدید";
        const { data, error } = await supabaseClient.rpc('create_note_with_tags', {
          p_title: finalTitle,
          p_content: finalContent || null,
          p_project_id: params.projectId || null,
          p_tags: params.tags || []
        });
        if (error) throw error;
        if (data && data.length > 0) {
          result = { type: 'note', operation: 'create', data: data[0] };
        }
      }
      else if (currentAction === 'CREATE_PROJECT') {
        const projTitle = params.title || "پروژه جدید";
        const { data, error } = await supabaseClient.from('projects').insert({
          user_id: userId,
          title: projTitle,
          description: params.description || null,
          color: params.color || 'sky',
          priority: params.priority || 'medium'
        }).select().single();
        if (error) throw error;
        if (data) result = { type: 'project', operation: 'create', data: data };
      }
      else if (currentAction === 'CREATE_HABIT') {
        const habitName = params.name || params.title || "عادت جدید";
        const { data, error } = await supabaseClient.from('habits').insert({
          user_id: userId,
          name: habitName,
          description: params.description || null,
          frequency: params.frequency || 'daily',
          target_count: params.target_count || 1
        }).select().single();
        if (error) throw error;
        if (data) result = { type: 'habit', operation: 'create', data: data };
      }
      else if (currentAction === 'SUGGEST_LINK') {
        const queryText = params.queryText || params.query || "";
        if (queryText) {
          const embedVal = await generateEmbedding(ai, queryText);

          const { data: suggestions, error: searchError } = await supabaseClient.rpc('hybrid_search', {
            p_query_embedding: embedVal,
            p_query_text: queryText,
            p_match_count: 5
          });

          if (searchError) throw searchError;

          if (suggestions && suggestions.length > 0) {
            suggestions.forEach((doc: any) => {
              actionResults.push({
                type: doc.type,
                operation: 'suggest_link',
                data: {
                  id: doc.id,
                  title: doc.title,
                  snippet: doc.snippet,
                  score: doc.score
                }
              });
            });
            console.log(`Generated ${suggestions.length} link suggestions via hybrid search.`);
          }
        }
      }

      if (result) {
        actionResults.push(result);
      }
    } catch (actionError) {
      console.error(`Failed to execute action ${currentAction}:`, actionError);
    }
  });

  await Promise.all(actionPromises);
  return actionResults;
}
