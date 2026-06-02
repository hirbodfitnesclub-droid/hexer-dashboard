import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function buildMetaContext(
  supabaseClient: SupabaseClient,
  mode: string,
  isProposalMode: boolean,
  todayStr: string
): Promise<string> {
  if (isProposalMode) {
    return "";
  }

  const isMetaActive = (mode === 'memory' || mode === 'auto');
  const isActionActive = (mode === 'action' || mode === 'auto');

  if (!isMetaActive && !isActionActive) {
    return "";
  }

  try {
    let metaContext = "\n\nوضعیت فعلی سیستم (تسک‌های فعال و یادداشت‌های اخیر):\n";

    if (isMetaActive) {
      // Fetch pending tasks
      const { data: pendingTasks, error: tasksError } = await supabaseClient
        .from('tasks')
        .select('id, title, due_date, status')
        .neq('status', 'done');

      if (tasksError) {
        console.error("Fetch tasks in buildMetaContext failed:", tasksError);
      }

      const filteredTasks = (pendingTasks || []).filter((t: any) => {
        if (!t.due_date) return true;
        const taskDateStr = new Date(t.due_date).toLocaleDateString('en-CA');
        return taskDateStr === todayStr;
      });

      metaContext += "تسک‌های فعال و در جریان (امروز یا بدون تاریخ مشخص):\n";
      if (filteredTasks.length > 0) {
        filteredTasks.forEach((t: any) => {
          const dueInfo = t.due_date ? `(تاریخ سررسید: ${new Date(t.due_date).toLocaleDateString('fa-IR')})` : "(بدون تاریخ مکتوب)";
          metaContext += `- ${t.title} ${dueInfo} [شناسه تسک: ${t.id}]\n`;
        });
      } else {
        metaContext += "- هیچ تسک فعال یا معلقی برای امروز یا بدون تاریخ یافت نشد.\n";
      }

      // Fetch recent 5 notes
      const { data: recentNotes, error: notesError } = await supabaseClient
        .from('notes')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (notesError) {
        console.error("Fetch notes in buildMetaContext failed:", notesError);
      }

      metaContext += "\nعناوین ۵ یادداشت اخیر کاربر:\n";
      if (recentNotes && recentNotes.length > 0) {
        recentNotes.forEach((n: any) => {
          metaContext += `- ${n.title} [شناسه یادداشت: ${n.id}]\n`;
        });
      } else {
        metaContext += "- هیچ یادداشتی در حافظه اخیر کاربر یافت نشد.\n";
      }
    }

    if (isActionActive) {
      // Fetch active projects to help mapping names/IDs in action calls
      const { data: projects, error: projectsError } = await supabaseClient
        .from('projects')
        .select('id, title');

      if (projectsError) {
        console.error("Fetch projects in buildMetaContext failed:", projectsError);
      }

      if (projects && projects.length > 0) {
        metaContext += `\n\nAvailable Projects (use these UUID values for 'projectId' params): ${JSON.stringify(projects)}`;
      }
    }

    return metaContext;
  } catch (error) {
    console.error("Error gathering Meta-Queries context in buildMetaContext:", error);
    return "";
  }
}
