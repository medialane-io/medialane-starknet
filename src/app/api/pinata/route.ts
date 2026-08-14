

import { NextRequest, NextResponse } from "next/server";
import { getSiwsWallet } from "@/lib/siws-server";
import { uploadFileToBackend, uploadJsonToBackend } from "@/lib/backend-metadata";
import { APP_URL } from "@/lib/seo";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
  "image/webp",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEMPLATE_FIELDS = 30;
const RESERVED_TRAITS = new Set([
  "creator",
  "ip type",
  "license",
  "commercial use",
  "derivatives",
  "attribution",
  "territory",
  "ai policy",
  "royalty",
  "edition",
  "standard",
  "registration",
]);

export async function POST(req: NextRequest) {
  const authenticatedWallet = getSiwsWallet(req.headers.get("authorization"));
  if (!authenticatedWallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();

    const name = (formData.get("name") as string | null)?.trim();
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const description = (formData.get("description") as string | null) ?? "";
    const externalUrl = (formData.get("external_url") as string | null) ?? APP_URL;
    const creator = authenticatedWallet;

    const ipType = formData.get("ipType") as string | null;
    const licenseType = formData.get("licenseType") as string | null;
    const commercialUse = formData.get("commercialUse") as string | null;
    const derivatives = formData.get("derivatives") as string | null;
    const attribution = formData.get("attribution") as string | null;
    const geographicScope = formData.get("geographicScope") as string | null;
    const aiPolicy = formData.get("aiPolicy") as string | null;
    const rawRoyalty = formData.get("royalty") as string | null;
    const edition = formData.get("edition") as string | null;

    let imageUri: string | null = (formData.get("imageUri") as string | null) || null;

    if (!imageUri) {

      const imageFile = formData.get("file") as File | null;
      if (imageFile && imageFile.size > 0) {
        if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) {
          return NextResponse.json(
            { error: "Unsupported image format. Use JPG, PNG, GIF, SVG, or WebP." },
            { status: 400 }
          );
        }
        if (imageFile.size > MAX_FILE_BYTES) {
          return NextResponse.json(
            { error: "Image exceeds 10 MB limit." },
            { status: 400 }
          );
        }
        const imageUpload = await uploadFileToBackend(imageFile);
        imageUri = imageUpload.uri;
      }
    }

    type Attr = { trait_type: string; value: string };
    const attributes: Attr[] = [];

    if (creator) attributes.push({ trait_type: "Creator", value: creator });
    if (ipType) attributes.push({ trait_type: "IP Type", value: ipType });
    if (licenseType) attributes.push({ trait_type: "License", value: licenseType });
    if (commercialUse) attributes.push({ trait_type: "Commercial Use", value: commercialUse });
    if (derivatives) attributes.push({ trait_type: "Derivatives", value: derivatives });
    if (attribution) attributes.push({ trait_type: "Attribution", value: attribution });
    if (geographicScope) attributes.push({ trait_type: "Territory", value: geographicScope });
    if (aiPolicy) attributes.push({ trait_type: "AI Policy", value: aiPolicy });

    if (rawRoyalty) {
      const num = parseFloat(rawRoyalty.replace("%", ""));
      if (!isNaN(num) && num > 0) {
        attributes.push({ trait_type: "Royalty", value: `${num}%` });
      }
    }

    if (edition) attributes.push({ trait_type: "Edition", value: edition });

    let templateFieldCount = 0;
    const seenTemplateTraits = new Set<string>();
    for (const [key, value] of formData.entries()) {
      if (typeof key === "string" && key.startsWith("tmpl_") && value) {
        if (templateFieldCount >= MAX_TEMPLATE_FIELDS) break;
        const traitType = key.slice(5);
        const cleanTraitType = traitType.trim();
        const cleanValue = String(value).trim();
        const traitKey = cleanTraitType.toLowerCase();
        if (!cleanTraitType || !cleanValue || RESERVED_TRAITS.has(traitKey) || seenTemplateTraits.has(traitKey)) {
          continue;
        }
        seenTemplateTraits.add(traitKey);
        templateFieldCount += 1;
        attributes.push({ trait_type: cleanTraitType, value: cleanValue });
      }
    }

    if (licenseType) {
      attributes.push({ trait_type: "Standard", value: "Berne Convention" });
      attributes.push({
        trait_type: "Registration",
        value: new Date().toISOString().split("T")[0],
      });
    }

    const metadata = {
      name,
      description,
      image: imageUri,
      external_url: externalUrl,
      attributes,
    };

    const metadataUpload = await uploadJsonToBackend(metadata);

    return NextResponse.json({
      uri: metadataUpload.uri,
      imageUri,
      cid: metadataUpload.cid,
    });
  } catch (err: unknown) {
    console.error("[/api/pinata]", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
