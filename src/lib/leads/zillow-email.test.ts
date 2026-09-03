import { describe, expect, it } from "vitest";
import { isZillowLeadEmail, parseZillowLeadEmail } from "@/lib/leads/zillow-email";

describe("isZillowLeadEmail", () => {
  it("accepts a lead notification from a zillow.com address", () => {
    expect(
      isZillowLeadEmail({
        fromEmail: "leads-noreply@zillow.com",
        subject: "You have a new Zillow lead!",
        textBody: "Name: Jane Doe",
      }),
    ).toBe(true);
  });

  it("accepts a subdomain of zillow.com", () => {
    expect(
      isZillowLeadEmail({
        fromEmail: "notify@mail.zillow.com",
        subject: "New Lead",
        textBody: "Name: Jane Doe",
      }),
    ).toBe(true);
  });

  it("rejects an email that isn't from zillow.com even with lead-like text", () => {
    expect(
      isZillowLeadEmail({
        fromEmail: "someone@notzillow.com",
        subject: "New Lead",
        textBody: "Name: Jane Doe",
      }),
    ).toBe(false);
  });

  it("rejects a non-lead email from zillow.com (e.g. a newsletter)", () => {
    expect(
      isZillowLeadEmail({
        fromEmail: "newsletter@zillow.com",
        subject: "This week's market update",
        textBody: "Home values in your area are up 2%.",
      }),
    ).toBe(false);
  });

  it("rejects a lookalike domain (zillow.com.evil.com)", () => {
    expect(
      isZillowLeadEmail({
        fromEmail: "leads@zillow.com.evil.com",
        subject: "New Lead",
        textBody: "Name: Jane Doe",
      }),
    ).toBe(false);
  });
});

describe("parseZillowLeadEmail", () => {
  it("parses a labeled lead email", () => {
    const result = parseZillowLeadEmail(
      [
        "You have a new lead from Zillow!",
        "",
        "Name: Jane Doe",
        "Phone: (555) 123-4567",
        "Email: jane@example.com",
        "",
        "Message:",
        "I'd like to schedule a showing for 123 Main St this weekend.",
      ].join("\n"),
    );

    expect(result).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      phone: "(555) 123-4567",
      email: "jane@example.com",
      message: "I'd like to schedule a showing for 123 Main St this weekend.",
    });
  });

  it("splits a single-word name into a placeholder last name rather than guessing", () => {
    const result = parseZillowLeadEmail("Name: Madonna\nPhone: 555-123-4567");
    expect(result?.firstName).toBe("Madonna");
    expect(result?.lastName).toBe("(Zillow lead)");
  });

  it("falls back to a bare phone/email in the body when there's no label", () => {
    const result = parseZillowLeadEmail(
      "Name: Jane Doe\nJane can be reached at jane@example.com or (555) 123-4567.",
    );
    expect(result?.email).toBe("jane@example.com");
    expect(result?.phone).toBe("(555) 123-4567");
  });

  it("returns null when no name can be found — never fabricates one", () => {
    expect(parseZillowLeadEmail("Phone: 555-123-4567\nNo name here.")).toBeNull();
  });
});
