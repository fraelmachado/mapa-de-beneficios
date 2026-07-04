export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugify(s: string): string {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function sourceFingerprint(slug: string): string {
  return `source|${slug}`
}

export function sourceItemFingerprint(sourceSlug: string, label: string): string {
  return `source_item|${sourceSlug}|${slugify(label)}`
}

export function benefitFingerprint(sourceItemSlug: string, title: string): string {
  return `benefit|${sourceItemSlug}|${slugify(title)}`
}
