import { describe, expect, it } from "vitest";
import { isShowingTimeEmail, parseShowingTimeEmail } from "@/lib/leads/showingtime-email";

describe("isShowingTimeEmail", () => {
  it("accepts a confirmation from a showingtime.com address", () => {
    expect(
      isShowingTimeEmail({
        fromEmail: "noreply@showingtime.com",
        subject: "Showing Confirmed",
        textBody: "Your showing has been confirmed.",
      }),
    ).toBe(true);
  });

  it("accepts a subdomain of showingtime.com", () => {
    expect(
      isShowingTimeEmail({
        fromEmail: "notify@mail.showingtime.com",
        subject: "Showing Request",
        textBody: "A new showing request.",
      }),
    ).toBe(true);
  });

  it("rejects an email that isn't from showingtime.com", () => {
    expect(
      isShowingTimeEmail({
        fromEmail: "someone@notshowingtime.com",
        subject: "Showing Confirmed",
        textBody: "Your showing has been confirmed.",
      }),
    ).toBe(false);
  });

  it("rejects a non-showing email from showingtime.com", () => {
    expect(
      isShowingTimeEmail({
        fromEmail: "billing@showingtime.com",
        subject: "Your invoice",
        textBody: "Your monthly invoice is attached.",
      }),
    ).toBe(false);
  });

  it("rejects a lookalike domain", () => {
    expect(
      isShowingTimeEmail({
        fromEmail: "leads@showingtime.com.evil.com",
        subject: "Showing Confirmed",
        textBody: "Your showing has been confirmed.",
      }),
    ).toBe(false);
  });
});

describe("parseShowingTimeEmail", () => {
  it("parses a fully labeled confirmation", () => {
    const result = parseShowingTimeEmail(
      [
        "Showing Confirmed",
        "",
        "Property Address: 123 Main St, Atlanta, GA 30301",
        "Date: September 15, 2026",
        "Time: 2:30 PM",
        "Buyer Name: Jane Doe",
        "",
        "Notes:",
        "Lockbox code is 4521.",
      ].join("\n"),
    );

    expect(result?.propertyAddress).toBe("123 Main St, Atlanta, GA 30301");
    expect(result?.scheduledAt.toISOString()).toBe("2026-09-15T14:30:00.000Z");
    expect(result?.name).toBe("Jane Doe");
    expect(result?.notes).toBe("Lockbox code is 4521.");
  });

  it("handles a combined Date/Time label", () => {
    const result = parseShowingTimeEmail(
      "Property: 456 Oak Ave\nDate/Time: 09/15/2026 9:00 AM\nAgent Name: John Smith",
    );
    expect(result?.scheduledAt.toISOString()).toBe("2026-09-15T09:00:00.000Z");
    expect(result?.name).toBe("John Smith");
  });

  it("handles 12:00 PM (noon) and 12:00 AM (midnight) correctly", () => {
    const noon = parseShowingTimeEmail("Property: 1 Main St\nDate: 09/15/2026\nTime: 12:00 PM");
    expect(noon?.scheduledAt.toISOString()).toBe("2026-09-15T12:00:00.000Z");

    const midnight = parseShowingTimeEmail("Property: 1 Main St\nDate: 09/15/2026\nTime: 12:00 AM");
    expect(midnight?.scheduledAt.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("falls back to an unlabeled address-looking line", () => {
    const result = parseShowingTimeEmail("789 Elm Street\nDate: 09/15/2026\nTime: 3:00 PM");
    expect(result?.propertyAddress).toBe("789 Elm Street");
  });

  it("defaults to UTC midnight when a date is found but no time", () => {
    const result = parseShowingTimeEmail("Property: 1 Main St\nDate: 09/15/2026");
    expect(result?.scheduledAt.toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("returns null when no property address can be found", () => {
    expect(parseShowingTimeEmail("Date: 09/15/2026\nTime: 2:30 PM\nBuyer: Jane Doe")).toBeNull();
  });

  it("returns null when no date can be found", () => {
    expect(parseShowingTimeEmail("Property: 123 Main St\nBuyer: Jane Doe")).toBeNull();
  });

  it("returns a null name when the email doesn't identify anyone (e.g. Aaron is the listing agent)", () => {
    const result = parseShowingTimeEmail("Property: 123 Main St\nDate: 09/15/2026\nTime: 2:30 PM");
    expect(result?.name).toBeNull();
    expect(result?.propertyAddress).toBe("123 Main St");
  });
});
