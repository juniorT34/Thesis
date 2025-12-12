import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, Globe, Eye, Clock, Shield, Zap } from "lucide-react"

const features = [
  {
    icon: <Globe className="h-8 w-8" />,
    title: "Browser Container",
    description: "Secure, isolated web browsing environment with no trace left behind.",
    details: ["Anonymous browsing", "No cookies or cache", "VPN integration", "Ad blocking"],
  },
  {
    icon: <Monitor className="h-8 w-8" />,
    title: "Desktop Container",
    description: "Full Linux desktop environment with multiple distribution options.",
    details: ["Ubuntu, Debian, Fedora", "Full GUI access", "Pre-installed tools", "Custom configurations"],
  },
  {
    icon: <Eye className="h-8 w-8" />,
    title: "Viewer Container",
    description: "Safe file viewing environment for untrusted documents and media.",
    details: ["Sandboxed viewing", "Multiple file formats", "No file downloads", "Malware protection"],
  },
  {
    icon: <Clock className="h-8 w-8" />,
    title: "Timed Sessions",
    description: "Automatic session management with customizable durations.",
    details: ["5-30 minute sessions", "Extend functionality", "Auto-cleanup", "Session warnings"],
  },
  {
    icon: <Shield className="h-8 w-8" />,
    title: "Privacy First",
    description: "Complete anonymity with no logging or data retention.",
    details: ["No user tracking", "Encrypted connections", "Memory-only storage", "Instant destruction"],
  },
  {
    icon: <Zap className="h-8 w-8" />,
    title: "Lightning Fast",
    description: "Containers deploy in seconds with optimized performance.",
    details: ["2-4 second startup", "SSD storage", "Global CDN", "Load balancing"],
  },
]

export function Features() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 sm:text-4xl">Powerful Container Services</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need for secure, anonymous computing in disposable environments
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="relative overflow-hidden group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {feature.details.map((detail, detailIndex) => (
                    <li key={detailIndex} className="flex items-center text-sm text-muted-foreground">
                      <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
