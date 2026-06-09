import { redirect } from "next/navigation";

// The remix-offers inbox was renamed to Licensing (remix vs licensing
// separation). Keep this redirect so old links/bookmarks resolve.
export default function RemixOffersRedirect() {
  redirect("/portfolio/licensing");
}
