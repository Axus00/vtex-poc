// Normalización de texto compartida por la publicidad, las marcas y las búsquedas relacionadas.

/** Minúsculas y sin tildes ("Cámara" -> "camara"). */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Minúsculas, sin tildes y separado en palabras ("Zapatos NIKE!" -> ["zapatos", "nike"]). */
export function tokenize(text: string): string[] {
  return foldText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/**
 * Clave para comparar términos de búsqueda sin importar mayúsculas, tildes, espacios
 * ni un plural simple al final ("Camisas" ~ "camisa", "shirts" ~ "shirt").
 */
export function termKey(text: string): string {
  return tokenize(text)
    // "shoes" -> "shoe", "camisas" -> "camisa"; "dress" se queda igual
    .map((token) => (token.length > 3 && !token.endsWith('ss') ? token.replace(/s$/, '') : token))
    .join(' ')
}
