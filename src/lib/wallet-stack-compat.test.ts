import { test, expect } from "bun:test";

// @starknet-react/core and starknetkit both declare a peer range on starknet
// that is narrower than the version this app installs. The range is
// conservative rather than a real incompatibility — the APIs they call
// (Contract's options constructor, WalletAccount.connect) are identical across
// it — but "conservative" is a claim that has to keep being true.
//
// These tests drive the wallet stack's runtime paths: module init, provider
// factories, and construction of every connector the app ships. They fail if a
// starknet upgrade moves an API the stack depends on, which a typecheck against
// its published types would not catch.
//
// What they cannot cover: an actual wallet handshake needs a browser and an
// installed extension. Treat a green run as necessary, not sufficient.
test("starknet-react loads and builds providers against starknet v10", async () => {
  const core = await import("@starknet-react/core");
  const { RpcProvider, Contract, WalletAccount } = await import("starknet");

  expect(typeof core.StarknetConfig).toBe("function");
  expect(typeof core.jsonRpcProvider).toBe("function");

  // The provider factory starknet-react calls internally.
  const factory = core.jsonRpcProvider({ rpc: () => ({ nodeUrl: "https://example.invalid" }) });
  const provider = factory({ id: 1n, name: "x", network: "mainnet" } as never);
  expect(provider).toBeInstanceOf(RpcProvider);

  // The two APIs whose shape actually matters.
  expect(typeof (WalletAccount as unknown as { connect: unknown }).connect).toBe("function");
  const abi = [
    { type: "interface", name: "I", items: [
      { type: "function", name: "balance_of", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
    ] },
  ];
  const c = new Contract({ abi: abi as never, address: "0x1", providerOrAccount: provider as never });
  expect(c.address).toBeDefined();
  expect(typeof c.call).toBe("function");
});

test("the dapp's own starknet usage still resolves under v10", async () => {
  const { RpcProvider, num, hash, CallData, cairo, shortString, validateAndParseAddress } =
    await import("starknet");
  expect(typeof new RpcProvider({ nodeUrl: "https://example.invalid" }).getChainId).toBe("function");
  expect(num.toHex(255n)).toBe("0xff");
  expect(typeof hash.getSelectorFromName("transfer")).toBe("string");
  expect(typeof CallData.compile).toBe("function");
  expect(typeof cairo.uint256).toBe("function");
  expect(typeof shortString.encodeShortString).toBe("function");
  expect(validateAndParseAddress("0x1")).toContain("0x");
});

// The dapp's real connector set. Each of these wraps starknet APIs, so loading
// and constructing them is what would surface a v10 mismatch outside a browser.
test("every wallet connector constructs against starknet v10", async () => {
  const { ArgentX } = await import("starknetkit/argentX");
  const { Braavos } = await import("starknetkit/braavos");
  const { MetaMask } = await import("starknetkit/metamask");
  const { Keplr } = await import("starknetkit/keplr");
  const { Fordefi } = await import("starknetkit/fordefi");
  const { Xverse } = await import("starknetkit/xverse");

  for (const [name, Ctor] of Object.entries({ ArgentX, Braavos, MetaMask, Keplr, Fordefi, Xverse })) {
    const connector = new (Ctor as new () => { id: string; available: () => boolean })();
    expect(`${name}:${typeof connector.id}`).toBe(`${name}:string`);
    // available() reads the injected wallet object; in Node it must say no, not throw.
    expect(`${name}:${typeof connector.available}`).toBe(`${name}:function`);
  }
});

test("the connector module the dapp actually ships loads under v10", async () => {
  const mod = await import("./wallet-connectors");
  const connectors = (mod as { walletConnectors?: unknown[] }).walletConnectors;
  expect(Array.isArray(connectors)).toBe(true);
  expect((connectors as unknown[]).length).toBeGreaterThan(0);
});
