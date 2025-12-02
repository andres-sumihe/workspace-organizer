export const relativeJoin = (base: string, segment: string) => {
  const normalizedBase = base.replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedSegment = segment.replace(/\\/g, '/').replace(/^\//, '');
  if (!normalizedBase) {
    return normalizedSegment;
  }
  return normalizedSegment ? `${normalizedBase}/${normalizedSegment}` : normalizedBase;
};

export const toHex = (text: string, bytesPerLine = 16) => {
  const lines: string[] = [];
  for (let offset = 0; offset < text.length; offset += bytesPerLine) {
    const chunk = text.slice(offset, offset + bytesPerLine);
    const hex = chunk
      .split('')
      .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(' ');
    const ascii = chunk
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0);
        return code >= 32 && code <= 126 ? char : '.';
      })
      .join('');
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex.padEnd(bytesPerLine * 3)}  ${ascii}`);
  }
  return lines.join('\n');
};

const CONTROL_WHITELIST = new Set([0x09, 0x0a, 0x0d, 0x01, 0x02, 0x03, 0x04]);
const SAMPLE_SIZE = 8192;

// Media file extensions
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma']);
const PDF_EXTENSIONS = new Set(['pdf']);

export type MediaType = 'image' | 'video' | 'audio' | 'pdf' | null;

export const getMediaType = (filePath: string): MediaType => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (PDF_EXTENSIONS.has(ext)) return 'pdf';
  return null;
};

export const isMediaFile = (filePath: string): boolean => {
  return getMediaType(filePath) !== null;
};

// Binary file extensions that are NOT media files
const BINARY_EXTENSIONS = new Set([
  'exe', 'dll', 'so', 'dylib', 'bin', 'obj', 'o', 'a', 'lib',
  'zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'class', 'pyc', 'pyo'
]);

export const isBinaryByExtension = (filePath: string): boolean => {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTENSIONS.has(ext) || isMediaFile(filePath);
};

export const isLikelyBinary = (content: string) => {
  if (!content) return false;
  const sample = content.slice(0, SAMPLE_SIZE);
  if (sample.includes('\u0000')) {
    return true;
  }
  const replacementCount = (sample.match(/\ufffd/g) ?? []).length;
  if (replacementCount > 0) {
    return true;
  }
  let suspicious = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const code = sample.charCodeAt(index);
    if (code < 32 && !CONTROL_WHITELIST.has(code)) {
      suspicious += 1;
    }
  }
  return suspicious / sample.length > 0.4;
};

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid date';
  }
};
