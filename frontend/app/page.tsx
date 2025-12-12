import { Hero } from "@/components/hero"
import { Features } from "@/components/features"
import { WhySection } from "@/components/why-section"
import { DownloadSection } from "@/components/download-section"

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <WhySection />
      <DownloadSection />
    </>
  )
}
