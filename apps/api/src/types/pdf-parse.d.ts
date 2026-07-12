// pdf-parse's package entry runs debug code when it thinks it's the main
// module, which breaks in ESM. Import the inner lib directly; declare its type.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
  }
  const pdfParse: (data: Buffer) => Promise<PdfParseResult>;
  export default pdfParse;
}
