// Minimal ambient types for `qrcode` (ships no bundled types; @types/qrcode not
// installed). Only the surface we use — the browser data-URL generator.
declare module "qrcode" {
  export interface QRCodeToDataURLOptions {
    width?: number
    margin?: number
    errorCorrectionLevel?: "L" | "M" | "Q" | "H"
    color?: { dark?: string; light?: string }
  }
  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>
  const _default: { toDataURL: typeof toDataURL }
  export default _default
}
