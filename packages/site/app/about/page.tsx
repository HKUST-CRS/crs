import AboutContent from './content/about.mdx'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About CRS',
  description: 'CSE Request System @ HKUST',
}

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <AboutContent />
    </div>
  )
}