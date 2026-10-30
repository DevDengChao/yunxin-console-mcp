import type { AppConfig } from "../config.js";

export function assertWriteAllowed(
  config: AppConfig,
  confirm: boolean | undefined,
  action: string,
  options: { requireConfirm?: boolean } = {},
): void {
  if (!config.allowWrite) {
    throw new Error(
      `写操作已禁用（YUNXIN_CONSOLE_ALLOW_WRITE=false）。如需执行「${action}」，请重新启动 MCP 并设置 YUNXIN_CONSOLE_ALLOW_WRITE=true。`,
    );
  }
  if (options.requireConfirm !== false && !confirm) {
    throw new Error(`「${action}」属于写操作，请在参数中传入 confirm: true 以确认执行。`);
  }
}

const WRITE_HINT =
  /\/(?:operate|open|close|create|update|delete|set|add|edit|publish|refresh|reset|send|confirm|cancel|recover|block|unblock|switch|save|apply|upload|pay|recharge|random|embed|train|preview|downgrade|reopen|remove|modify|change|bind|unbind|start|stop|enable|disable|forbid|resume)(?:[A-Z/]|$)/i;

const READ_HINT =
  /(?:query|list|get|detail|search|stats?|statistic|export|history|records?|count|price|overview|exists|status|download|fivemin|used|balance|guide|banner)(?:[A-Z/]|$)/i;

export function isLikelyReadOnlyPath(path: string): boolean {
  if (WRITE_HINT.test(path)) return false;
  return READ_HINT.test(path);
}
