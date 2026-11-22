"use client";

import { AtSign, UserCircle, Sparkles, BadgeCheck } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function ClaimUsernameAside() {
  return (
    <ClaimRail
      included={[
        { icon: AtSign, title: "Your own creator URL", desc: "A clean address like medialane.io/creator/yourname." },
        { icon: UserCircle, title: "One public profile", desc: "All work in one place." },
        { icon: Sparkles, title: "Easy to find", desc: "Fans find the real creator." },
      ]}
      steps={[
        "Pick the username you want",
        "We check it's available",
        "Yours after DAO review",
      ]}
      trustIcon={BadgeCheck}
      trustLead="Yours to keep."
      trust="The DAO reviews each username."
    />
  );
}
