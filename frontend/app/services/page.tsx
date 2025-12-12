"use client"

import type React from "react"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Monitor,
  Globe,
  Eye,
  Play,
  Square,
  Plus,
  Code,
  Cloud,
  Video,
  Music,
  LayoutDashboard,
  Container,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"
import { useSessionManagement } from "@/hooks/useApi"
import { useAuth } from "@/contexts/AuthContext"

const ACTIVE_SESSION_STATUSES = new Set(["running", "starting", "extended"])

interface Service {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  status: "stopped" | "starting" | "running"
  statusBadge?: string
  timeLeft: number
  config?: {
    distro?: string
    [key: string]: unknown
  }
  category: "core" | "development" | "media" | "productivity"
  sessionId?: string
  type?: "browser" | "desktop"
}

export default function ServicesPage() {
  const { user } = useAuth()
  const {
    sessions,
    loading,
    startBrowserSession,
    startDesktopSession,
    stopSession,
    extendSession,
    loadSessions,
    resetSessions,
  } = useSessionManagement()

  const [startingSessions, setStartingSessions] = useState<Set<string>>(new Set())
  const [countdownTimers, setCountdownTimers] = useState<Record<string, number>>({})

  const [services, setServices] = useState<Service[]>([
    // Core Services
    {
      id: "browser",
      name: "Browser Container",
      description: "Secure, disposable web browsing environment",
      icon: <Globe className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      category: "core",
      type: "browser",
    },
    {
      id: "desktop",
      name: "Desktop Container",
      description: "Full Linux desktop environment",
      icon: <Monitor className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      config: { distro: "ubuntu" },
      category: "core",
      type: "desktop",
    },
    {
      id: "viewer",
      name: "Viewer Container",
      description: "Secure file viewing environment",
      icon: <Eye className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      category: "core",
    },
    // Development Services
    {
      id: "vscodium",
      name: "VSCodium",
      description: "Open-source code editor in your browser",
      icon: <Code className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      category: "development",
    },
    {
      id: "webtop",
      name: "Webtop",
      description: "Ubuntu/Alpine desktop with KDE/XFCE",
      icon: <Monitor className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      config: { desktop: "kde", distro: "ubuntu" },
      category: "development",
    },
    // Media Services
    {
      id: "jellyfin",
      name: "Jellyfin",
      description: "Free media server for your content",
      icon: <Video className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      category: "media",
    },
    {
      id: "plex",
      name: "Plex",
      description: "Premium media server and streaming",
      icon: <Music className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      category: "media",
    },
    // Productivity Services
    {
      id: "nextcloud",
      name: "Nextcloud",
      description: "Self-hosted file sharing and collaboration",
      icon: <Cloud className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      category: "productivity",
    },
    {
      id: "heimdall",
      name: "Heimdall",
      description: "Application dashboard and launcher",
      icon: <LayoutDashboard className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      category: "productivity",
    },
    {
      id: "portainer",
      name: "Portainer",
      description: "Container management interface",
      icon: <Container className="h-6 w-6" />,
      status: "stopped",
      statusBadge: "stopped",
      timeLeft: 0,
      category: "productivity",
    },
  ])

  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const categories = [
    { id: "all", name: "All Services" },
    { id: "core", name: "Core Services" },
    { id: "development", name: "Development" },
    { id: "media", name: "Media" },
    { id: "productivity", name: "Productivity" },
  ]

  // Update services based on backend sessions
  useEffect(() => {
    setServices(prev => prev.map(service => {
      if (!service.type) {
        return service
      }

      const matchingSessions = sessions.filter(s => s.type === service.type)
      const session =
        matchingSessions.find(s => s.status === "running" || s.status === "extended" || s.status === "starting") ??
        matchingSessions[0]

      const sessionStatus = session?.status
      const isActiveSession = sessionStatus && ACTIVE_SESSION_STATUSES.has(sessionStatus)

      if (session && sessionStatus && isActiveSession) {
        const normalizedStatus = sessionStatus === "extended" ? "running" : sessionStatus
        const derivedTimeLeft = session.sessionId
          ? countdownTimers[session.sessionId] ?? session.timeLeft ?? 0
          : session.timeLeft ?? 0

        return {
          ...service,
          status: (normalizedStatus as Service["status"]) ?? "running",
          statusBadge: sessionStatus,
          timeLeft: derivedTimeLeft,
          sessionId: session.sessionId,
        }
      }

      const fallbackStatus = service.status === "starting" && startingSessions.has(service.id) ? "starting" : "stopped"
      return {
        ...service,
        status: fallbackStatus,
        statusBadge: sessionStatus ?? fallbackStatus,
        timeLeft: 0,
        sessionId: undefined,
      }
    }))
  }, [sessions, countdownTimers, startingSessions])

  // Load sessions when authenticated
  useEffect(() => {
    if (user) {
      loadSessions()
    } else {
      resetSessions()
      setCountdownTimers({})
      setServices(prev =>
        prev.map(service => ({
          ...service,
          status: "stopped",
          statusBadge: "stopped",
          timeLeft: 0,
          sessionId: undefined,
        })),
      )
    }
  }, [user, loadSessions, resetSessions])

  // Sync countdown timers with active sessions (reset when sessions extend or stop)
  useEffect(() => {
    setCountdownTimers(prev => {
      const updatedTimers = { ...prev }
      const activeSessionIds = new Set<string>()

      sessions.forEach(session => {
        if (!session.sessionId) return

        if (session.status === "running" || session.status === "extended") {
          activeSessionIds.add(session.sessionId)
          const incomingTime = session.timeLeft ?? 0
          const currentTime = updatedTimers[session.sessionId]

          if (currentTime === undefined || Math.abs(currentTime - incomingTime) > 1) {
            updatedTimers[session.sessionId] = incomingTime
          }
        }
      })

      Object.keys(updatedTimers).forEach(sessionId => {
        if (!activeSessionIds.has(sessionId)) {
          delete updatedTimers[sessionId]
        }
      })

      return updatedTimers
    })
  }, [sessions])

  // Countdown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownTimers(prev => {
        const newTimers = { ...prev }

        Object.keys(newTimers).forEach(sessionId => {
          if (newTimers[sessionId] > 0) {
            newTimers[sessionId] -= 1
          } else {
            delete newTimers[sessionId]
          }
        })

        return newTimers
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const filteredServices =
    selectedCategory === "all" ? services : services.filter((service) => service.category === selectedCategory)

  const startService = async (serviceId: string) => {
    if (!user) {
      toast.error("Sign in to start a session")
      return
    }

    const service = services.find(s => s.id === serviceId)
    if (!service) return

    // Set loading state for this specific service
    setStartingSessions(prev => new Set(prev).add(serviceId))
    
    // Update service status to starting
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, status: "starting", statusBadge: "starting" } : s
    ))

    try {
      if (service.type === "browser") {
        toast.info(`Starting ${service.name}...`)
        const session = await startBrowserSession()
        if (session?.sessionId) {
          setCountdownTimers(prev => ({
            ...prev,
            [session.sessionId!]: session.timeLeft ?? 0,
          }))
        }
        if (session?.browserUrl) {
          await new Promise(resolve => setTimeout(resolve, 1500))
          window.open(session.browserUrl, "_blank", "noopener")
        }
        toast.success(`${service.name} is ready!`)
      } else if (service.type === "desktop") {
        const flavor = service.config?.distro || "ubuntu"
        toast.info(`Starting ${service.name} (${flavor})...`)
        const session = await startDesktopSession(flavor)
        if (session?.sessionId) {
          setCountdownTimers(prev => ({
            ...prev,
            [session.sessionId!]: session.timeLeft ?? 0,
          }))
        }
        if (session?.desktopUrl) {
          toast.success(`${service.name} is ready! Use the Open button when you're ready to connect.`)
        } else {
          toast.success(`${service.name} is ready!`)
        }
      } else {
        toast.info(`Starting ${service.name}...`)
        // Simulate startup for non-implemented services
        setTimeout(() => {
          setServices(prev =>
            prev.map(s => s.id === serviceId ? { ...s, status: "running", statusBadge: "running", timeLeft: 300 } : s)
          )
          toast.success(`${service.name} is ready!`)
        }, 3000)
      }
    } catch (error) {
      console.error("Failed to start service:", error)
      toast.error(`Failed to start ${service.name}`)
      // Reset service status on error
      setServices(prev => prev.map(s => 
        s.id === serviceId ? { ...s, status: "stopped", statusBadge: "stopped" } : s
      ))
    } finally {
      // Clear loading state
      setStartingSessions(prev => {
        const newSet = new Set(prev)
        newSet.delete(serviceId)
        return newSet
      })
    }
  }

  const stopService = async (serviceId: string) => {
    if (!user) {
      toast.error("Sign in to manage sessions")
      return
    }

    const service = services.find(s => s.id === serviceId)
    if (!service || !service.sessionId || !service.type) return

    try {
      toast.info(`Stopping ${service.name}...`)
      await stopSession(service.sessionId, service.type)
      
      // Remove the countdown timer for this session
      setCountdownTimers(prev => {
        const newTimers = { ...prev }
        if (service.sessionId) {
          delete newTimers[service.sessionId]
        }
        return newTimers
      })
      
      toast.success(`${service.name} stopped successfully!`)
    } catch (error) {
      console.error("Failed to stop service:", error)
      toast.error(`Failed to stop ${service.name}`)
    }
  }

  const extendService = async (serviceId: string) => {
    if (!user) {
      toast.error("Sign in to manage sessions")
      return
    }

    const service = services.find(s => s.id === serviceId)
    if (!service || !service.sessionId || !service.type) return

    try {
      toast.info(`Extending ${service.name} by 5 minutes...`)
      const sessionData = await extendSession(service.sessionId, service.type, 300)
      
      const sessionKey = service.sessionId
      if (sessionKey) {
        setCountdownTimers(prev => ({
          ...prev,
          [sessionKey]: sessionData?.timeLeft ?? prev[sessionKey] ?? 0,
        }))
        toast.success(`${service.name} extended successfully!`)
      }
    } catch (error) {
      console.error("Failed to extend service:", error)
      toast.error(`Failed to extend ${service.name}`)
    }
  }

  const openService = (service: Service) => {
    if (service.sessionId && service.status === "running") {
      const session = sessions.find(s => s.sessionId === service.sessionId)
      if (service.type === "browser" && session?.browserUrl) {
        window.open(session.browserUrl, '_blank')
      } else if (service.type === "desktop" && session?.desktopUrl) {
        window.open(session.desktopUrl, '_blank')
      } else if (session?.url) {
        window.open(session.url, '_blank')
      }
    }
  }

  // Timer countdown for non-backend services
  useEffect(() => {
    const interval = setInterval(() => {
      setServices((prev) =>
        prev.map((service) => {
          if (service.status === "running" && service.timeLeft > 0 && !service.sessionId) {
            const newTimeLeft = service.timeLeft - 1
            if (newTimeLeft === 0) {
              toast.error(`⏰ ${service.name} session expired`)
              return { ...service, status: "stopped", statusBadge: "stopped", timeLeft: 0 }
            }
            return { ...service, timeLeft: newTimeLeft }
          }
          return service
        }),
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-500"
      case "starting":
        return "bg-yellow-500"
      case "expired":
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "core":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "development":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "media":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "productivity":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto text-center p-10 space-y-6">
          <CardHeader>
            <CardTitle className="text-3xl">Authenticate to manage services</CardTitle>
            <CardDescription>Sign in to start disposable browsers or desktop sessions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              securelink analyzer links each session to your account for better auditing and admin controls. Please sign in to
              continue.
            </p>
            <Button asChild className="cursor-pointer">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Container Services</h1>
        <p className="text-muted-foreground">Manage your disposable container environments</p>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="cursor-pointer"
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((service) => (
          <Card 
            key={service.id} 
            className={`relative overflow-hidden cursor-pointer transition-all duration-300 ${
              startingSessions.has(service.id) ? 'ring-2 ring-primary/20 bg-primary/5' : ''
            }`}
          >
            {/* Loading overlay */}
            {startingSessions.has(service.id) && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Starting {service.name}...</p>
                </div>
              </div>
            )}
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">{service.icon}</div>
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <Badge
                    variant="secondary"
                    className={`${getStatusColor(service.statusBadge ?? service.status)} text-white`}
                  >
                    {service.statusBadge ?? service.status}
                  </Badge>
                  <Badge variant="outline" className={getCategoryColor(service.category)}>
                    {service.category}
                  </Badge>
                  {service.timeLeft <= 60 && service.status === "running" && (
                    <Badge variant="destructive" className="animate-pulse text-xs">
                      Expiring Soon!
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {service.id === "desktop" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Linux Distribution:</label>
                  <Select 
                    defaultValue="ubuntu"
                    onValueChange={(value) => {
                      setServices(prev => prev.map(s => 
                        s.id === service.id ? { ...s, config: { ...s.config, distro: value } } : s
                      ))
                    }}
                  >
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ubuntu">Ubuntu Desktop</SelectItem>
                      <SelectItem value="debian">Debian Desktop</SelectItem>
                      <SelectItem value="fedora">Fedora Desktop</SelectItem>
                      <SelectItem value="alpine">Alpine Desktop</SelectItem>
                      <SelectItem value="arch">Arch Desktop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {service.id === "webtop" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Desktop Environment:</label>
                  <Select defaultValue="kde">
                    <SelectTrigger className="cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kde">KDE Plasma</SelectItem>
                      <SelectItem value="xfce">XFCE</SelectItem>
                      <SelectItem value="mate">MATE</SelectItem>
                      <SelectItem value="i3">i3 Window Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {service.status === "running" && (
                <div className="p-4 bg-muted rounded-lg text-center space-y-3">
                  <div className="text-sm text-muted-foreground">Session expires in:</div>
                                      <div className={`text-2xl font-mono font-bold ${
                      service.timeLeft <= 60 ? 'text-red-500 animate-pulse' : 
                      service.timeLeft <= 300 ? 'text-yellow-500' : 'text-primary'
                    }`}>
                      {formatTime(service.timeLeft)}
                    </div>
                    {/* Progress bar for session time */}
                    {service.timeLeft > 0 && (
                      <div className="w-full bg-muted-foreground/20 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-1000 ${
                            service.timeLeft <= 60 ? 'bg-red-500' : 
                            service.timeLeft <= 300 ? 'bg-yellow-500' : 'bg-primary'
                          }`}
                          style={{ 
                            width: `${Math.max(0, Math.min(100, (service.timeLeft / 300) * 100))}%` 
                          }}
                        />
                      </div>
                    )}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => extendService(service.id)} 
                      className="flex-1 cursor-pointer"
                      disabled={startingSessions.has(service.id)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Extend +5
                    </Button>
                    {service.sessionId && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => openService(service)} 
                        className="cursor-pointer"
                        disabled={startingSessions.has(service.id)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {service.status === "stopped" && (
                  <Button 
                    onClick={() => startService(service.id)} 
                    className="flex-1 cursor-pointer"
                    disabled={loading || startingSessions.has(service.id)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Start Service
                  </Button>
                )}

                {(service.status === "starting" || startingSessions.has(service.id)) && (
                  <Button disabled className="flex-1">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Starting...
                  </Button>
                )}

                {service.status === "running" && !startingSessions.has(service.id) && (
                  <Button variant="destructive" onClick={() => stopService(service.id)} className="flex-1 cursor-pointer">
                    <Square className="h-4 w-4 mr-2" />
                    Stop Service
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
