import { expect, mock, test } from "bun:test";
import * as ui from "@medialane/ui";
import * as sdkStarknet from "@medialane/sdk/starknet";

const created: string[] = [];
const intent = { id: "t1", expiresAt: "", requiresSignature: false, calls: [] };
const client = {
  createIntent: async (kind: string) => (created.push(`${kind}:client`), intent),
  api: { intents: { create: async (kind: string) => (created.push(`${kind}:api`), intent) } },
};

mock.module("react", () => ({ useCallback: <T>(fn: T) => fn }));
mock.module("@medialane/ui", () => ({ ...ui, useMedialaneClient: () => client }));
mock.module("@/hooks/use-wallet", () => ({ useWallet: () => ({ address: "0xabc" }) }));
mock.module("@/lib/use-venue-signer", () => ({ useVenueSigner: () => ({ address: "0xabc" }) }));
mock.module("@/hooks/use-write-state", () => ({
  useWriteState: () => ({ run: (fn: () => Promise<unknown>) => fn(), setTxHash: () => {} }),
}));
mock.module("@medialane/sdk/starknet", () => ({ ...sdkStarknet, executeIntent: async () => ({ txHash: "0xtx" }) }));

const { useTransfer } = await import("./use-transfer");

test("an NFT transfer is built by the client", async () => {
  await useTransfer().transferToken({ contractAddress: "0xc", tokenId: "1", toAddress: "0xd", tokenStandard: "ERC721" });
  expect(created).toEqual(["transfer-nft:client"]);
});
