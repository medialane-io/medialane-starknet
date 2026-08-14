import { ServiceFormShell } from "@medialane/ui";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { WalletGate } from "@/components/claim/wallet-gate";

interface ClaimRouteShellProps {

  icon: React.ReactNode;
  title: string;
  subtitle: string;

  headerAccessory?: React.ReactNode;

  gated?: boolean;

  aside?: React.ReactNode;
  children: React.ReactNode;
}

export function ClaimRouteShell({ icon, title, subtitle, headerAccessory, gated = true, aside, children }: ClaimRouteShellProps) {
  const gatedChildren = gated ? <WalletGate>{children}</WalletGate> : children;
  return (
    <ServiceFormShell
      icon={icon}
      title={title}
      subtitle={subtitle}
      headerAccessory={headerAccessory}
      aside={aside}
      backSlot={<ClaimBackButton />}
    >
      {gatedChildren}
    </ServiceFormShell>
  );
}
