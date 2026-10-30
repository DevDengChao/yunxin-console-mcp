/**
 * Extracts Cookie headers from a `curl` command copied out of browser DevTools.
 *
 * The old implementation used /[^'"]+/ which stopped at the first quote inside
 * a cookie value (for example `channel="h=media&..."`) and only kept the first
 * matching header. Both behaviours silently dropped cookies such as urs_t and
 * urs_u. This parser tokenizes the command like a shell, keeps inner quotes,
 * merges every `-H 'cookie: ...'` / `-b` argument, and understands the common
 * bash, cmd.exe (`^"`) and PowerShell formats.
 */

export function extractCookieFromCurl(curl: string): string {
  const cmdCookies = extractCmdCookieHeaders(curl);
  if (cmdCookies.length > 0) return cmdCookies.join("; ");

  const text = preprocessCurl(curl);
  const args = splitShellArgs(text);
  const cookies: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-H" || arg === "--header") {
      addHeader(args[index + 1], cookies);
      index += 1;
    } else if (arg.startsWith("--header=")) {
      addHeader(arg.slice("--header=".length), cookies);
    } else if (arg === "-b" || arg === "--cookie") {
      addCookieFlag(args[index + 1], cookies);
      index += 1;
    } else if (arg.startsWith("--cookie=")) {
      addCookieFlag(arg.slice("--cookie=".length), cookies);
    }
  }

  if (cookies.length === 0) {
    collectFallbackCookies(text, cookies);
  }
  if (cookies.length === 0) {
    throw new Error("未能从 cURL 中解析出 Cookie 请求头。");
  }
  return cookies.join("; ");
}

function preprocessCurl(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    // cmd.exe line continuation and escaped quotes.
    .replace(/\^\r?\n/g, " ")
    .replace(/\^"/g, '"')
    // PowerShell line continuation and escaped quotes.
    .replace(/`\r?\n/g, " ")
    .replace(/`"/g, '"');
}

/**
 * Chrome's "Copy as cURL (cmd)" wraps every argument in ^"..."^". Inner
 * quotes in a cookie value are also ^"-escaped, so a plain global replace
 * would lose the argument boundary. Extract those lines greedily instead.
 */
function extractCmdCookieHeaders(input: string): string[] {
  const cookies: string[] = [];
  for (const rawLine of input.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim().replace(/\^\s*$/, "").trim();
    const header = /^(?:-H|--header)\s+\^"(.*)\^"$/i.exec(line);
    if (header) {
      const value = unescapeCmd(header[1]);
      const cookie = /^cookie\s*:\s*([\s\S]*)$/i.exec(value.trim());
      if (cookie?.[1]?.trim()) cookies.push(cookie[1].trim());
      continue;
    }
    const flag = /^(?:-b|--cookie)\s+\^"(.*)\^"$/i.exec(line);
    if (flag) {
      const value = unescapeCmd(flag[1]);
      if (value.includes("=") && !value.startsWith("@")) cookies.push(value);
    }
  }
  return cookies;
}

function unescapeCmd(value: string): string {
  return value.replace(/\^([&|<>^"])/g, "$1");
}

/**
 * A small shell-like tokenizer. Supports single quotes, double quotes,
 * backslash escapes, adjacent quoted segments and cmd/PowerShell escapes that
 * were normalized by preprocessCurl.
 */
export function splitShellArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let started = false;
  let quote: "'" | '"' | null = null;
  let index = 0;

  const push = (): void => {
    if (!started) return;
    args.push(current);
    current = "";
    started = false;
  };

  while (index < input.length) {
    const ch = input[index];

    if (quote === "'") {
      if (ch === "'") {
        quote = null;
      } else {
        current += ch;
      }
      index += 1;
      continue;
    }

    if (quote === '"') {
      if (ch === '"') {
        quote = null;
        index += 1;
        continue;
      }
      if (ch === "\\" && index + 1 < input.length) {
        const next = input[index + 1];
        if (next === '"' || next === "\\" || next === "$" || next === "`") {
          current += next;
          index += 2;
          continue;
        }
      }
      current += ch;
      index += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
      index += 1;
      continue;
    }

    if (ch === "\\" && index + 1 < input.length) {
      const next = input[index + 1];
      if (next === "\n") {
        index += 2;
        continue;
      }
      if (next === "\r" && input[index + 2] === "\n") {
        index += 3;
        continue;
      }
      current += next;
      started = true;
      index += 2;
      continue;
    }

    if (/\s/.test(ch)) {
      push();
      index += 1;
      continue;
    }

    current += ch;
    started = true;
    index += 1;
  }

  push();
  return args;
}

function addHeader(value: string | undefined, cookies: string[]): void {
  if (!value) return;
  const match = /^cookie\s*:\s*([\s\S]*)$/i.exec(value.trim());
  const header = match?.[1]?.trim();
  if (header) cookies.push(header);
}

function addCookieFlag(value: string | undefined, cookies: string[]): void {
  if (!value) return;
  const trimmed = value.trim();
  // curl treats -b without '=' as a cookie file path.
  if (!trimmed.includes("=") || trimmed.startsWith("@")) return;
  cookies.push(trimmed);
}

function collectFallbackCookies(text: string, cookies: string[]): void {
  const header =
    /(?:-H|--header)\s+(?:'([^']*)'|"((?:[^"\\]|\\.)*)")/gi;
  for (const match of text.matchAll(header)) {
    const value = match[1] ?? unescapeDoubleQuoted(match[2] ?? "");
    const cookie = /^\s*cookie\s*:\s*([\s\S]*)$/i.exec(value.trim());
    if (cookie?.[1]?.trim()) cookies.push(cookie[1].trim());
  }
  if (cookies.length > 0) return;

  const flag = /(?:-b|--cookie)\s+(?:'([^']*)'|"((?:[^"\\]|\\.)*)")/gi;
  for (const match of text.matchAll(flag)) {
    const value = match[1] ?? unescapeDoubleQuoted(match[2] ?? "");
    if (value.includes("=") && !value.startsWith("@")) cookies.push(value);
  }
  if (cookies.length > 0) return;

  const loose = /(?:^|\n)\s*cookie\s*:\s*([^\n]+)/gi;
  for (const match of text.matchAll(loose)) {
    const value = match[1].replace(/["']\s*[\\^]*$/, "").trim();
    if (value) cookies.push(value);
  }
}

function unescapeDoubleQuoted(value: string): string {
  return value.replace(/\\(["\\$`])/g, "$1");
}
