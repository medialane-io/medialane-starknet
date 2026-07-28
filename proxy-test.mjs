import { Account, RpcProvider } from "starknet";

const provider = new RpcProvider({ nodeUrl: "https://rpc.starknet.lava.build" });
const account = new Account({ provider, address: "0x1", signer: "0x1" });

const proxied = new Proxy(account, {
  get(target, prop, receiver) {
    if (prop === "execute" || prop === "signMessage") {
      return (...args) => target[prop].apply(target, args);
    }
    return Reflect.get(target, prop, receiver);
  },
});

try {
  console.log("address:", proxied.address);
  console.log("cairoVersion:", proxied.cairoVersion);
  console.log("channel access:", typeof proxied.channel);
  console.log("getNonceForAddress fn:", typeof proxied.getNonceForAddress);
  const nonce = await proxied.getNonceForAddress(account.address).catch(e => "getNonceForAddress threw: " + e.message);
  console.log("nonce call result/err:", nonce);
  console.log("OK - no private field crash");
} catch (e) {
  console.error("CRASH:", e.message);
  console.error(e.stack);
}
