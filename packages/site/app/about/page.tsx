import type { Metadata } from "next";
import AboutContent from "./content/about.mdx";

export const metadata: Metadata = {
  title: "About CRS",
  description: "CSE Request System @ HKUST",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <AboutContent />
    </div>
  );
}
