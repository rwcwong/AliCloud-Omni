/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CARTO_API_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_WS_NODE_1?: string;
  readonly VITE_API_WS_NODE_2?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
