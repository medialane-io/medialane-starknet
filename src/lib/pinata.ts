import { PinataSDK } from "pinata";

let client: PinataSDK | null = null;

/**
 * Server-only Pinata client, built lazily and memoized. Throws with a clear
 * message if PINATA_JWT is missing — callers should catch this alongside
 * their other upload errors.
 */
export function getPinataClient(): PinataSDK {
  if (client) return client;
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT environment variable is not set");
  client = new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY || "https://gateway.pinata.cloud",
  });
  return client;
}
