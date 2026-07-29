import type { Metadata } from "next";
import { PageContainer } from "@medialane/ui";
import { ConnectGate } from "@/components/connect-gate";
import { canonical, buildSocialMetadata } from "@/lib/seo";
import SettingsContent from "./settings-content";

const title = "Account Settings";
const description = "Manage your public creator identity, username, and wallet connection.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/settings"),
  ...buildSocialMetadata({ title, description }),
};

export default function SettingsPage() {
  return (
    <PageContainer className="box-border max-w-full pt-20 pb-16">
      <ConnectGate
        title="Connect your wallet"
        subtitle="Connect your wallet to manage your account settings."
      >
        <SettingsContent />
      </ConnectGate>
    </PageContainer>
  );
}
