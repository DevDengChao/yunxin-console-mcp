import { AuthExpiredError, FrontApiError } from "../http/client.js";
import { AppResolutionError } from "../api/apps.js";

export interface ToolTextResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function jsonResult(data: unknown, options: { pretty?: boolean } = {}): ToolTextResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, options.pretty === false ? undefined : 2),
      },
    ],
  };
}

export function errorResult(error: unknown): ToolTextResult {
  let message: string;
  if (error instanceof AuthExpiredError) {
    message = error.message;
  } else if (error instanceof FrontApiError) {
    message = `${error.message}${error.requestId ? `（requestId: ${error.requestId}）` : ""}`;
  } else if (error instanceof AppResolutionError) {
    message = error.message;
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = String(error);
  }
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
