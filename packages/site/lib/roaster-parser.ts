/** biome-ignore-all lint/complexity/useLiteralKeys: for unified style */

import * as XLSX from "xlsx";
import z from "zod";

export namespace RoasterParser {
  export class RoasterParserError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "RoasterParserError";
    }
  }

  export const RoasterRow = z.object({
    email: z
      .email()
      .meta({
        description: "The user's email address.",
      })
      .min(1, "Email is required."),
    name: z.string().meta({
      description: "The user's full name.",
    }),
  });

  export type RoasterRow = z.infer<typeof RoasterRow>;

  export const Roaster = z.array(RoasterRow).meta({
    description:
      "A list of users' metadata parsed from a roaster format sheet.",
  });

  export type Roaster = z.infer<typeof Roaster>;

  /**
   * Parses a roaster format sheet into a list of users' metadata.
   *
   * The roaster format of a sheet is as follows:
   *
   * Notify, ID, Email Address, Name, Chinese Name, Grade Basis, Units, Program and Plan, Level.
   *
   * - Notify: IDK.
   * - ID: The user's student ID.
   * - Email Address: The user's email address.
   * - Name: The user's full name.
   * - Chinese Name: The user's Chinese name (if applicable).
   * - Grade Basis: The user's grade basis (e.g., "Graded").
   * - Units: The number of units the user is enrolled in.
   * - Program and Plan: The user's program and plan (e.g., "Bachelor of Engineering: 4Y - Bachelor Degree ECE: 4Y").
   * - Level: The user's year of study.
   *
   * This function returns only the email and name of each user.
   *
   * @param data The sheet data as a Blob.
   *
   * @throws RoasterParserError if the sheet is invalid (e.g., no sheets, multiple sheets).
   * @throws z.ZodError if the parsed data does not conform to the expected format.
   *
   * @return A list of users' metadata parsed from the sheet.
   */
  export function parseSheet(data: ArrayBuffer): Roaster {
    const workbook = XLSX.read(data, { type: "array" });
    if (workbook.SheetNames.length === 0) {
      throw new RoasterParserError("There is no sheet in the file.");
    }
    if (workbook.SheetNames.length > 1) {
      throw new RoasterParserError("There are multiple sheets in the file.");
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    return Roaster.parse(
      json
        // biome-ignore lint/suspicious/noExplicitAny: zod verifies the type
        .map((r: any) => ({
          email: r["Email Address"],
          name: r["Name"] ?? "",
        }))
        .filter((r) => r.email),
    );
  }

  /**
   * Parses a text representation of the roaster into a list of users' metadata.
   *
   * The text format is one entry per line. Each line can be either just an email address
   * or an email address followed by a comma and the user's name.
   *
   * Example:
   * ```text
   * user1@example.com
   * user2@example.com, User Two
   * ```
   *
   * @param str The raw text to parse.
   *
   * @throws z.ZodError if the parsed data does not conform to the expected format.
   *
   * @return A list of users' metadata parsed from the text.
   */
  export function parseText(str: string): Roaster {
    const data = str
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => {
        const index = s.indexOf(",");
        if (index === -1) {
          return {
            email: s,
            name: "",
          };
        } else {
          return {
            email: s.slice(0, index).trim(),
            name: s.slice(index + 1).trim(),
          };
        }
      });
    return Roaster.parse(data);
  }
}
