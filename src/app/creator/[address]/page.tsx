import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { absoluteUrl, canonical, buildBreadcrumbJsonLd, buildSocialMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import CreatorUsernamePageClient from "./creator-username-client";

export const revalidate = 60;

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;

  const title = `@${address}`;
  const description = `Creator profile for @${address} on Medialane.`;
  return {
    title,
    description,
    alternates: canonical(`/creator/${address}`),
    ...buildSocialMetadata({ title, description }),
  };
}

export default async function CreatorPage({ params }: Props) {
  const { address } = await params;

  if (address.startsWith("0x") || address.startsWith("0X")) {
    redirect(`/account/${address}`);
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: `@${address} | Medialane`,
      url: absoluteUrl(`/creator/${address}`),
    },
    buildBreadcrumbJsonLd([
      { name: "Creators", path: "/creators" },
      { name: `@${address}`, path: `/creator/${address}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <CreatorUsernamePageClient username={address} />
    </>
  );
}
