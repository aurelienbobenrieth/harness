import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import type { ConformanceCheck, ConformanceFinding } from "../finding.js";

const docs = "https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices";

export type ShopifyListingImage = {
  readonly path: string;
  readonly alt: string;
};

export type ShopifyAppListing = {
  readonly appName?: string;
  readonly introduction?: string;
  readonly details?: string;
  readonly features?: readonly string[];
  readonly searchTerms?: readonly string[];
  readonly integrations?: readonly string[];
  readonly structuredFeatures?: readonly {
    readonly category: string;
    readonly features: readonly string[];
  }[];
  readonly appIcon?: string;
  readonly featureImage?: ShopifyListingImage;
  readonly desktopScreenshots?: readonly ShopifyListingImage[];
};

/**
 * Inspects only explicitly supplied listing fields, image header dimensions, and exact duplicate bytes.
 * @attribution https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices (inspiration; independently implemented)
 * @attribution https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements (inspiration; independently implemented)
 */
export const listingInputs: ConformanceCheck = {
  id: "listing-inputs",
  description:
    "Explicit listing metadata must fit documented lengths, image dimensions and screenshot counts, with alt text and no exact duplicate assets.",
  docs,
  async run(options) {
    const listing = options.listing;
    if (listing === undefined) return [];
    const findings: ConformanceFinding[] = [];
    const report = (message: string, file?: string): void => {
      findings.push({
        check: "listing-inputs",
        severity: "error",
        docs,
        message,
        ...(file === undefined ? {} : { path: file }),
      });
    };
    if (typeof listing !== "object" || listing === null || Array.isArray(listing)) {
      report("listing must be a nonnull object containing the explicitly selected listing fields.");
      return findings;
    }
    function inspectText(value: unknown, label: string, maximum: number): void {
      if (typeof value !== "string" || value.trim() === "") report(`${label} must contain nonempty text.`);
      else if ([...value].length > maximum)
        report(
          `${label} exceeds ${maximum} Unicode code points. Shorten the supplied listing text and verify the platform's character counter.`,
        );
    }
    for (const [field, maximum] of [
      ["appName", 30],
      ["introduction", 100],
      ["details", 500],
    ] as const) {
      if (listing[field] !== undefined) inspectText(listing[field], `listing.${field}`, maximum);
    }
    if (listing.features !== undefined) {
      if (!Array.isArray(listing.features)) report("listing.features must be an array of feature strings.");
      else
        for (const [index, feature] of listing.features.entries())
          inspectText(feature, `listing.features[${index}]`, 80);
    }
    function inspectChoices(value: unknown, label: string, maximum: number): void {
      if (!Array.isArray(value)) {
        report(`${label} must be an array of nonempty strings.`);
        return;
      }
      if (value.length > maximum)
        report(
          `${label} exceeds ${maximum} choices. Keep only the relevant listing choices within the documented limit.`,
        );
      if (Array.from(value).some((entry) => typeof entry !== "string" || entry.trim() === ""))
        report(`${label} must contain only nonempty strings.`);
    }
    if (listing.searchTerms !== undefined) inspectChoices(listing.searchTerms, "listing.searchTerms", 5);
    if (listing.integrations !== undefined) inspectChoices(listing.integrations, "listing.integrations", 6);
    if (listing.structuredFeatures !== undefined) {
      if (!Array.isArray(listing.structuredFeatures))
        report("listing.structuredFeatures must be an array of category and feature declarations.");
      else {
        const categories = new Set<string>();
        for (const [index, entry] of listing.structuredFeatures.entries()) {
          const label = `listing.structuredFeatures[${index}]`;
          if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
            report(`${label} must declare a category and feature array.`);
            continue;
          }
          if (typeof entry.category !== "string" || entry.category.trim() === "")
            report(`${label}.category must contain a nonempty category identifier.`);
          else {
            const category = entry.category.normalize("NFKC").trim().toLowerCase();
            if (categories.has(category))
              report(
                `${label}.category repeats a category. Combine its features into one declaration so its 25-feature limit is evaluated once.`,
              );
            categories.add(category);
          }
          inspectChoices(entry.features, `${label}.features`, 25);
        }
      }
    }
    const images: {
      readonly path: string;
      readonly width: number;
      readonly height: number;
      readonly label: string;
    }[] = [];
    if (listing.appIcon !== undefined)
      images.push({ path: listing.appIcon, width: 1200, height: 1200, label: "listing.appIcon" });
    const addImage = (image: ShopifyListingImage, label: string): void => {
      if (typeof image !== "object" || image === null) {
        report(`${label} must declare a path and alt text.`);
        return;
      }
      if (typeof image.alt !== "string" || image.alt.trim() === "")
        report(`${label}.alt must contain an image description. Describe the image's purpose during review.`);
      images.push({ path: image.path, width: 1600, height: 900, label });
    };
    if (listing.featureImage !== undefined) addImage(listing.featureImage, "listing.featureImage");
    if (listing.desktopScreenshots !== undefined) {
      if (!Array.isArray(listing.desktopScreenshots))
        report("listing.desktopScreenshots must be an array of image declarations.");
      else {
        if (listing.desktopScreenshots.length < 3 || listing.desktopScreenshots.length > 6)
          report("Supply between 3 and 6 desktop screenshots when validating that listing field.");
        for (const [index, screenshot] of listing.desktopScreenshots.entries())
          addImage(screenshot, `listing.desktopScreenshots[${index}]`);
      }
    }
    const projectRoot = await realpath(options.root);
    const hashes = new Map<string, string>();
    for (const image of images) {
      if (typeof image.path !== "string" || image.path.trim() === "" || path.isAbsolute(image.path)) {
        report(`${image.label}.path must name a project-relative image file.`);
        continue;
      }
      const absolute = path.resolve(options.root, image.path);
      const relative = path.relative(path.resolve(options.root), absolute);
      if (!insideProject(relative)) {
        report(`${image.label}.path must stay inside the project.`);
        continue;
      }
      try {
        const resolved = await realpath(absolute);
        if (!insideProject(path.relative(projectRoot, resolved))) {
          report("Listing image resolves outside the project. Keep the selected asset inside the project.", image.path);
          continue;
        }
        const dimensions = await imageDimensions(resolved);
        if (dimensions === undefined)
          report(
            "Cannot establish PNG/JPEG dimensions from this file's image header. Supply a supported image and verify it decodes before upload.",
            image.path,
          );
        else if (dimensions.width !== image.width || dimensions.height !== image.height)
          report(
            `${image.label} header declares ${dimensions.width}×${dimensions.height}; use ${image.width}×${image.height} pixels.`,
            image.path,
          );
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(resolved)) hash.update(chunk);
        const digest = hash.digest("hex");
        const previous = hashes.get(digest);
        if (previous !== undefined)
          report(
            `This asset has exactly the same file bytes as ${previous}. Supply a distinct listing image.`,
            image.path,
          );
        else hashes.set(digest, image.path);
      } catch {
        report(
          "Listing image is missing, unreadable, or not a regular file. Restore the selected asset before checking its dimensions.",
          image.path,
        );
      }
    }
    return findings;
  },
};

function insideProject(relative: string): boolean {
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/**
 * Reads PNG IHDR or JPEG SOF metadata without decoding pixels, PNG CRCs, or JPEG entropy data.
 * Uses bounded positional reads so JPEG application segments need not be loaded into memory.
 * @attribution https://www.w3.org/TR/png-3/ (file format specification; independently implemented)
 * @attribution https://www.w3.org/Graphics/JPEG/itu-t81.pdf (file format specification; independently implemented)
 */
async function imageDimensions(file: string): Promise<{ readonly width: number; readonly height: number } | undefined> {
  const handle = await open(file, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("Expected a regular image file.");
    let cached = Buffer.alloc(0);
    let cachedPosition = 0;
    async function read(position: number, length: number): Promise<Buffer | undefined> {
      if (position + length > stat.size) return undefined;
      if (position < cachedPosition || position + length > cachedPosition + cached.length) {
        const buffer = Buffer.alloc(Math.min(65_536, stat.size - position));
        const result = await handle.read(buffer, 0, buffer.length, position);
        cached = buffer.subarray(0, result.bytesRead);
        cachedPosition = position;
      }
      const offset = position - cachedPosition;
      return offset + length <= cached.length ? cached.subarray(offset, offset + length) : undefined;
    }
    const signature = await read(0, 8);
    if (signature === undefined) return undefined;
    if (signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      const header = await read(8, 25);
      if (header === undefined || header.readUInt32BE(0) !== 13 || header.toString("ascii", 4, 8) !== "IHDR")
        return undefined;
      const width = header.readUInt32BE(8);
      const height = header.readUInt32BE(12);
      return width > 0 && height > 0 ? { width, height } : undefined;
    }
    if (signature[0] !== 255 || signature[1] !== 216) return undefined;
    let position = 2;
    while (position < stat.size) {
      let marker = await read(position++, 1);
      if (marker?.[0] !== 255) return undefined;
      do {
        marker = await read(position++, 1);
      } while (marker?.[0] === 255);
      const code = marker?.[0];
      if (code === undefined || code === 0 || code === 216 || code === 217 || code === 218) return undefined;
      if (code === 1 || (code >= 208 && code <= 215)) continue;
      const lengthBytes = await read(position, 2);
      if (lengthBytes === undefined) return undefined;
      const length = lengthBytes.readUInt16BE(0);
      if (length < 2 || position + length > stat.size) return undefined;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(code)) {
        const frame = await read(position, 8);
        if (frame === undefined || frame[7] === 0 || length !== 8 + 3 * (frame[7] ?? 0)) return undefined;
        const width = frame.readUInt16BE(5);
        const height = frame.readUInt16BE(3);
        return width > 0 && height > 0 ? { width, height } : undefined;
      }
      position += length;
    }
    return undefined;
  } finally {
    await handle.close();
  }
}
