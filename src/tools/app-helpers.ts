import { resolveApp, type AppSummary } from "../api/apps.js";
import type { ToolContext } from "./auth.js";

export async function resolveAppForTool(
  context: ToolContext,
  app?: string | number,
): Promise<AppSummary> {
  return resolveApp(context.client, {
    app,
    defaultApp: context.config.defaultApp,
  });
}

export function maskSecret(secret: string | undefined): string {
  if (!secret) return "";
  if (secret.length <= 6) return "******";
  return `${secret.slice(0, 3)}******${secret.slice(-3)}`;
}
