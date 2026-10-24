import { useState, useCallback } from 'react';
import { api, ApiRequestError, resolveAssetUrl } from '../../lib/api';
import { apiAdminData, notifyApiDataChanged } from '../../lib/apiData';
const ALLOWED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
async function serverFloorId(id: number | string) {
  const numericId = typeof id === 'number' ? id : /^\d+$/.test(id) ? Number(id) : Number.NaN;
  if (Number.isSafeInteger(numericId)) return numericId;
  const floor = (await apiAdminData.floors()).find(row => row.id === id);
  if (!floor?.api_id) throw new ApiRequestError('The server floor ID is missing. Reload and try again.', 422);
  return floor.api_id;
}
export function useFloorPlanUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = useCallback(async (id: number | string, file: File): Promise<string> => {
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      const failure = new ApiRequestError('Only PNG, JPG, and WebP images are supported.', 422);
      setError(failure.message);
      throw failure;
    }
    setUploading(true);
    try {
      const result = await api.admin.uploadFloorImage(await serverFloorId(id), file);
      notifyApiDataChanged();
      const url = resolveAssetUrl(result.floor_plan_url);
      if (!url) throw new ApiRequestError('The server did not return a floor-plan image URL.', 502);
      return url;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Image upload failed';
      setError(message);
      throw failure instanceof Error ? failure : new Error(message);
    }
    finally { setUploading(false); }
  }, []);
  const removeImage = useCallback(async (id: number | string, _url: string): Promise<void> => {
    setUploading(true); setError(null);
    try {
      await api.admin.removeFloorImage(await serverFloorId(id));
      notifyApiDataChanged();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Image removal failed';
      setError(message);
      throw failure instanceof Error ? failure : new Error(message);
    }
    finally { setUploading(false); }
  }, []);
  return { upload, removeImage, uploading, error };
}
