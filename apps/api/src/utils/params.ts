/**
 * Safely extract a route param value as a string.
 * In Express 5, req.params values are typed as string | string[].
 * This helper ensures we always get a string.
 */
export function getParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Safely extract a route param value as a string, throwing if undefined.
 */
export function requireParam(value: string | string[] | undefined, name: string): string {
  const result = getParam(value);
  if (!result) {
    throw new Error(`Missing required parameter: ${name}`);
  }
  return result;
}
