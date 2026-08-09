import { NextRequest, NextResponse } from "next/server"

// Server-only — the API key is read from the non-NEXT_PUBLIC env var so it
// never ends up in the browser bundle (2026-05-24 cleanup).
const BACKEND_URL = process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL
const API_KEY = process.env.MEDIALANE_API_KEY

// Starknet address: 0x + up to 64 hex chars. Rejecting anything else also
// closes a path-traversal vector — Next.js decodes `%2f` within this dynamic
// segment into a literal "/" (confirmed: a request for
// `/api/creators/%2e%2e%2fadmin%2fsecret/hidden` reaches the backend as
// `GET /v1/admin/secret/hidden` with the privileged API key attached), so an
// unvalidated `address` could redirect this fetch to an arbitrary backend
// path. Same class of bug fixed in `/api/proxy/v1/[...path]/route.ts`.
const ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 })
  }
  const res = await fetch(`${BACKEND_URL}/v1/creators/${address}/hidden`, {
    headers: { "x-api-key": API_KEY! },
    next: { revalidate: 30 },
  })
  if (!res.ok) return NextResponse.json({ isHidden: false })
  const data = await res.json()
  return NextResponse.json(data)
}
