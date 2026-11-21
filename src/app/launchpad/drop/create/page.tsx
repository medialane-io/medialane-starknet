"use client";

import { DropCreate } from "@medialane/ui";
import { CreateDropAside } from "@/components/claim/create-drop-aside";

export default function CreateDropPage() {
  return <DropCreate aside={<CreateDropAside />} />;
}
