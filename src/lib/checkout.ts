import type { ApiOrder } from "@medialane/sdk";

export interface CheckoutItem {
  orderHash: string;
  considerationToken: string;

  considerationAmount: string;
  isERC1155: boolean;
  offerIdentifier: string;

  quantity?: string;
}

export function orderTotal(order: ApiOrder, quantity: number): bigint {
  const perUnit = BigInt(order.consideration.startAmount);
  const isERC1155 = order.offer.itemType === "ERC1155";
  return isERC1155 ? perUnit * BigInt(quantity) : perUnit;
}
