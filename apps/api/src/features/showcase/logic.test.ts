import assert from "node:assert/strict";

import { videoEmbed } from "@workspace/contracts/showcase";

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}

console.log("showcase logic");

test("videoEmbed: YouTube watch + short URLs", () => {
  assert.deepEqual(videoEmbed("https://www.youtube.com/watch?v=abc123"), {
    provider: "youtube",
    embedUrl: "https://www.youtube.com/embed/abc123",
  });
  assert.deepEqual(videoEmbed("https://youtu.be/abc123"), {
    provider: "youtube",
    embedUrl: "https://www.youtube.com/embed/abc123",
  });
});

test("videoEmbed: Vimeo + Loom", () => {
  assert.deepEqual(videoEmbed("https://vimeo.com/76979871"), {
    provider: "vimeo",
    embedUrl: "https://player.vimeo.com/video/76979871",
  });
  assert.equal(videoEmbed("https://www.loom.com/share/deadbeef").provider, "loom");
  assert.equal(videoEmbed("https://www.loom.com/share/deadbeef").embedUrl, "https://www.loom.com/embed/deadbeef");
});

test("videoEmbed: direct mp4/webm passes through", () => {
  assert.deepEqual(videoEmbed("https://cdn.example.com/clip.mp4"), {
    provider: "mp4",
    embedUrl: "https://cdn.example.com/clip.mp4",
  });
  assert.equal(videoEmbed("https://x.test/a.webm?token=1").provider, "mp4");
});

test("videoEmbed: unknown host → other; garbage → null embed", () => {
  assert.equal(videoEmbed("https://example.com/watch").provider, "other");
  assert.deepEqual(videoEmbed("not a url"), { provider: "other", embedUrl: null });
});

if (failures > 0) {
  console.error(`\n${failures} showcase logic test(s) failed`);
  process.exit(1);
}
console.log("All showcase logic tests passed");
