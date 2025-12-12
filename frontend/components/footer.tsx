import Link from "next/link"
import { Github, Twitter, Mail, Shield } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3 cursor-pointer">
              <div className="h-8 w-8 rounded-lg hero-gradient flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                  <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="font-bold">SecureLink Analyzer</div>
                <div className="text-xs text-muted-foreground">Fear Nothing Online</div>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground">
              Secure, anonymous, and disposable container services for ultimate privacy.
            </p>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="font-semibold">Services</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/services" className="hover:text-primary cursor-pointer">
                  Browser Container
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-primary cursor-pointer">
                  Desktop Container
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-primary cursor-pointer">
                  Viewer Container
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-primary cursor-pointer">
                  Usage Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h3 className="font-semibold">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-primary cursor-pointer">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-primary cursor-pointer">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary cursor-pointer">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-primary cursor-pointer">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div className="space-y-4">
            <h3 className="font-semibold">Connect</h3>
            <div className="flex space-x-4">
              <a href="https://github.com" className="text-muted-foreground hover:text-primary cursor-pointer">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://twitter.com" className="text-muted-foreground hover:text-primary cursor-pointer">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="mailto:contact@disposableservices.com" className="text-muted-foreground hover:text-primary cursor-pointer">
                <Mail className="h-5 w-5" />
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Privacy First • No Logs • Open Source</span>
            </div>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">© 2024 Disposable Services. All rights reserved.</p>
          <p className="text-sm text-muted-foreground">Built with privacy and security in mind.</p>
        </div>
      </div>
    </footer>
  )
}
