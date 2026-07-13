import type { ClickRect } from "@workspace/contracts/capture";
import {
  collectBlockAssets,
  readInteractivePresentation,
  resolveCustomization,
  type DraftBlock,
  type DraftDocumentV3,
  type GuideCustomization,
  type InteractivePresentation,
} from "@workspace/contracts/guide";
import type { BlockType } from "@workspace/db";
import { presignGet } from "@workspace/storage";

/** A block row as stored (screenshotUrl column holds the R2 key). */
type BlockRow = {
  id: string;
  key: string;
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
 * `screenshotUrl` (for immediate display). `key` (stable Step identity) lets the
 * Interactive renderer match slide anchors + per-step presentation.
 */
export async function serializeBlock(block: BlockRow) {
  const shotKey = block.screenshotUrl;
  return {
    id: block.id,
    key: block.key,
    type: block.type,
    position: block.position,
    content: block.content,
    screenshotKey: shotKey,
    screenshotUrl: shotKey ? await presignGet(shotKey) : null,
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
 * The published Interactive *presentation* (Intro/Chapter slides + per-step
 * presentation) for a viewer. Reads a v3 presentation or migrates a legacy v2
 * tree; a guide with no interactive data yields an empty presentation (the
 * renderer shows the shared Steps alone). Step content/screenshots are NOT
 * duplicated here — they come from the shared blocks — and slides carry no
 * images today, so nothing needs presigning.
 */
export function serializeInteractive(
  interactive: unknown
): InteractivePresentation {
  return readInteractivePresentation(interactive);
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
  interactive: true,
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
  interactive: unknown; // WalkthroughTree JSON | null
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
 * Build the canonical v2 draft document from a guide's published content. Used
 * both to seed a fresh draft and to compare against an existing draft for the
 * dirty check — so the two are always built the same way. The Interactive tree
 * comes from `Guide.interactive` when present (independent, previously
 * published), else it's seeded 1:1 from the List blocks (existing guides look
 * unchanged until edited).
 */
export function buildDraftDocument(guide: GuideForDraft): DraftDocumentV3 {
  const blocks: DraftBlock[] = guide.blocks.map((b) => ({
    key: b.key,
    type: b.type,
    content: b.content,
    screenshotKey: b.screenshotUrl, // column stores the key
    assetId: null, // filled by collectAssets/migrate consumers
    elementLabel: b.elementLabel,
    url: b.url,
    clickRect: (b.clickRect as ClickRect | null) ?? null,
    confidence: b.confidence,
  }));
  // Assign asset ids to blocks (mirrors migrate-on-read so the dirty check
  // compares like-for-like).
  for (const b of blocks) {
    b.assetId = b.screenshotKey ? `a_${b.key}` : null;
  }
  return {
    v: 3,
    title: guide.title,
    summary: guide.summary,
    blocks,
    // The Interactive presentation (slides + per-step overrides); step content
    // and screenshots come from `blocks`.
    interactive: readInteractivePresentation(guide.interactive),
    assets: collectBlockAssets(blocks),
    customization: resolveCustomization(
      guide.customization as GuideCustomization | null
    ),
  };
}

/** A draft block with a presigned URL for the editor to display. */
type DraftBlockForClient = DraftBlock & { screenshotUrl: string | null };

/** Presign every Step screenshot so the editor can render it. The Interactive
 *  presentation carries no images, so it passes through unchanged. */
export async function draftDocumentForClient(doc: DraftDocumentV3): Promise<
  Omit<DraftDocumentV3, "blocks"> & { blocks: DraftBlockForClient[] }
> {
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
    customization: customization as DraftDocumentV3["customization"],
  };
}
