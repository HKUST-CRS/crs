import type { Metadata } from "next";
import Link from "next/link";
import AboutContent from "./content/about.mdx";

export const metadata: Metadata = {
  title: "About CRS",
  description: "CSE Request System @ HKUST",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link
        href="/"
        className="mb-6 inline-block text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
      >
        Back to CRS
      </Link>
      <AboutContent />
    </main>
  );
}
