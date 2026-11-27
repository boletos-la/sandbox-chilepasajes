import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getResolvedConfig() {
  const env = (
    process.env.CHILEPASAJES_ENV ||
    process.env.NEXT_PUBLIC_CHILEPASAJES_ENV ||
    "prod"
  ).toLowerCase();

  let baseUrl = "";
  let apiKey = "";

  if (env === "prod" || env === "production") {
    baseUrl =
      process.env.CHILEPASAJES_PROD_BASE_URL ||
      process.env.CHILEPASAJES_BASE_URL ||
      process.env.NEXT_PUBLIC_CHILEPASAJES_BASE_URL ||
      "https://back-prod.enbus.cl/api/v1";
    apiKey =
      process.env.CHILEPASAJES_PROD_API_KEY ||
      process.env.CHILEPASAJES_API_KEY ||
      "";
  } else {
    baseUrl =
      process.env.CHILEPASAJES_DEV_BASE_URL ||
      process.env.CHILEPASAJES_BASE_URL ||
      process.env.NEXT_PUBLIC_CHILEPASAJES_BASE_URL ||
      "https://back-qas.enbus.cl/api/v1";
    apiKey =
      process.env.CHILEPASAJES_DEV_API_KEY ||
      process.env.CHILEPASAJES_API_KEY ||
      "";
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey: apiKey.trim(),
  };
}

async function handleProxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { baseUrl, apiKey } = getResolvedConfig();

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      {
        error: "Configuración incompleta",
        message: "Las variables de entorno de Chilepasajes para este entorno no están definidas.",
      },
      { status: 500 }
    );
  }

  const { path } = await context.params;
  const pathStr = Array.isArray(path) ? path.join("/") : "";
  const urlObj = new URL(req.url);
  const search = urlObj.search || "";
  const targetUrl = `${baseUrl}/${pathStr}${search}`;

  const forwardHeaders: Record<string, string> = {
    Accept: req.headers.get("accept") || "application/json",
  };

  const contentType = req.headers.get("content-type");
  if (contentType) {
    forwardHeaders["Content-Type"] = contentType;
  }

  // La API Key se inyecta de forma 100% segura únicamente en el servidor
  if (!pathStr.includes("payment/notification")) {
    forwardHeaders["Authorization"] = `Bearer ${apiKey}`;
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
