import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("normaliza acentos, eñes y símbolos", () => {
    expect(slugify("Agencia Ñandú & Co.")).toBe("agencia-nandu-co");
    expect(slugify("  Clínica   Dental  ")).toBe("clinica-dental");
  });

  it("nunca devuelve vacío", () => {
    expect(slugify("!!!")).toBe("org");
  });

  it("limita el largo sin dejar guiones colgando", () => {
    const slug = slugify(`${"a".repeat(47)} b`);
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith("-")).toBe(false);
  });
});
