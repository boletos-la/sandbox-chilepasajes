import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = (
  process.env.CHILEPASAJES_BASE_URL ||
  process.env.NEXT_PUBLIC_CHILEPASAJES_BASE_URL ||
  ""
).replace(/\/+$/, "");

const API_KEY = (
  process.env.CHILEPASAJES_API_KEY ||
  process.env.NEXT_PUBLIC_CHILEPASAJES_API_KEY ||
  ""
).trim();

async function handleProxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!BASE_URL || !API_KEY) {
    return NextResponse.json(
      {
        error: "Configuración incompleta",
        message: "Las variables de entorno CHILEPASAJES_BASE_URL y CHILEPASAJES_API_KEY son obligatorias y no están definidas.",
      },
      { status: 500 }
    );
  }

  const { path } = await context.params;
  const pathStr = Array.isArray(path) ? path.join("/") : "";
  const urlObj = new URL(req.url);
  const search = urlObj.search || "";
  const targetUrl = `${BASE_URL}/${pathStr}${search}`;

  const forwardHeaders: Record<string, string> = {
    Accept: req.headers.get("accept") || "application/json",
  };

  const contentType = req.headers.get("content-type");
  if (contentType) {
    forwardHeaders["Content-Type"] = contentType;
  }

  // La API Key se inyecta de forma 100% segura únicamente en el servidor
  if (!pathStr.includes("payment/notification")) {
    forwardHeaders["Authorization"] = `Bearer ${API_KEY}`;
  }

  let body: BodyInit | undefined = undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      cache: "no-store",
    });

    const upstreamContentType = upstreamRes.headers.get("content-type") || "";
    const resHeaders = new Headers();
    if (upstreamContentType) {
      resHeaders.set("Content-Type", upstreamContentType);
    }

    const data = await upstreamRes.arrayBuffer();
    return new NextResponse(data, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Error de comunicación en proxy backend de Chilepasajes",
        message: err?.message,
      },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
