import { useState, useCallback } from 'react';

import {
  createTransferPayload,
  extractTransferFiles,
  parseTransferPayload,
  payloadToJson,
  type FileTransferPayload,
  type ExtractedFile
} from '../utils/payload';

interface UsePayloadTransferReturn {
  isLoading: boolean;
  error: string | null;
  packFiles: (files: File[]) => Promise<{ payload: FileTransferPayload; json: string }>;
  unpackFromClipboard: () => Promise<ExtractedFile[]>;
  unpackFromFile: (payloadFile: File) => Promise<ExtractedFile[]>;
}

export const usePayloadTransfer = (): UsePayloadTransferReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const packFiles = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await createTransferPayload(files);
      const json = payloadToJson(payload);
      return { payload, json };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pack files';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unpackFromClipboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText || !clipboardText.trim()) {
        throw new Error('Clipboard is empty');
      }

      const payload = parseTransferPayload(clipboardText);
      const extractedFiles = await extractTransferFiles(payload);
      return extractedFiles;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unpack from clipboard';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unpackFromFile = useCallback(async (payloadFile: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const payloadText = await payloadFile.text();
      const payload = parseTransferPayload(payloadText);
      const extractedFiles = await extractTransferFiles(payload);
      return extractedFiles;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unpack file';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    packFiles,
    unpackFromClipboard,
    unpackFromFile
  };
};
