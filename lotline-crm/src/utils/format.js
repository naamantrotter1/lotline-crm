/** Format a phone number string as (XXX) XXX-XXXX.
 *  Handles 10-digit US numbers and 11-digit with leading 1.
 *  Returns the original string unchanged if it can't be parsed. */
export function fmtPhone(raw) {
  if (!raw) return raw;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  return raw; // return as-is if unrecognized format
}
