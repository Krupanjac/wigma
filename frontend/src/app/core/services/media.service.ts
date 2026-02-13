import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import type { DbMediaFile, MediaFileInsert } from '@wigma/shared';

/**
 * Media service — handles file uploads to Supabase Storage
 * and metadata tracking in the media_files table.
 *
 * Storage structure:
 *   media/{projectId}/{fileId}.{ext}
 *
 * Files are uploaded to the "media" Supabase Storage bucket,
 * and a metadata row is inserted for querying/listing.
 */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly supa = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  /**
   * Upload a file to Supabase Storage and record metadata.
   *
   * @param projectId - Project this media belongs to
   * @param file - The file blob to upload
   * @param dimensions - Optional width/height for images/videos
   * @returns The public URL of the uploaded file and metadata record
   */
  async upload(
    projectId: string,
    file: File,
    dimensions?: { width: number; height: number }
  ): Promise<{ url: string; media: DbMediaFile } | { error: string }> {
    const userId = this.auth.user()?.id;
    if (!userId) return { error: 'Not authenticated' };

    // Generate unique storage path
    const ext = file.name.split('.').pop() ?? 'bin';
    const fileId = crypto.randomUUID();
    const storagePath = `${projectId}/${fileId}.${ext}`;

    // 1. Upload to Storage bucket
    const { error: uploadError } = await this.supa.supabase.storage
      .from('media')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { error: `Upload failed: ${uploadError.message}` };
    }

    // 2. Get public URL
    const { data: urlData } = this.supa.supabase.storage
      .from('media')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // 3. Insert metadata row
    const insert: MediaFileInsert = {
      project_id: projectId,
      uploader_id: userId,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
    };

    const { data, error: dbError } = await this.supa.supabase
      .from('media_files')
      .insert(insert as any)
      .select()
      .single();

    if (dbError) {
      // Cleanup: remove the uploaded file if DB insert fails
      await this.supa.supabase.storage.from('media').remove([storagePath]);
      return { error: `Metadata insert failed: ${dbError.message}` };
    }

    return {
      url: publicUrl,
      media: data as unknown as DbMediaFile,
    };
  }

  /** List all media files for a project. */
  async listMedia(projectId: string): Promise<{ data: DbMediaFile[]; error: string | null }> {
    const { data, error } = await this.supa.supabase
      .from('media_files')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    return {
      data: (data as unknown as DbMediaFile[]) ?? [],
      error: error?.message ?? null,
    };
  }

  /** Delete a media file (storage + metadata). */
  async deleteMedia(media: DbMediaFile): Promise<{ error: string | null }> {
    // Remove from storage
    const { error: storageError } = await this.supa.supabase.storage
      .from('media')
      .remove([media.storage_path]);

    if (storageError) {
      return { error: `Storage delete failed: ${storageError.message}` };
    }

    // Remove metadata row
    const { error: dbError } = await this.supa.supabase
      .from('media_files')
      .delete()
      .eq('id', media.id);

    return { error: dbError?.message ?? null };
  }

  /**
   * Get image dimensions from a File.
   * Returns null if file is not an image or can't be read.
   */
  getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(null);
        return;
      }

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };

      img.src = url;
    });
  }
}
