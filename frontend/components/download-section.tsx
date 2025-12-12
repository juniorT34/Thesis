import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Chrome, ChromeIcon as Firefox, DotIcon as Edge, Github, Globe, BarChart3 } from "lucide-react"

export function DownloadSection() {
  return (
    <section id="download" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 sm:text-4xl">Get Started Today</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Download our browser extension or access services directly through the web interface
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Browser Extensions */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Download className="h-6 w-6" />
                </div>
                Browser Extensions
              </CardTitle>
              <CardDescription>Install our extension for seamless integration with your browser</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start cursor-pointer" size="lg">
                <Chrome className="mr-3 h-5 w-5" />
                Download for Chrome
                <span className="ml-auto text-xs bg-white/20 px-2 py-1 rounded">Recommended</span>
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent cursor-pointer" size="lg" disabled>
                <Firefox className="mr-3 h-5 w-5" />
                Firefox (Coming Soon)
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent cursor-pointer" size="lg" disabled>
                <Edge className="mr-3 h-5 w-5" />
                Edge (Coming Soon)
              </Button>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">Features included:</p>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    One-click container launch
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Session management
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Real-time notifications
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Dark/Light theme
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Web Interface */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Globe className="h-6 w-6" />
                </div>
                Web Interface
              </CardTitle>
              <CardDescription>Access all services directly through your browser</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start bg-transparent cursor-pointer" size="lg" asChild>
                <a href="/services">
                  <Chrome className="mr-3 h-5 w-5" />
                  Launch Web App
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent cursor-pointer" size="lg" asChild>
                <a href="/dashboard">
                  <BarChart3 className="mr-3 h-5 w-5" />
                  View Dashboard
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-start bg-transparent cursor-pointer" size="lg" asChild>
                <a href="https://github.com/disposable-services" target="_blank" rel="noopener noreferrer">
                  <Github className="mr-3 h-5 w-5" />
                  View Source Code
                </a>
              </Button>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">Web features:</p>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Full container management
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Usage analytics
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Profile management
                  </li>
                  <li className="flex items-center">
                    <div className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
                    Admin controls
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Installation Instructions */}
        <div className="mt-16 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Installation Instructions</CardTitle>
              <CardDescription>Quick setup guide for the Chrome extension</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                    1
                  </span>
                  <span>Download the extension file (.crx) from the button above</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                    2
                  </span>
                  <span>Open Chrome and navigate to chrome://extensions/</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                    3
                  </span>
                  <span>Enable &ldquo;Developer mode&rdquo; in the top right corner</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                    4
                  </span>
                  <span>Drag and drop the .crx file into the extensions page</span>
                </li>
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                    5
                  </span>
                  <span>Click &ldquo;Add extension&rdquo; when prompted</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
