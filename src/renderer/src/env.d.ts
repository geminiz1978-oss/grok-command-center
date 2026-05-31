/// <reference types="vite/client" />

import type { WorkshopApi } from '../../shared/types';

declare global {
  interface Window {
    workshop: WorkshopApi;
  }
}

export {};
