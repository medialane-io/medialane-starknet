import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL
const API_KEY = process.env.MEDIALANE_API_KEY

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
