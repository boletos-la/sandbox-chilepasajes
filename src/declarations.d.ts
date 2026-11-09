declare module "lucide-react";

declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_CHILEPASAJES_BASE_URL?: string;
    readonly NEXT_PUBLIC_CHILEPASAJES_API_KEY?: string;
    readonly NEXT_PUBLIC_CHILEPASAJES_COMPLEMENT?: string;
    readonly NEXT_PUBLIC_CHILEPASAJES_DEVICE?: string;
    readonly NEXT_PUBLIC_APP_NAME?: string;
    readonly NEXT_PUBLIC_DEFAULT_PHONE_PREFIX?: string;
    readonly NEXT_PUBLIC_HOLD_DURATION_MINUTES?: string;
  }
}


