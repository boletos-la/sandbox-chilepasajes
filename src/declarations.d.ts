declare module "lucide-react";

interface ImportMetaEnv {
  readonly VITE_CHILEPASAJES_BASE_URL?: string;
  readonly VITE_CHILEPASAJES_API_KEY?: string;
  readonly VITE_CHILEPASAJES_COMPLEMENT?: string;
  readonly VITE_CHILEPASAJES_DEVICE?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_DEFAULT_PHONE_PREFIX?: string;
  readonly VITE_HOLD_DURATION_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

