import { describe, expect, test } from "bun:test";
import { formatDate, formatDateTime, formatTime } from "../utils/datetime";

describe("datetime formatters", () => {
  test("formatDate prints correct format", () => {
    const value = "2026-01-31T18:00:00+08:00";
    expect(formatDate(value)).toBe("Jan 31, 2026");
  });
  test("formatTime converts to local timezone (HKT) before formatting", () => {
    const value = "2026-01-31T18:00:00+08:00";
    expect(formatTime(value)).toBe("18:00");
  });
  test("formatDateTime converts to local timezone (HKT) before formatting", () => {
    const value = "2026-01-31T18:00:00+08:00";
    expect(formatDateTime(value)).toBe("Jan 31, 2026, 18:00 HKT");
  });
  test("formatDate converts to HKT before formatting", () => {
    const value = "2026-01-31T18:00:00-08:00";
    expect(formatDate(value)).toBe("Feb 01, 2026");
  });
  test("formatTime converts to HKT before formatting", () => {
    const value = "2026-01-31T18:00:00-08:00";
    expect(formatTime(value)).toBe("10:00");
  });
  test("formatDateTime converts to HKT before formatting", () => {
    const value = "2026-01-31T18:00:00-08:00";
    expect(formatDateTime(value)).toBe("Feb 01, 2026, 10:00 HKT");
  });
});
