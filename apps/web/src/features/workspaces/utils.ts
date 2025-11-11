export const sanitizeRelativeSegment = (value: string) => value.replace(/\\/g, '/').replace(/^\/+/g, '').trim();

export const combineRelativePaths = (base: string, child: string) => {
  const normalizedBase = sanitizeRelativeSegment(base);
  const normalizedChild = sanitizeRelativeSegment(child);
  if (!normalizedBase) return normalizedChild;
  if (!normalizedChild) return normalizedBase;
  return `${normalizedBase}/${normalizedChild}`;
};

export const buildAbsolutePath = (rootPath: string, relativePath: string) => {
  if (!relativePath) {
    return rootPath;
  }
  const separator = rootPath.includes('\\') ? '\\' : '/';
  const trimmedRoot = rootPath.replace(/[\\/]+$/, '');
  const normalizedRelative = relativePath.replace(/^[\\/]+/, '').replace(/[\\/]+/g, separator);
  return `${trimmedRoot}${separator}${normalizedRelative}`;
};

export const formatDate = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

export const slugifyPath = (value: string) => {
  const sanitized = sanitizeRelativeSegment(value ?? '');
  if (!sanitized) return '';
  return sanitized
    .replace(/[^\w/-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};
