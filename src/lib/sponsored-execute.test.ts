import { describe, expect, test } from "bun:test";
import { executeWithSponsorship } from "./sponsored-execute";

const signer = { address: "0x1", signTypedData: async () => [] };
const selfPaid = async () => ({ txHash: "self" });

describe("executeWithSponsorship", () => {
  test("without intent ids the wallet pays", async () => {
    const out = await executeWithSponsorship({ token: async () => "t", fallback: selfPaid }, signer, []);
    expect(out.txHash).toBe("self");
  });

  test("with intent ids it sponsors, forwarding the SIWS token", async () => {
    const seen: unknown[] = [];
    const out = await executeWithSponsorship(
      {
        token: async () => "t",
        sponsored: async (config, _signer, calls, ids) => { seen.push({ config, calls, ids }); return { status: "sponsored", transactionHash: "0xs" }; },
        fallback: selfPaid,
      },
      signer, [], ["i1"],
    );
    expect(out.txHash).toBe("0xs");
    expect(seen).toEqual([{ config: { proxyUrl: "/api/wallet/sponsored-invoke", headers: { authorization: "Bearer t" } }, calls: [], ids: ["i1"] }]);
  });

  test("when sponsorship is unavailable the wallet pays", async () => {
    const out = await executeWithSponsorship(
      { token: async () => "t", sponsored: async () => ({ status: "unavailable", reason: "x" }), fallback: selfPaid },
      signer, [], ["i1"],
    );
    expect(out.txHash).toBe("self");
  });

  test("without a sign-in token the wallet pays", async () => {
    const out = await executeWithSponsorship({ token: async () => null, fallback: selfPaid }, signer, [], ["i1"]);
    expect(out.txHash).toBe("self");
  });
});
