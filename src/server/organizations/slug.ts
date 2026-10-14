/** "Agencia Ñandú & Co." → "agencia-nandu-co". */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || "org";
}
