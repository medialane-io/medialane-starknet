function isUserRejection(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /reject|denied|declin|abort|cancel|refus/i.test(msg);
}

export function uploadFailureToast(err: unknown): { title: string; description?: string } {
  if (isUserRejection(err)) {
    return {
      title: "Signature declined",
      description:
        "Approve the free sign-in signature to upload.",
    };
  }
  return {
    title: "Image upload failed",
    description: err instanceof Error ? err.message : undefined,
  };
}
