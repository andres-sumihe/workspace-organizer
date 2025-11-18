export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatScriptType = (type: string): string => {
  const typeMap: Record<string, string> = {
    batch: 'Batch Script',
    powershell: 'PowerShell',
    shell: 'Shell Script',
    other: 'Other'
  };
  return typeMap[type] || type;
};

export const getScriptTypeColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    batch: 'bg-blue-500',
    powershell: 'bg-purple-500',
    shell: 'bg-green-500',
    other: 'bg-gray-500'
  };
  return colorMap[type] || 'bg-gray-500';
};

export const highlightSearchTerm = (text: string, searchQuery: string): string => {
  if (!searchQuery) return text;
  const regex = new RegExp(`(${searchQuery})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
};
