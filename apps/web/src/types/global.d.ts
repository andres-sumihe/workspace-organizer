import type { DesktopApi } from './desktop';

declare global {
  interface Window {
    api?: DesktopApi;
  }
}

export {};
