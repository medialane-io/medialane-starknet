import type { Metadata } from "next";
import { absoluteUrl, canonical, buildBreadcrumbJsonLd, buildSocialMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import CreatorPageClient from "./creator-page-client";

export const revalidate = 60;

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const short = `${address.slice(0, 8)}…${address.slice(-6)}`;
  const title = `${short} | Profile`;
  const description = `View IP assets, listings, and onchain activity for ${short} on Medialane.`;

  return {
    title,
    description,
    alternates: canonical(`/account/${address}`),
    ...buildSocialMetadata({ title, description, imageAlt: `${short} on Medialane` }),
  };
}

export default async function AccountPage({ params }: Props) {
  const { address } = await params;
  const short = `${address.slice(0, 8)}…${address.slice(-6)}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: `${short} | Medialane`,
      url: absoluteUrl(`/account/${address}`),
    },
    buildBreadcrumbJsonLd([
      { name: "Creators", path: "/creators" },
      { name: short, path: `/account/${address}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <CreatorPageClient />
    </>
  );
}
