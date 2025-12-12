import { Button } from "@/components/ui/button"
import { ArrowRight, Shield, Zap, Globe } from "lucide-react"
import Link from "next/link"

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-24 lg:py-32">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center rounded-full border px-4 py-2 text-sm">
            <Shield className="mr-2 h-4 w-4" />
            Secure • Anonymous • Disposable
          </div>

          {/* Heading */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Fear</span>{" "}
            Nothing Online
          </h1>

          {/* Subheading */}
          <p className="mb-8 text-xl text-muted-foreground sm:text-2xl">
            Secure, disposable container services for anonymous browsing, desktop environments, and file viewing. Your
            privacy, guaranteed.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="text-lg cursor-pointer" asChild>
              <Link href="#download">
                Download Extension
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg bg-transparent cursor-pointer" asChild>
              <Link href="/services">Try Services</Link>
            </Button>
          </div>

          {/* Features */}
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-3">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">Browser Containers</h3>
              <p className="text-sm text-muted-foreground">Isolated browsing environments that leave no trace</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-3">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">Instant Deployment</h3>
              <p className="text-sm text-muted-foreground">Containers ready in seconds, destroyed automatically</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full bg-primary/10 p-3">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">Complete Privacy</h3>
              <p className="text-sm text-muted-foreground">No logs, no tracking, no permanent storage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-primary/20 to-transparent blur-3xl" />
      </div>
    </section>
  )
}
