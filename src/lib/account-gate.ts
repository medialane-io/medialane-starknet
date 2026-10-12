import { UserFacingError } from "@medialane/ui";

export const SESSION_REQUIRED = "Sign in with your wallet to continue.";

export function requireSignedIn<T>(session: T | null | undefined): asserts session is T {
  if (!session) throw new UserFacingError(SESSION_REQUIRED);
}
