import { describe, expect, test } from "bun:test";
import { executeWithSponsorship } from "./sponsored-execute";

const signer = { address: "0x1", signTypedData: async () => [] };
const selfPaid = async () => ({ txHash: "self" });

describe("executeWithSponsorship", () => {
  test("without intent ids the wallet pays", async () => {
    const out = await executeWithSponsorship({ signedIn: async () => true, fallback: selfPaid }, signer, []);
    expect(out.txHash).toBe("self");
  });

  test("with intent ids it sponsors through the app gateway, with the session cookie and no bearer header", async () => {
    const seen: unknown[] = [];
    const out = await executeWithSponsorship(
      {
        signedIn: async () => true,
        sponsored: async (config, _signer, request) => { seen.push({ config, request }); return { status: "sponsored", transactionHash: "0xs" }; },
        fallback: selfPaid,
      },
      signer, [], ["i1"],
    );
    expect(out.txHash).toBe("0xs");
    expect(seen).toEqual([{ config: { proxyUrl: "/api/proxy/v1/paymaster/invoke" }, request: { intentIds: ["i1"] } }]);
  });

  test("when sponsorship is unavailable the wallet pays", async () => {
    const out = await executeWithSponsorship(
      { signedIn: async () => true, sponsored: async () => ({ status: "unavailable", reason: "x" }), fallback: selfPaid },
      signer, [], ["i1"],
    );
    expect(out.txHash).toBe("self");
  });

  test("when the wallet is not signed in the wallet pays", async () => {
    const out = await executeWithSponsorship({ signedIn: async () => false, fallback: selfPaid }, signer, [], ["i1"]);
    expect(out.txHash).toBe("self");
  });
});
