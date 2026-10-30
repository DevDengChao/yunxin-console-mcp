import type { AppConfig } from "../config.js";

export function assertWriteAllowed(
  config: AppConfig,
  confirm: boolean | undefined,
  action: string,
): void {
  if (!config.allowWrite) {
    throw new Error(
      `写操作已禁用（YUNXIN_CONSOLE_ALLOW_WRITE=false）。如需执行「${action}」，请重新启动 MCP 并设置 YUNXIN_CONSOLE_ALLOW_WRITE=true。`,
    );
  }
  if (!confirm) {
    throw new Error(`「${action}」属于写操作，请在参数中传入 confirm: true 以确认执行。`);
  }
}

export function isLikelyReadOnlyPath(path: string): boolean {
  return /(?:query|list|get|detail|search|stats?|statistic|info|export|history|records?|count|price|overview|exists|status|download|fivemin|used|balance|guide|banner)(?:[/?]|$)/i.test(
    path,
  );
}
