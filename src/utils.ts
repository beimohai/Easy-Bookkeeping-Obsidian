import { normalizePath } from "obsidian";
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

function validDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  return validDateParts(year, month, day) ? { year, month, day } : null;
}

function parseIsoMonth(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]);
  return Number.isInteger(year) && year > 0 && month >= 1 && month <= 12 ? { year, month } : null;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatByTokens(format: string, parts: { year: number; month: number; day?: number }): string {
  return format
    .replace(/YYYY/g, String(parts.year))
    .replace(/MM/g, pad2(parts.month))
    .replace(/DD/g, parts.day === undefined ? "DD" : pad2(parts.day));
}

export function formatDateDisplay(value: string, format: DateDisplayFormat, language: Language = "zh-CN"): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return value;
  if (language !== "zh-CN" && language !== "zh-TW") {
    if (format === "MM月DD日") return localizedDate(value, language, { month: "2-digit", day: "2-digit" }) ?? value;
    if (format === "YYYY年MM月DD日") return localizedDate(value, language, { year: "numeric", month: "2-digit", day: "2-digit" }) ?? value;
  }
  return formatByTokens(format, parsed);
}

export function formatMonthDisplay(value: string, format: YearMonthDisplayFormat, language: Language = "zh-CN"): string {
  const parsed = parseIsoMonth(value);
  if (!parsed) return value;
  if (format === "MMM YYYY" || ((format === "YYYY年MM月") && language !== "zh-CN" && language !== "zh-TW")) {
    const date = `${value}-01`;
    return localizedDate(date, language, { year: "numeric", month: format === "MMM YYYY" ? "short" : "long" }) ?? value;
  }
  return formatByTokens(format, parsed);
}

export function formatWeekdayLabels(language: Language): string[] {
  const formatter = new Intl.DateTimeFormat(LANGUAGE_LOCALES[language], { weekday: "short", timeZone: "UTC" });
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(Date.UTC(2023, 0, 1 + index))).replace(/[.。]$/u, ""));
}

function regexForDateFormat(format: DateDisplayFormat): RegExp {
  const escaped = format.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/YYYY/g, "(?<year>\\d{4})").replace(/MM/g, "(?<month>\\d{2})").replace(/DD/g, "(?<day>\\d{2})");
  return new RegExp(`^${pattern}$`);
}

function parseByDateFormat(text: string, format: DateDisplayFormat): string | null {
  const match = regexForDateFormat(format).exec(text);
  const groups = match?.groups;
  if (!groups) return null;
  const currentYear = new Date().getFullYear();
  const year = groups.year ? Number(groups.year) : currentYear;
  const month = Number(groups.month);
  const day = Number(groups.day);
  return validDateParts(year, month, day) ? `${year}-${pad2(month)}-${pad2(day)}` : null;
}

export function parseDateDisplay(value: string, format: DateDisplayFormat): string | null {
  const text = value.trim();
  if (!text) return null;
  return parseByDateFormat(text, format) ?? (parseIsoDate(text) ? text : null);
}

export function formatTimeDisplay(value: string, format: TimeDisplayFormat): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;
  if (format === "24h") return `${pad2(hour)}:${pad2(minute)}`;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${pad2(displayHour)}:${pad2(minute)} ${period}`;
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
  const date = new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function currentTime(): string {
  const date = new Date();
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function currentMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().replace(/\./g, "-").replace(/\//g, "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  if (!year || !month || !day) return null;
  const result = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return parseIsoDate(result) ? result : null;
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

export function parseNoteTags(input: string): { note: string; tags: string[] } {
  const text = input.trim();
  if (!text) return { note: "", tags: [] };
  const tags: string[] = [];
  let index = 0;
  while (index < text.length) {
    while (/\s/u.test(text[index] ?? "")) index++;
    if (text[index] !== "#") break;
    const start = index + 1;
    let end = start;
    while (end < text.length && !/\s/u.test(text[end] ?? "")) end++;
    const tag = text.slice(start, end).trim();
    if (tag) tags.push(tag);
    index = end;
  }
  while (/\s/u.test(text[index] ?? "")) index++;
  return { note: text.slice(index), tags: uniqueStrings(tags) };
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
