import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, XCircle } from "lucide-react"

const comparisons = [
  {
    feature: "Complete Anonymity",
    us: true,
    others: false,
    description: "No logs, no tracking, no data retention",
  },
  {
    feature: "Instant Deployment",
    us: true,
    others: false,
    description: "Containers ready in 2-4 seconds",
  },
  {
    feature: "Auto-Destruction",
    us: true,
    others: false,
    description: "Automatic cleanup after session ends",
  },
  {
    feature: "Multiple Environments",
    us: true,
    others: true,
    description: "Browser, Desktop, and Viewer containers",
  },
  {
    feature: "Session Extension",
    us: true,
    others: false,
    description: "Extend sessions with one click",
  },
  {
    feature: "Chrome Extension",
    us: true,
    others: false,
    description: "Seamless browser integration",
  },
]

export function WhySection() {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4 sm:text-4xl">Why Choose Disposable Services?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            See how we compare to traditional VPS and container services
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-6 font-semibold">Feature</th>
                      <th className="text-center p-6 font-semibold text-primary">Disposable Services</th>
                      <th className="text-center p-6 font-semibold text-muted-foreground">Traditional Services</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map((item, index) => (
                      <tr key={index} className="border-b last:border-b-0">
                        <td className="p-6">
                          <div>
                            <div className="font-medium">{item.feature}</div>
                            <div className="text-sm text-muted-foreground mt-1">{item.description}</div>
                          </div>
                        </td>
                        <td className="p-6 text-center">
                          {item.us ? (
                            <CheckCircle className="h-6 w-6 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-500 mx-auto" />
                          )}
                        </td>
                        <td className="p-6 text-center">
                          {item.others ? (
                            <CheckCircle className="h-6 w-6 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-500 mx-auto" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
