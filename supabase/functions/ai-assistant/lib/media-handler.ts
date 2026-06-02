import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from "jsr:@std/encoding/base64";

function getCleanAndValidatedPath(rawPath: string, userId: string): string | null {
  if (!rawPath) return null;
  if (rawPath.includes('..')) {
    const err: any = new Error('Forbidden: Path traversal detected');
    err.status = 403;
    throw err;
  }
  let cleanPath = rawPath;
  if (cleanPath.startsWith('chat-media/')) {
    cleanPath = cleanPath.substring('chat-media/'.length);
  }
  // Remove any leading slashes
  cleanPath = cleanPath.replace(/^\/+/, '');
  
  // RLS Guard: Must start with user.id/
  if (!cleanPath.startsWith(userId + '/')) {
    const err: any = new Error('Forbidden: Access denied to media path');
    err.status = 403;
    throw err;
  }
  return cleanPath;
}

function getMimeType(path: string, blobMimeType?: string): string {
  if (blobMimeType && blobMimeType !== 'application/octet-stream') {
    return blobMimeType;
  }
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'webm': return 'audio/webm';
    case 'mp3': return 'audio/mp3';
    case 'wav': return 'audio/wav';
    case 'ogg': return 'audio/ogg';
    case 'm4a': return 'audio/m4a';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

export async function downloadMediaParts(
  supabaseService: SupabaseClient,
  body: { audioPath?: string; imagePath?: string },
  userId: string
): Promise<any[]> {
  const mediaParts: any[] = [];
  const { audioPath, imagePath } = body;

  if (audioPath) {
    const cleanPath = getCleanAndValidatedPath(audioPath, userId);
    if (cleanPath) {
      console.log(`Downloading audio resource: ${cleanPath}`);
      const { data: fileBlob, error: downloadError } = await supabaseService.storage
        .from('chat-media')
        .download(cleanPath);

      if (downloadError || !fileBlob) {
        throw new Error(`Audio download failed: ${downloadError?.message || 'unknown error'}`);
      }

      const mimeType = getMimeType(cleanPath, fileBlob.type);
      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64Data = encodeBase64(new Uint8Array(arrayBuffer));

      mediaParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    }
  }

  if (imagePath) {
    const cleanPath = getCleanAndValidatedPath(imagePath, userId);
    if (cleanPath) {
      console.log(`Downloading image resource: ${cleanPath}`);
      const { data: fileBlob, error: downloadError } = await supabaseService.storage
        .from('chat-media')
        .download(cleanPath);

      if (downloadError || !fileBlob) {
        throw new Error(`Image download failed: ${downloadError?.message || 'unknown error'}`);
      }

      const mimeType = getMimeType(cleanPath, fileBlob.type);
      const arrayBuffer = await fileBlob.arrayBuffer();
      const base64Data = encodeBase64(new Uint8Array(arrayBuffer));

      mediaParts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    }
  }

  return mediaParts;
}
