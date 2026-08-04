import { test, expect } from "bun:test";
import type { Call, TypedData } from "starknet";
import { executePrebuiltIntent, signAndExecuteIntent, confirmIntentBestEffort } from "./intent-tx";

function fakeSigner(overrides: Partial<{ signTypedData: (d: TypedData) => Promise<string[]>; execute: (c: Call[]) => Promise<{ txHash: string }> }> = {}) {
  return {
    address: "0x1",
    signTypedData: overrides.signTypedData ?? (async () => ["0xsig1", "0xsig2"]),
    execute: overrides.execute ?? (async () => ({ txHash: "0xtx" })),
  };
}

function fakeClient(overrides: Partial<{ submitIntentSignature: (id: string, sig: string[]) => Promise<unknown>; confirmIntent: (id: string, tx: string) => Promise<unknown> }> = {}) {
  const calls: { submitIntentSignature: unknown[]; confirmIntent: unknown[] } = { submitIntentSignature: [], confirmIntent: [] };
  return {
    api: {
      submitIntentSignature: async (id: string, sig: string[]) => {
        calls.submitIntentSignature.push([id, sig]);
        return overrides.submitIntentSignature
          ? await overrides.submitIntentSignature(id, sig)
          : { data: { calls: [{ contractAddress: "0x2", entrypoint: "register_order", calldata: [] }] } };
      },
      confirmIntent: async (id: string, tx: string) => {
        calls.confirmIntent.push([id, tx]);
        return overrides.confirmIntent ? await overrides.confirmIntent(id, tx) : { data: {} };
      },
    },
    _calls: calls,
  };
}

test("executePrebuiltIntent executes the given calls and confirms by default", async () => {
  const executed: Call[][] = [];
  const signer = fakeSigner({ execute: async (c) => { executed.push(c); return { txHash: "0xtx1" }; } });
  const client = fakeClient();
  const calls: Call[] = [{ contractAddress: "0x1", entrypoint: "mint", calldata: [] }];

  const { txHash } = await executePrebuiltIntent(signer, client as never, { id: "i1", calls });

  expect(txHash).toBe("0xtx1");
  expect(executed[0]).toBe(calls);
  expect(client._calls.confirmIntent).toEqual([["i1", "0xtx1"]]);
});

test("executePrebuiltIntent skips confirm when confirm: false", async () => {
  const signer = fakeSigner();
  const client = fakeClient();
  await executePrebuiltIntent(signer, client as never, { id: "i1", calls: [] }, { confirm: false });
  expect(client._calls.confirmIntent).toEqual([]);
});

test("executePrebuiltIntent does not throw if confirm itself fails (best-effort)", async () => {
  const signer = fakeSigner();
  const client = fakeClient({ confirmIntent: async () => { throw new Error("network"); } });
  const { txHash } = await executePrebuiltIntent(signer, client as never, { id: "i1", calls: [] });
  expect(txHash).toBe("0xtx");
});

test("confirmIntentBestEffort calls client.api.confirmIntent and swallows errors", async () => {
  const client = fakeClient();
  await confirmIntentBestEffort(client as never, "i1", "0xtx1");
  expect(client._calls.confirmIntent).toEqual([["i1", "0xtx1"]]);

  const failingClient = fakeClient({ confirmIntent: async () => { throw new Error("400"); } });
  await expect(confirmIntentBestEffort(failingClient as never, "i2", "0xtx2")).resolves.toBeUndefined();
});

test("signAndExecuteIntent signs, submits, executes populated calls, then confirms", async () => {
  const signed: string[][] = [];
  const executed: Call[][] = [];
  const populatedCalls: Call[] = [{ contractAddress: "0x2", entrypoint: "register_order", calldata: ["0xsig1", "0xsig2"] }];
  const signer = fakeSigner({
    signTypedData: async () => { const s = ["0xsig1", "0xsig2"]; signed.push(s); return s; },
    execute: async (c) => { executed.push(c); return { txHash: "0xtx2" }; },
  });
  const client = fakeClient({ submitIntentSignature: async () => ({ data: { calls: populatedCalls } }) });
  const typedData = { types: {}, primaryType: "Order", domain: {}, message: {} } as unknown as TypedData;

  const { txHash } = await signAndExecuteIntent(signer, client as never, { id: "i2", typedData });

  expect(signed[0]).toEqual(["0xsig1", "0xsig2"]);
  expect(client._calls.submitIntentSignature).toEqual([["i2", ["0xsig1", "0xsig2"]]]);
  expect(executed[0]).toBe(populatedCalls);
  expect(client._calls.confirmIntent).toEqual([["i2", "0xtx2"]]);
  expect(txHash).toBe("0xtx2");
});
