import type { ClickRect } from "@workspace/contracts/capture";
import {
  resolveCustomization,
  type DraftBlock,
  type DraftDocument,
  type GuideCustomization,
} from "@workspace/contracts/guide";
import type { BlockType } from "@workspace/db";
import { presignGet } from "@workspace/storage";

/** A block row as stored (screenshotUrl column holds the R2 key). */
type BlockRow = {
  id: string;
  type: BlockType;
  position: number;
  content: string;
  elementLabel: string | null;
  url: string | null;
  screenshotUrl: string | null; // R2 key
  clickRect: unknown; // normalized { x, y, w, h } | null (Prisma Json)
  confidence: number | null;
};

/**
 * Serialize a block for API responses: the stored R2 key becomes both the
 * raw `screenshotKey` (for the editor's round-trip on save) and a presigned
 * `screenshotUrl` (for immediate display).
 */
export async function serializeBlock(block: BlockRow) {
  const key = block.screenshotUrl;
  return {
    id: block.id,
    type: block.type,
    position: block.position,
    content: block.content,
    screenshotKey: key,
    screenshotUrl: key ? await presignGet(key) : null,
    elementLabel: block.elementLabel,
    url: block.url,
    clickRect: (block.clickRect as ClickRect | null) ?? null,
    confidence: block.confidence,
  };
}

export function serializeBlocks(blocks: BlockRow[]) {
  return Promise.all(blocks.map(serializeBlock));
}

/**
 * Serialize a guide's customization for clients: presign the stored logo key
 * into a display-only `brand.logoUrl` (like screenshots). The raw `logoKey`
 * stays so the editor round-trips it on save; the presigned URL is never
 * persisted (see the PATCH handler, which nulls it before writing).
 */
/** Presign a customization's media keys (logo + background music) into their
 *  display URLs. The keys stay; the URLs are display-only. */
async function presignCustomizationMedia(c: unknown): Promise<unknown> {
  if (!c || typeof c !== "object") return c;
  const cust = c as {
    brand?: { logoKey?: string | null };
    walkthroughView?: { backgroundMusic?: { key?: string | null } };
  };
  const logoKey = cust.brand?.logoKey ?? null;
  const musicKey = cust.walkthroughView?.backgroundMusic?.key ?? null;
  const [logoUrl, musicUrl] = await Promise.all([
    logoKey ? presignGet(logoKey) : Promise.resolve(null),
    musicKey ? presignGet(musicKey) : Promise.resolve(null),
  ]);
  return {
    ...cust,
    brand: { ...cust.brand, logoUrl },
    walkthroughView: {
      ...cust.walkthroughView,
      backgroundMusic: {
        ...cust.walkthroughView?.backgroundMusic,
        url: musicUrl,
      },
    },
  };
}

export async function serializeCustomization(
  raw: unknown
): Promise<unknown | null> {
  if (!raw || typeof raw !== "object") return null;
  return presignCustomizationMedia(raw);
}

export const blockSelect = {
  id: true,
  key: true,
  type: true,
  position: true,
  content: true,
  elementLabel: true,
  url: true,
  screenshotUrl: true,
  clickRect: true,
  confidence: true,
} as const;

// ── Draft documents ────────────────────────────────────────────────────────

/** Prisma select for building a draft from a guide's published content. */
export const draftSourceSelect = {
  title: true,
  summary: true,
  customization: true,
  blocks: {
    orderBy: { position: "asc" },
    select: {
      key: true,
      type: true,
      content: true,
      elementLabel: true,
      url: true,
      screenshotUrl: true, // R2 key
      clickRect: true,
      confidence: true,
    },
  },
} as const;

type GuideForDraft = {
  title: string;
  summary: string | null;
  customization: unknown;
  blocks: Array<{
    key: string;
    type: BlockType;
    content: string;
    elementLabel: string | null;
    url: string | null;
    screenshotUrl: string | null; // R2 key
    clickRect: unknown;
    confidence: number | null;
  }>;
};

/**
 * Build the canonical draft document from a guide's published content. Used
 * both to seed a fresh draft and to compare against an existing draft for the
 * dirty check — so the two are always built the same way.
 */
export function buildDraftDocument(guide: GuideForDraft): DraftDocument {
  return {
    v: 1,
    title: guide.title,
    summary: guide.summary,
    blocks: guide.blocks.map((b) => ({
      key: b.key,
      type: b.type,
      content: b.content,
      screenshotKey: b.screenshotUrl, // column stores the key
      elementLabel: b.elementLabel,
      url: b.url,
      clickRect: (b.clickRect as ClickRect | null) ?? null,
      confidence: b.confidence,
    })),
    customization: resolveCustomization(
      guide.customization as GuideCustomization | null
    ),
  };
}

/** A draft block with a presigned URL for the editor to display. */
type DraftBlockForClient = DraftBlock & { screenshotUrl: string | null };

/** Presign each block's screenshot key so the editor can render it. */
export async function draftDocumentForClient(
  doc: DraftDocument
): Promise<Omit<DraftDocument, "blocks"> & { blocks: DraftBlockForClient[] }> {
  const [blocks, customization] = await Promise.all([
    Promise.all(
      doc.blocks.map(async (b) => ({
        ...b,
        screenshotUrl: b.screenshotKey
          ? await presignGet(b.screenshotKey)
          : null,
      }))
    ),
    presignCustomizationMedia(doc.customization),
  ]);
  return {
    ...doc,
    blocks,
    customization: customization as DraftDocument["customization"],
  };
}
