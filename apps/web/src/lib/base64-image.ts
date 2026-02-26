const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Reads a File as a base64 data URL.
 * Used for team/shared contexts where images are embedded inline
 * (stored in PostgreSQL) instead of uploaded to the local filesystem.
 */
export function readFileAsBase64(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    return Promise.reject(new Error('Image must be under 5 MB'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
