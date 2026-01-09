/// <reference types="vite/client" />

import type { TypedElectronAPI } from '@workspace/shared';

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare global {
  interface Window {
    api?: TypedElectronAPI;
  }
}

export {};
