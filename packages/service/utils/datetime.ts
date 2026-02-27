/**
 * The date time formatting utilities across the application.
 *
 * Formatting. The main goal is to provide a consistent and human-readable date
 * time formatting across the app. The app is mainly for users in Hong Kong (HK),
 * so we format the date time in HK time zone (HKT). Other considerations
 * include preventing confusion between month and day - so month name is
 * preferred; preventing confusion between AM and PM, especially time such as
 * 12:00 AM and 12:00 PM - so 24-hour format is preferred; and providing the time
 * zone information to avoid confusion when users are in different time zones.
 *
 * toISO, fromISO. They wrap over Luxon's toISO and fromISO, but it also
 * normalizes the time zone to HKT and locale to HK English. This is to ensure
 * that the date time string in the database is consistent.
 */
import { DateTime } from "luxon";

/**
 * The date time formatter used across the site.
 *
 * It is designed to be human-readable and clear so that users won't confuse the date and time.
 */
const DateTimeFormatter = "LLL dd, yyyy, HH:mm ZZZZ";

/**
 * The date formatter used across the site.
 *
 * It is designed to be human-readable and clear so that users won't confuse the date.
 */
const DateFormatter = "LLL dd, yyyy";

/**
 * The time formatter used across the site.
 *
 * It is designed to be human-readable and clear so that users won't confuse the time.
 */
const TimeFormatter = "HH:mm";

type DateTimeInput = string | DateTime;

export const fromISO = (value: string): DateTime => {
  return DateTime.fromISO(value, { zone: "Asia/Hong_Kong", locale: "en-HK" });
};

export const toISO = (value: DateTime): string => {
  return value.setZone("Asia/Hong_Kong").setLocale("en-HK").toISO() ?? "";
};

const parse = (value: DateTimeInput) =>
  typeof value === "string"
    ? fromISO(value)
    : value.setZone("Asia/Hong_Kong").setLocale("en-HK");

export const formatDate = (value: DateTimeInput) =>
  parse(value).toFormat(DateFormatter);

export const formatTime = (value: DateTimeInput) =>
  parse(value).toFormat(TimeFormatter);

export const formatDateTime = (value: DateTimeInput) =>
  parse(value).toFormat(DateTimeFormatter);
