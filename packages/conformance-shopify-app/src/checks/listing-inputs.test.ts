import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { listingInputs, type ShopifyAppListing } from "./listing-inputs.js";
import { createFixture } from "./test-support.js";

/** A metadata-only test fixture, deliberately not evidence of successfully decoded pixels. */
function pngHeader(width: number, height: number, marker = 0): Buffer {
  const bytes = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 6;
  bytes[32] = marker;
  return bytes;
}

function jpegHeader(width: number, height: number): Buffer {
  const bytes = Buffer.from([255, 216, 255, 224, 0, 4, 0, 0, 255, 192, 0, 11, 8, 0, 0, 0, 0, 1, 1, 17, 0]);
  bytes.writeUInt16BE(height, 13);
  bytes.writeUInt16BE(width, 15);
  return bytes;
}

async function imageFixture(files: Record<string, Buffer>): Promise<string> {
  const root = await createFixture(Object.fromEntries(Object.keys(files).map((name) => [name, ""])));
  for (const [name, bytes] of Object.entries(files)) await writeFile(path.join(root, name), bytes);
  return root;
}

it("does not infer listing assets or missing fields when listing validation is not selected", async () => {
  const root = await createFixture({ "icon.png": "unrelated asset" });
  expect(await listingInputs.run({ root })).toEqual([]);
  expect(await listingInputs.run({ root, listing: {} })).toEqual([]);
});

it.each([null, [], "listing", 42, false].map((value) => [value]))(
  "reports malformed runtime listing input instead of passing or crashing: %j",
  async (value) => {
    const root = await createFixture({});
    expect(await listingInputs.run({ root, listing: value as unknown as ShopifyAppListing })).toEqual([
      expect.objectContaining({
        severity: "error",
        message: expect.stringContaining("nonnull object"),
      }),
    ]);
  },
);

it.each(["png", "jpg"])("reads dimensions from an independently encoded complete %s fixture", async (extension) => {
  const bytes = await readFile(new URL(`./fixtures/listing-icon.${extension}`, import.meta.url));
  const root = await imageFixture({ [`icon.${extension}`]: bytes });
  expect(await listingInputs.run({ root, listing: { appIcon: `icon.${extension}` } })).toEqual([]);
});

it("accepts documented dimensions, three distinct desktop assets, alt text, and exact text boundaries", async () => {
  const root = await imageFixture({
    "icon.png": pngHeader(1200, 1200),
    "one.png": pngHeader(1600, 900, 1),
    "two.png": pngHeader(1600, 900, 2),
    "three.jpg": jpegHeader(1600, 900),
  });
  expect(
    await listingInputs.run({
      root,
      listing: {
        appName: "n".repeat(30),
        introduction: "i".repeat(100),
        details: "d".repeat(500),
        features: ["f".repeat(80)],
        appIcon: "icon.png",
        desktopScreenshots: ["one.png", "two.png", "three.jpg"].map((name) => ({
          path: name,
          alt: "Fixture view",
        })),
      },
    }),
  ).toEqual([]);
});

it.each(["appName", "introduction", "details"] as const)("rejects empty or overlong %s", async (field) => {
  const root = await createFixture({});
  const maximum = { appName: 30, introduction: 100, details: 500 }[field];
  expect(await listingInputs.run({ root, listing: { [field]: " " } })).toHaveLength(1);
  expect(await listingInputs.run({ root, listing: { [field]: "x".repeat(maximum + 1) } })).toHaveLength(1);
});

it("counts Unicode code points and validates each supplied feature", async () => {
  const root = await createFixture({});
  expect(await listingInputs.run({ root, listing: { appName: "🛒".repeat(30) } })).toEqual([]);
  expect(await listingInputs.run({ root, listing: { features: ["", "f".repeat(81)] } })).toHaveLength(2);
});

it("reports wrong image dimensions and missing alt text without guessing image meaning", async () => {
  const root = await imageFixture({
    "icon.jpg": jpegHeader(512, 512),
    "feature.png": pngHeader(1600, 900),
  });
  const findings = await listingInputs.run({
    root,
    listing: { appIcon: "icon.jpg", featureImage: { path: "feature.png", alt: " " } },
  });
  expect(findings).toHaveLength(2);
  expect(findings.some((finding) => finding.message.includes("512×512"))).toBe(true);
});

it("detects identical bytes under different paths", async () => {
  const root = await imageFixture({
    "first.png": pngHeader(1600, 900),
    "copy.png": pngHeader(1600, 900),
    "third.png": pngHeader(1600, 900, 2),
  });
  const findings = await listingInputs.run({
    root,
    listing: {
      desktopScreenshots: ["first.png", "copy.png", "third.png"].map((name) => ({
        path: name,
        alt: "Fixture view",
      })),
    },
  });
  expect(findings).toEqual([
    expect.objectContaining({
      path: "copy.png",
      message: expect.stringContaining("same file bytes"),
    }),
  ]);
});

it.each([0, 2, 7])("rejects a configured desktop screenshot count of %s", async (count) => {
  const root = await imageFixture(
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`${index}.png`, pngHeader(1600, 900, index)])),
  );
  expect(
    await listingInputs.run({
      root,
      listing: {
        desktopScreenshots: Array.from({ length: count }, (_, index) => ({
          path: `${index}.png`,
          alt: "Fixture view",
        })),
      },
    }),
  ).toHaveLength(1);
});

it.each([
  Buffer.from("not an image"),
  pngHeader(1200, 1200).subarray(0, 24),
  jpegHeader(1200, 1200).subarray(0, 14),
  Buffer.from([255, 216, 255, 224, 0, 1, 0, 0]),
  Buffer.from([255, 216, 255, 224, 255, 255, 0, 0]),
])("reports unsupported or truncated image headers", async (bytes) => {
  const root = await imageFixture({ "icon.png": bytes });
  expect(await listingInputs.run({ root, listing: { appIcon: "icon.png" } })).toEqual([
    expect.objectContaining({ message: expect.stringContaining("image header") }),
  ]);
});

it("requires a real project file and rejects paths that escape the repository", async () => {
  const root = await createFixture({});
  expect(await listingInputs.run({ root, listing: { appIcon: "missing.png" } })).toHaveLength(1);
  expect(await listingInputs.run({ root, listing: { appIcon: "../outside.png" } })).toHaveLength(1);
  expect(await listingInputs.run({ root, listing: { appIcon: path.resolve(root, "icon.png") } })).toHaveLength(1);
  expect(await listingInputs.run({ root, listing: { appIcon: "." } })).toHaveLength(1);
});

it("reads JPEG frame metadata after a large application segment without assuming a fixed header offset", async () => {
  const application = Buffer.alloc(65_537);
  application[0] = 255;
  application[1] = 225;
  application.writeUInt16BE(65_535, 2);
  const jpeg = jpegHeader(1200, 1200);
  const root = await imageFixture({
    "icon.jpg": Buffer.concat([jpeg.subarray(0, 2), application, jpeg.subarray(2)]),
  });
  expect(await listingInputs.run({ root, listing: { appIcon: "icon.jpg" } })).toEqual([]);
});

it("accepts five search terms and 25 structured features for each distinct category", async () => {
  const root = await createFixture({});
  const features = Array.from({ length: 25 }, (_, index) => `feature-${index}`);
  expect(
    await listingInputs.run({
      root,
      listing: {
        searchTerms: ["inventory", "stock alerts", "reorders", "suppliers", "purchase orders"],
        structuredFeatures: [
          { category: "inventory", features },
          { category: "purchasing", features },
        ],
      },
    }),
  ).toEqual([]);
});

it("rejects six search terms and a category with 26 features", async () => {
  const root = await createFixture({});
  const findings = await listingInputs.run({
    root,
    listing: {
      searchTerms: Array.from({ length: 6 }, (_, index) => `term-${index}`),
      structuredFeatures: [
        {
          category: "inventory",
          features: Array.from({ length: 26 }, (_, index) => `feature-${index}`),
        },
      ],
    },
  });
  expect(findings).toHaveLength(2);
  expect(findings.some((finding) => finding.message.includes("5 choices"))).toBe(true);
  expect(findings.some((finding) => finding.message.includes("25 choices"))).toBe(true);
});

it.each(["inventory", " Inventory ", "ＩＮＶＥＮＴＯＲＹ"])(
  "does not allow a repeated category to split its feature budget: %s",
  async (category) => {
    const root = await createFixture({});
    const features = Array.from({ length: 13 }, (_, index) => `feature-${index}`);
    expect(
      await listingInputs.run({
        root,
        listing: {
          structuredFeatures: [
            { category: "inventory", features },
            { category, features },
          ],
        },
      }),
    ).toEqual([expect.objectContaining({ message: expect.stringContaining("repeats a category") })]);
  },
);

it("rejects empty category names, empty choices, and sparse choice arrays", async () => {
  const root = await createFixture({});
  expect(
    await listingInputs.run({
      root,
      listing: {
        searchTerms: [" "],
        structuredFeatures: [{ category: " ", features: Array.from({ length: 1 }) }],
      },
    }),
  ).toHaveLength(3);
});

it("accepts six supplied integration names", async () => {
  const root = await createFixture({});
  expect(
    await listingInputs.run({
      root,
      listing: { integrations: Array.from({ length: 6 }, (_, index) => `integration-${index}`) },
    }),
  ).toEqual([]);
});

it("rejects seven integrations", async () => {
  const root = await createFixture({});
  expect(
    await listingInputs.run({
      root,
      listing: { integrations: Array.from({ length: 7 }, (_, index) => `integration-${index}`) },
    }),
  ).toEqual([expect.objectContaining({ message: expect.stringContaining("6 choices") })]);
});

it("rejects a blank integration name", async () => {
  const root = await createFixture({});
  expect(await listingInputs.run({ root, listing: { integrations: [" "] } })).toEqual([
    expect.objectContaining({ message: expect.stringContaining("nonempty strings") }),
  ]);
});
