import type { ClickRect } from "@workspace/contracts/capture";
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

export const blockSelect = {
  id: true,
  type: true,
  position: true,
  content: true,
  elementLabel: true,
  url: true,
  screenshotUrl: true,
  clickRect: true,
  confidence: true,
} as const;
