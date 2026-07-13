import type { ClickRect } from "@workspace/contracts/capture";
import {
  collectAssets,
  resolveCustomization,
  seedInteractiveFromBlocks,
  walkthroughTreeSchema,
  type DraftBlock,
  type DraftDocumentV2,
  type GuideCustomization,
  type WalkthroughItem,
  type WalkthroughTree,
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

/** A published block row with its stable key — the seed source for the
 *  Interactive tree of guides that predate `Guide.interactive`. */
type InteractiveSeedBlock = {
  key: string;
  content: string;
  screenshotUrl: string | null; // R2 key
  clickRect: unknown;
  confidence: number | null;
};

/**
 * Serialize the published Interactive (Walkthrough) tree for a viewer. Uses the
 * stored `Guide.interactive` when valid; otherwise seeds 1:1 from the published
 * blocks so existing guides render identically. Step images are presigned.
 */
export async function serializeInteractive(
  interactive: unknown,
  seedBlocks: InteractiveSeedBlock[]
): Promise<{ items: WalkthroughItemForClient[] }> {
  const parsed = walkthroughTreeSchema.safeParse(interactive);
  const items: WalkthroughItem[] = parsed.success
    ? parsed.data.items
    : seedBlocks.map((b) => ({
        kind: "step" as const,
        key: b.key,
        content: b.content,
        screenshotKey: b.screenshotUrl,
        assetId: b.screenshotUrl ? `a_${b.key}` : null,
        clickRect: (b.clickRect as ClickRect | null) ?? null,
        confidence: b.confidence,
      }));
  const out = await Promise.all(
    items.map(async (it): Promise<WalkthroughItemForClient> =>
      it.kind === "step"
        ? {
            ...it,
            screenshotUrl: it.screenshotKey
              ? await presignGet(it.screenshotKey)
              : null,
          }
        : it
    )
  );
  return { items: out };
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
export function buildDraftDocument(guide: GuideForDraft): DraftDocumentV2 {
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
  const parsedInteractive = walkthroughTreeSchema.safeParse(guide.interactive);
  const interactive: WalkthroughTree = parsedInteractive.success
    ? parsedInteractive.data
    : seedInteractiveFromBlocks(blocks);
  return {
    v: 2,
    title: guide.title,
    summary: guide.summary,
    blocks,
    interactive,
    assets: collectAssets(blocks, interactive),
    customization: resolveCustomization(
      guide.customization as GuideCustomization | null
    ),
  };
}

/** A draft block with a presigned URL for the editor to display. */
type DraftBlockForClient = DraftBlock & { screenshotUrl: string | null };
/** A walkthrough item with presigned URLs on its step images. */
type WalkthroughItemForClient =
  | (Extract<WalkthroughItem, { kind: "step" }> & {
      screenshotUrl: string | null;
    })
  | Exclude<WalkthroughItem, { kind: "step" }>;

/** Presign every screenshot key in the document (List blocks + Interactive step
 *  items) so the editor can render either tree. */
export async function draftDocumentForClient(doc: DraftDocumentV2): Promise<
  Omit<DraftDocumentV2, "blocks" | "interactive"> & {
    blocks: DraftBlockForClient[];
    interactive: { items: WalkthroughItemForClient[] };
  }
> {
  const [blocks, items, customization] = await Promise.all([
    Promise.all(
      doc.blocks.map(async (b) => ({
        ...b,
        screenshotUrl: b.screenshotKey
          ? await presignGet(b.screenshotKey)
          : null,
      }))
    ),
    Promise.all(
      doc.interactive.items.map(async (it): Promise<WalkthroughItemForClient> =>
        it.kind === "step"
          ? {
              ...it,
              screenshotUrl: it.screenshotKey
                ? await presignGet(it.screenshotKey)
                : null,
            }
          : it
      )
    ),
    presignCustomizationMedia(doc.customization),
  ]);
  return {
    ...doc,
    blocks,
    interactive: { items },
    customization: customization as DraftDocumentV2["customization"],
  };
}
