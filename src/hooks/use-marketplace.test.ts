import { expect, mock, test } from "bun:test";
import * as ui from "@medialane/ui";
import * as sdkStarknet from "@medialane/sdk/starknet";

const created: string[] = [];
const intent = (kind: string) => ({ id: `${kind}1`, expiresAt: "", requiresSignature: kind !== "fulfill", typedData: {}, calls: [] });
const client = {
  createIntent: async (kind: string) => (created.push(`${kind}:client`), intent(kind)),
  api: { intents: { create: async (kind: string) => (created.push(`${kind}:api`), intent(kind)) } },
};

mock.module("react", () => ({ useCallback: <T>(fn: T) => fn }));
mock.module("@medialane/ui", () => ({ ...ui, useMedialaneClient: () => client }));
mock.module("@/lib/use-venue-signer", () => ({ useVenueSigner: () => ({ address: "0xabc" }) }));
mock.module("@/hooks/use-write-state", () => ({
  useWriteState: () => ({ run: (fn: () => Promise<unknown>) => fn(), setError: () => {}, setTxHash: () => {} }),
}));
mock.module("@medialane/sdk/starknet", () => ({ ...sdkStarknet, executeIntent: async () => ({ txHash: "0xtx" }) }));

const { useMarketplace } = await import("./use-marketplace");

test("listing, offer and cancel are built by the client; fulfill is created by the API", async () => {
  const market = useMarketplace();
  await market.createListing("0xc", "1", "5", "STRK", 3600);
  await market.makeOffer("0xc", "1", "5", "STRK", 3600);
  await market.cancelOrder("0xo");
  await market.acceptOffer("0xo");
  expect(created).toEqual(["listing:client", "offer:client", "cancel:client", "fulfill:api"]);
});
