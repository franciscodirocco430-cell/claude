import { describe, it, expect } from "vitest";
import {
  isPhoneNumber,
  isEmail,
  isExternalUrl,
  isSocialHandle,
  moderateContent,
} from "./moderate-message";

// ============================================================
// Phone Number Tests
// ============================================================
describe("isPhoneNumber", () => {
  it("detects US format with dashes", () => {
    expect(isPhoneNumber("Call me at 555-867-5309")).toBe(true);
  });

  it("detects US format with dots", () => {
    expect(isPhoneNumber("my number: 555.867.5309")).toBe(true);
  });

  it("detects US format with spaces", () => {
    expect(isPhoneNumber("reach me at 555 867 5309")).toBe(true);
  });

  it("detects US format with parentheses", () => {
    expect(isPhoneNumber("(555) 867-5309")).toBe(true);
  });

  it("detects international format +1", () => {
    expect(isPhoneNumber("+1 555 867 5309")).toBe(true);
  });

  it("detects international format +44", () => {
    expect(isPhoneNumber("call +44 20 7946 0958")).toBe(true);
  });

  it("detects compact 10-digit number", () => {
    expect(isPhoneNumber("my number is 5558675309")).toBe(true);
  });

  it("detects number with extension", () => {
    expect(isPhoneNumber("555-867-5309 ext 123")).toBe(true);
  });

  it("does not flag short numbers", () => {
    expect(isPhoneNumber("I have 42 projects done")).toBe(false);
  });

  it("does not flag prices", () => {
    expect(isPhoneNumber("The budget is $500")).toBe(false);
  });

  it("does not flag years", () => {
    expect(isPhoneNumber("Built in 2023")).toBe(false);
  });
});

// ============================================================
// Email Tests
// ============================================================
describe("isEmail", () => {
  it("detects simple email", () => {
    expect(isEmail("contact me at john@example.com")).toBe(true);
  });

  it("detects email with subdomain", () => {
    expect(isEmail("john@mail.example.co.uk")).toBe(true);
  });

  it("detects email with plus sign", () => {
    expect(isEmail("john+work@gmail.com")).toBe(true);
  });

  it("detects email with dots in local part", () => {
    expect(isEmail("john.doe@company.org")).toBe(true);
  });

  it("detects email at start of sentence", () => {
    expect(isEmail("admin@freelie.io is my email")).toBe(true);
  });

  it("does not flag non-email text", () => {
    expect(isEmail("Hello world, no emails here!")).toBe(false);
  });

  it("does not flag incomplete email-like strings", () => {
    expect(isEmail("user@")).toBe(false);
  });

  it("does not flag @mention without domain", () => {
    expect(isEmail("message @johndoe")).toBe(false);
  });
});

// ============================================================
// External URL Tests
// ============================================================
describe("isExternalUrl", () => {
  it("detects external http URL", () => {
    expect(isExternalUrl("visit https://mywebsite.com for more info")).toBe(true);
  });

  it("detects external https URL", () => {
    expect(isExternalUrl("check out https://portfoliosite.net")).toBe(true);
  });

  it("detects Upwork URL (off-platform)", () => {
    expect(isExternalUrl("hire me at https://upwork.com/freelancers/john")).toBe(true);
  });

  it("ALLOWS Google Meet URLs", () => {
    expect(isExternalUrl("Let's meet at https://meet.google.com/abc-defg-hij")).toBe(false);
  });

  it("ALLOWS Google Meet URLs with longer paths", () => {
    expect(isExternalUrl("Join here: https://meet.google.com/xyz-abcd-efg?authuser=0")).toBe(false);
  });

  it("ALLOWS Google Calendar URLs", () => {
    expect(isExternalUrl("Schedule: https://calendar.google.com/calendar/u/0")).toBe(false);
  });

  it("does not flag text without URLs", () => {
    expect(isExternalUrl("Let's chat about the project requirements")).toBe(false);
  });

  it("does not flag incomplete URLs", () => {
    expect(isExternalUrl("the website is www.example.com")).toBe(false);
  });
});

// ============================================================
// Social Handle Tests
// ============================================================
describe("isSocialHandle", () => {
  it("detects Twitter-style @handle", () => {
    expect(isSocialHandle("follow me @johndoe on Twitter")).toBe(true);
  });

  it("detects Telegram username", () => {
    expect(isSocialHandle("message me t.me/johndoe")).toBe(true);
  });

  it("detects Discord username#tag", () => {
    expect(isSocialHandle("add me johndoe#1234")).toBe(true);
  });

  it("detects discord.gg invite", () => {
    expect(isSocialHandle("join discord.gg/myserver")).toBe(true);
  });

  it("detects LinkedIn profile URL", () => {
    expect(isSocialHandle("linkedin.com/in/johndoe")).toBe(true);
  });

  it("detects WhatsApp wa.me link", () => {
    expect(isSocialHandle("whatsapp wa.me/15558675309")).toBe(true);
  });

  it("does not flag regular text mentions", () => {
    expect(isSocialHandle("I'll contact you via the platform")).toBe(false);
  });

  it("does not flag email-like patterns without social context", () => {
    expect(isSocialHandle("the budget@10k range works")).toBe(false);
  });
});

// ============================================================
// moderateContent Integration Tests
// ============================================================
describe("moderateContent", () => {
  it("allows clean messages", () => {
    const result = moderateContent("I can help you build a React app with TypeScript");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("blocks messages with email addresses", () => {
    const result = moderateContent("Send me a message at john@example.com");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("email");
  });

  it("blocks messages with phone numbers", () => {
    const result = moderateContent("Call me at 555-867-5309");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("phone");
  });

  it("blocks messages with social handles", () => {
    const result = moderateContent("follow me @johndoe on Twitter");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("social");
  });

  it("blocks messages with external URLs", () => {
    const result = moderateContent("check my portfolio at https://mysite.com");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("URL");
  });

  it("ALLOWS messages with Google Meet links", () => {
    const result = moderateContent(
      "Let's schedule a call: https://meet.google.com/abc-defg-hij"
    );
    expect(result.allowed).toBe(true);
  });

  it("allows messages with project discussion", () => {
    const result = moderateContent(
      "I've worked with Next.js, React, and Tailwind CSS for 5 years. My rate is $75/hr."
    );
    expect(result.allowed).toBe(true);
  });

  it("blocks messages with Telegram links", () => {
    const result = moderateContent("Message me on Telegram t.me/johndoe");
    expect(result.allowed).toBe(false);
  });

  it("allows messages with numbers in normal context", () => {
    const result = moderateContent("I've completed 42 projects in 2023 with budgets up to $10,000");
    expect(result.allowed).toBe(true);
  });
});
