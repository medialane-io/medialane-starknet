import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/node";
import { getPrivyServer } from "@/lib/privy-server";

function toExternalId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

async function getStarknetWalletForUser(privy: PrivyClient, userId: string) {
  const externalId = toExternalId(userId);

  for await (const wallet of privy.wallets().list({ external_id: externalId })) {
    if (wallet.chain_type === "starknet") {
      return wallet;
    }
  }

  return null;
}

function isHexHash(value: string): value is `0x${string}` {
  return /^0x[0-9a-fA-F]+$/.test(value);
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { walletId: string; hash: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { walletId, hash } = body;
  if (!walletId || !hash || !isHexHash(hash)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const privy = getPrivyServer();

  try {
    const claims = await privy.utils().auth().verifyAccessToken(token);
    const wallet = await getStarknetWalletForUser(privy, claims.user_id);

    if (!wallet || wallet.id !== walletId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await privy.wallets().rawSign(walletId, {
      params: { hash },
    });

    return NextResponse.json({ signature: result.signature });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
