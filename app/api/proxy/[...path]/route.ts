import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8080/api/v1';

// The operator interface only ever needs these resource families.
const ALLOWED_ROOTS = new Set(['operator', 'operators', 'groups', 'chatroom']);

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, segment: string[], method: string) {
  if (!segment.length || !ALLOWED_ROOTS.has(segment[0])) {
    return NextResponse.json(
      { status: 404, code: 404, message: 'Not found.' },
      { status: 404 },
    );
  }

  const url = `${BASE_URL}/${segment.join('/')}`;
  const headers: Record<string, string> = {};
  const auth = req.headers.get('authorization');
  if (auth) headers.Authorization = auth;
  const contentType = req.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;

  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
    body = await req.text();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, { method, headers, body, cache: 'no-store', redirect: 'manual' });
  } catch {
    return NextResponse.json(
      {
        status: 502,
        code: 502,
        message: 'Could not reach the OpenPlaud API. Check that the backend is running.',
      },
      { status: 502 },
    );
  }

  if (upstream.status == 204) {
    return new Response(null, { status: upstream.status });
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path, 'GET');
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path, 'POST');
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handle(req, path, 'DELETE');
}
