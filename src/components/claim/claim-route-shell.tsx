import { ServiceFormShell } from "@medialane/ui";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { WalletGate } from "@/components/claim/wallet-gate";

interface ClaimRouteShellProps {
  /** Rendered icon element, e.g. <Layers className="h-4 w-4 text-white" />. */
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  /** Optional element shown under the header subtitle (e.g. a URL pill). */
  headerAccessory?: React.ReactNode;
  /** Wrap the form in WalletGate (connect overlay). Default true. Pages already
   *  wrapped in <ConnectGate> pass false to avoid double-gating. */
  gated?: boolean;
  /** Right-rail panels. Enables the asymmetric bento layout. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/** starknet's claim/create route shell — injects starknet's wallet gate + back
 *  button into the shared, presentation-only ServiceFormShell (@medialane/ui). */
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
