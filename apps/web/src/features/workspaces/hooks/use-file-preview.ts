import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';

import { getMediaType, isLikelyBinary } from '../utils';

import type { PreviewMode } from '../types';
import type { MediaType } from '../utils';
import type { WorkspaceFilePreview, WorkspaceMediaPreview } from '@/types/desktop';

interface UseFilePreviewProps {
  getEffectiveRootPath: () => string;
}

interface UseFilePreviewReturn {
  preview: WorkspaceFilePreview | null;
  setPreview: Dispatch<SetStateAction<WorkspaceFilePreview | null>>;
  mediaPreview: WorkspaceMediaPreview | null;
  setMediaPreview: Dispatch<SetStateAction<WorkspaceMediaPreview | null>>;
  mediaType: MediaType;
  setMediaType: Dispatch<SetStateAction<MediaType>>;
  previewMode: PreviewMode;
  setPreviewMode: Dispatch<SetStateAction<PreviewMode>>;
  previewError: string | null;
  setPreviewError: Dispatch<SetStateAction<string | null>>;
  binaryPreview: boolean;
  setBinaryPreview: Dispatch<SetStateAction<boolean>>;
  editMode: boolean;
  setEditMode: Dispatch<SetStateAction<boolean>>;
  editBuffer: string;
  setEditBuffer: Dispatch<SetStateAction<string>>;
  saving: boolean;
  loadPreview: (filePath: string) => Promise<void>;
  clearPreview: () => void;
  handleToggleEditMode: () => void;
  saveEdit: () => Promise<void>;
}

export const useFilePreview = ({ getEffectiveRootPath }: UseFilePreviewProps): UseFilePreviewReturn => {
  const [preview, setPreview] = useState<WorkspaceFilePreview | null>(null);
  const [mediaPreview, setMediaPreview] = useState<WorkspaceMediaPreview | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('text');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [binaryPreview, setBinaryPreview] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');
  const [saving, setSaving] = useState(false);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setMediaPreview(null);
    setMediaType(null);
    setPreviewError(null);
    setBinaryPreview(false);
    setEditMode(false);
  }, []);

  const loadPreview = useCallback(async (filePath: string) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot) {
      setPreviewError('No root path available for preview.');
      return;
    }

    setPreviewError(null);
    setBinaryPreview(false);

    // Check if it's a media file
    const detectedMediaType = getMediaType(filePath);
    if (detectedMediaType !== null) {
      if (!window.api?.readBinaryFile) {
        setPreviewError('Desktop bridge unavailable for media preview.');
        setMediaPreview(null);
        setMediaType(null);
        return;
      }
      
      try {
        const response = await window.api.readBinaryFile({
          rootPath: effectiveRoot,
          relativePath: filePath
        });
        
        if (!response.ok || !response.base64) {
          throw new Error(response.error || 'Unable to load media preview');
        }
        
        // Set all media state together to avoid flicker
        setMediaPreview({
          path: response.path ?? filePath,
          base64: response.base64,
          mimeType: response.mimeType ?? 'application/octet-stream',
          size: response.size ?? 0
        });
        setMediaType(detectedMediaType);
        setPreviewMode('media');
        setPreview(null);
        setEditMode(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to preview media file';
        setPreviewError(message);
        setMediaPreview(null);
        setMediaType(null);
      }
      return;
    }
    
    // Not a media file - clear media state
    setMediaPreview(null);
    setMediaType(null);
    
    if (isLikelyBinary(filePath)) {
      setBinaryPreview(true);
      setPreview(null);
      return;
    }

    if (!window.api?.readTextFile) {
      setPreviewError('Desktop bridge unavailable for preview.');
      return;
    }

    try {
      const response = await window.api.readTextFile({
        rootPath: effectiveRoot,
        relativePath: filePath,
        maxBytes: 512 * 1024
      });
      
      if (!response.ok || typeof response.content !== 'string') {
        throw new Error(response.error || 'Unable to load file preview');
      }
      
      setPreview({
        path: response.path ?? filePath,
        content: response.content,
        truncated: Boolean(response.truncated),
        size: response.size ?? 0
      });
      setPreviewMode('text');
      setEditMode(false);
      setEditBuffer(response.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to preview file';
      setPreviewError(message);
    }
  }, [getEffectiveRootPath]);

  const handleToggleEditMode = useCallback(() => {
    setEditMode((mode) => {
      const next = !mode;
      if (next && preview) {
        setEditBuffer(preview.content);
      }
      return next;
    });
  }, [preview]);

  const saveEdit = useCallback(async () => {
    const effectiveRoot = getEffectiveRootPath();
    if (!editMode || !preview || !effectiveRoot || !window.api?.writeTextFile) return;
    
    setSaving(true);
    try {
      const resp = await window.api.writeTextFile({
        rootPath: effectiveRoot,
        relativePath: preview.path,
        content: editBuffer
      });
      if (!resp.ok) {
        throw new Error(resp.error || 'Failed to save file');
      }
      setPreview((prev) => (prev ? { ...prev, content: editBuffer } : prev));
      setEditMode(false);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to save file');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [editMode, preview, getEffectiveRootPath, editBuffer]);

  return {
    preview,
    setPreview,
    mediaPreview,
    setMediaPreview,
    mediaType,
    setMediaType,
    previewMode,
    setPreviewMode,
    previewError,
    setPreviewError,
    binaryPreview,
    setBinaryPreview,
    editMode,
    setEditMode,
    editBuffer,
    setEditBuffer,
    saving,
    loadPreview,
    clearPreview,
    handleToggleEditMode,
    saveEdit
  };
};
