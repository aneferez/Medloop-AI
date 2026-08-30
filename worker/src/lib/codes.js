// Human-typable pairing / invite codes. The alphabet drops characters people
// confuse (0/O, 1/I/L). 10 chars over 32 symbols is ~50 bits of entropy, and 256
// is a multiple of 32 so the byte -> symbol mapping stays unbiased. Shared by
// device pairing (auth) and caregiver invites (family network).

export const LINK_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const LINK_CODE_LENGTH = 10

export function randomLinkCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(LINK_CODE_LENGTH))
  let code = ''
  for (const byte of bytes) code += LINK_CODE_ALPHABET[byte % LINK_CODE_ALPHABET.length]
  return code
}

// Accepts what a person actually types: spaces, dashes and lower case.
export function normalizeLinkCode(raw) {
  const text = String(raw == null ? '' : raw).toUpperCase().replace(/[^0-9A-Z]/g, '')
  return text.length === LINK_CODE_LENGTH && [...text].every((ch) => LINK_CODE_ALPHABET.includes(ch))
    ? text
    : ''
}

// Display form: two groups of five.
export const formatLinkCode = (code) => `${code.slice(0, 5)}-${code.slice(5)}`
