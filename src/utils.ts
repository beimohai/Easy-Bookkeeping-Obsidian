import { moment, normalizePath } from "obsidian";
import type { DateDisplayFormat, Language, NumberGrouping, TimeDisplayFormat, YearMonthDisplayFormat } from "./types";
export { evaluateAmount } from "./expression";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value: number, currency: string, grouping: NumberGrouping = "wan"): string {
  const sign = value < 0 ? "−" : "";
  const [integer = "0", decimal = "00"] = Math.abs(value).toFixed(2).split(".");
  const size = grouping === "thousand" ? 3 : grouping === "wan" ? 4 : 0;
  const grouped = size ? integer.replace(new RegExp(`\\B(?=(\\d{${size}})+(?!\\d))`, "g"), ",") : integer;
  return `${sign}${currency}${grouped}.${decimal}`;
}

const LANGUAGE_LOCALES: Record<Language, string> = {
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  en: "en-US",
  fr: "fr-FR",
  ru: "ru-RU",
  es: "es-ES",
  ar: "ar-u-ca-gregory",
  ja: "ja-JP",
  ko: "ko-KR",
  de: "de-DE",
  pt: "pt-PT",
  fa: "fa-IR-u-ca-gregory"
};

function localizedDate(value: string, language: Language, options: Intl.DateTimeFormatOptions): string | null {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { ...options, timeZone: "UTC" }).format(date);
}

export function formatDateDisplay(value: string, format: DateDisplayFormat, language: Language = "zh-CN"): string {
  const parsed = moment(value, "YYYY-MM-DD", true);
  if (!parsed.isValid()) return value;
  if (language !== "zh-CN" && language !== "zh-TW") {
    if (format === "MM月DD日") return localizedDate(value, language, { month: "2-digit", day: "2-digit" }) ?? value;
    if (format === "YYYY年MM月DD日") return localizedDate(value, language, { year: "numeric", month: "2-digit", day: "2-digit" }) ?? value;
  }
  return parsed.format(format);
}

export function formatMonthDisplay(value: string, format: YearMonthDisplayFormat, language: Language = "zh-CN"): string {
  const parsed = moment(value, "YYYY-MM", true);
  if (!parsed.isValid()) return value;
  if (format === "MMM YYYY" || ((format === "YYYY年MM月") && language !== "zh-CN" && language !== "zh-TW")) {
    const date = `${value}-01`;
    return localizedDate(date, language, { year: "numeric", month: format === "MMM YYYY" ? "short" : "long" }) ?? value;
  }
  return parsed.format(format);
}

export function formatWeekdayLabels(language: Language): string[] {
  const formatter = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(Date.UTC(2023, 0, 1 + index))).replace(/[.。]$/u, ""));
}

export function parseDateDisplay(value: string, format: DateDisplayFormat): string | null {
  const text = value.trim();
  if (!text) return null;
  const parsed = moment(text, [format, "YYYY-MM-DD"], true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}

export function formatTimeDisplay(value: string, format: TimeDisplayFormat): string {
  const parsed = moment(value, "HH:mm", true);
  if (!parsed.isValid()) return value;
  return format === "12h" ? parsed.format("hh:mm A") : parsed.format("HH:mm");
}

export function errorMessageZh(error: unknown, fallback = "操作失败，请稍后重试"): string {
  const message = error instanceof Error ? error.message.trim() : String(error ?? "").trim();
  if (!message) return fallback;
  if (/folder.*already exists|already exists.*folder/i.test(message)) return "文件夹已存在，请重新扫描后再试";
  if (/file.*already exists|eexist/i.test(message)) return "同名文件已存在，请更换名称后再试";
  if (/not found|enoent|no such file/i.test(message)) return "找不到指定的文件或目录";
  if (/permission|eacces|eperm|denied/i.test(message)) return "没有执行此文件操作的权限";
  if (/invalid.*(?:path|name)|illegal.*(?:path|name)/i.test(message)) return "文件路径或名称不合法";
  if (/network|fetch|timeout/i.test(message)) return "操作超时，请检查环境后重试";
  if (/^[\s【（(]*[\u3400-\u9fff]/.test(message)) return message;
  return fallback;
}

export function today(): string {
  return moment().format("YYYY-MM-DD");
}

export function currentTime(): string {
  return moment().format("HH:mm");
}

export function currentMonth(): string {
  return moment().format("YYYY-MM");
}

export function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return moment(value).format("YYYY-MM-DD");
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().replace(/\./g, "-").replace(/\//g, "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  if (!year || !month || !day) return null;
  const result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return moment(result, "YYYY-MM-DD", true).isValid() ? result : null;
}

export function normalizeTime(value: unknown): string {
  if (typeof value !== "string") return "00:00";
  const match = value.match(/(?:\s|T)(\d{1,2}):(\d{2})/);
  if (!match || !match[1] || !match[2]) return "00:00";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 60) || "未命名";
}

export function safeFolder(path: string): string {
  return normalizePath(path.trim().replace(/^\/+|\/+$/g, ""));
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index++) {
    const character = source[index] ?? "";
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n") {
      row.push(cell.trim().replace(/\r$/, ""));
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  row.push(cell.trim().replace(/\r$/, ""));
  if (row.some((value) => value.length)) rows.push(row);
  return rows;
}
