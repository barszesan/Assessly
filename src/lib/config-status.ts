import { OPENAI_API_KEY, SUPABASE_KEY, SUPABASE_URL } from "astro:env/server";

export interface ConfigStatus {
  name: string;
  configured: boolean;
  message: string;
  docsUrl?: string;
  docsLabel?: string;
}

export const configStatuses: ConfigStatus[] = [
  {
    name: "Supabase",
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    message: "Supabase nie jest skonfigurowany — funkcje uwierzytelniania są wyłączone.",
    docsUrl: "https://github.com/przeprogramowani/10x-astro-starter#supabase-configuration",
    docsLabel: "Zobacz instrukcję konfiguracji",
  },
  {
    name: "OpenAI",
    configured: Boolean(OPENAI_API_KEY),
    message: "OpenAI nie jest skonfigurowany — funkcje AI będą zwracać błąd konfiguracji.",
  },
];

export const missingConfigs = configStatuses.filter((s) => !s.configured);
