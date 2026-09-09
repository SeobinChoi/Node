import { NextRequest } from "next/server";
import { z } from "zod";
import { buildOpsRadarHwpx } from "@/lib/demo/export-ops-radar-hwpx";

const hasXmlControlCharacter = (value: string) => /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
const RequestSchema = z.object({
  title: z.string().min(1).max(100).refine((value) => !hasXmlControlCharacter(value)),
  text: z.string().min(1).max(12000)
    .refine((value) => !hasXmlControlCharacter(value))
    .refine((value) => (value.match(/\n/g)?.length ?? 0) < 200),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 12;

function checkRateLimit(request: NextRequest) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local-demo";
  const now = Date.now();
  const current = rateLimitMap.get(key);
  if (!current || now > current.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT_MAX) return false;
  current.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(request)) {
      return Response.json({ error: "Too many export requests. Please wait a minute." }, { status: 429 });
    }
    if (Number(request.headers.get("content-length") || 0) > 80000) {
      return Response.json({ error: "HWPX export payload is too large" }, { status: 413 });
    }
    const { title, text } = RequestSchema.parse(await request.json());
    const bytes = await buildOpsRadarHwpx(title, text);
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": "application/vnd.hancom.hwpx",
        "Content-Disposition": 'attachment; filename="ops-radar-report.hwpx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json({ error: "Invalid HWPX export payload" }, { status: 400 });
    }
    console.error("Ops Radar HWPX export failed", error instanceof Error ? error.name : "UnknownError");
    return Response.json({ error: "Failed to create HWPX report" }, { status: 500 });
  }
}
