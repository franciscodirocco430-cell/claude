import { describe, expect, it } from "vitest";
import { applyMapping, CsvError, parseCsv, suggestMapping, validateMapping } from "./csv";

describe("parseCsv", () => {
  it("parsea comas y punto y coma (Excel en español), con BOM y comillas", () => {
    const a = parseCsv('﻿Nombre,Email\n"Gómez, Laura",laura@x.com\n');
    expect(a).toEqual({ headers: ["Nombre", "Email"], rows: [["Gómez, Laura", "laura@x.com"]] });
    const b = parseCsv("Nombre;Teléfono\nMartín;+54 9 11 2345 6789\n\n");
    expect(b.rows).toEqual([["Martín", "+54 9 11 2345 6789"]]);
  });

  it("rechaza archivos vacíos, sin filas o demasiado grandes", () => {
    expect(() => parseCsv("")).toThrow(CsvError);
    expect(() => parseCsv("Nombre,Email\n")).toThrow(/no tiene filas/);
    const big = `Email\n${"a@b.co\n".repeat(5001)}`;
    expect(() => parseCsv(big)).toThrow(/máximo es 5000/);
  });
});

describe("mapeo de columnas", () => {
  it("sugiere por nombre en español e inglés sin repetir campos", () => {
    expect(
      suggestMapping([
        "Nombre",
        "E-mail",
        "Teléfono celular",
        "IG",
        "Sitio Web",
        "Rubro",
        "Otra cosa",
        "Correo",
      ]),
    ).toEqual(["fullName", "email", "phone", "instagram", "website", "industry", null, null]);
  });

  it("valida que el mapeo tenga sentido", () => {
    expect(validateMapping(["email", null], 2)).toBeNull();
    expect(validateMapping([null, null], 2)).toMatch(/al menos una/);
    expect(validateMapping(["email", "email"], 2)).toMatch(/dos veces/);
    expect(validateMapping(["email"], 2)).toMatch(/no coincide/);
  });

  it("aplica el mapeo a una fila", () => {
    expect(applyMapping(["Laura", "x", "laura@x.com"], ["fullName", null, "email"])).toEqual({
      fullName: "Laura",
      email: "laura@x.com",
    });
  });
});
