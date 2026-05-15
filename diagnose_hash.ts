import { Contract, RpcProvider } from "starknet";
import { IPMarketplaceABI } from "@medialane/sdk";

const provider = new RpcProvider({ nodeUrl: "https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/tOTwt1ug3YNOsaPjinDvS" });
const marketplaceAddress = "0x059deafbbafbf7051c315cf75a94b03c5547892bc0c6dfa36d7ac7290d4cc33a";

async function checkHash() {
    // @ts-ignore - starknet.js v6 types can be strict with the constructor
    const contract = new Contract(IPMarketplaceABI as any, marketplaceAddress, provider);

    // Example Bid parameters from user's error trace
    const params = {
        offerer: "0x5f9f8d300601199297b7ecd92928e1444a2556aa84c8544b8b513d2a18a65a2",
        offer: {
            item_type: "1",
            token: "0x33068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb",
            identifier_or_criteria: "0",
            start_amount: "55000000",
            end_amount: "55000000"
        },
        consideration: {
            item_type: "2",
            token: "0xc2436dadd871d90fe184edc1ce7a6e816f083381566ecc4a5b58f6c74fb4d8",
            identifier_or_criteria: "1",
            start_amount: "1",
            end_amount: "1",
            recipient: "0x5f9f8d300601199297b7ecd92928e1444a2556aa84c8544b8b513d2a18a65a2"
        },
        start_time: "0",
        end_time: "1771869232",
        salt: "521918",
        nonce: "0"
    };

    try {
        console.log("Calling get_order_hash...");
        const hash = await contract.call("get_order_hash", [params]);
        console.log("On-chain Order Hash:", hash.toString());
        process.exit(0);
    } catch (err) {
        console.error("Error calling get_order_hash:", err);
        process.exit(1);
    }
}

checkHash();
