import * as z from "zod";
import { getListableTokens } from "@medialane/sdk";

export const LISTABLE_CURRENCIES = getListableTokens().map((t) => t.symbol);

export const orderFormSchema = z.object({
  price: z.string().min(1, "Price required").refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be positive"),
  currency: z.string().refine((v) => LISTABLE_CURRENCIES.some((c) => c === v), "Invalid currency"),
  durationSeconds: z.number().min(86400),
});
