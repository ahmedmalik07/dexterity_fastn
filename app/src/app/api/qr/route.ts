import { NextResponse } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";

/** QR code for the apply link — this is what judges scan during the demo. */
export async function GET(request: Request) {
  const text = new URL(request.url).searchParams.get("text");
  if (!text) return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 });

  const png = await QRCode.toBuffer(text, { width: 600, margin: 2 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" },
  });
}
