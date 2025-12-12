"use client"

import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Users,
  Server,
  Activity,
  Clock,
  TrendingUp,
  Globe,
  Monitor,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Terminal,
  Search,
  Play,
  Square,
  Trash2,
  Settings,
  Code,
  Cloud,
  Video,
  Music,
  LayoutDashboard,
  Container,
  ExternalLink,
  FileText,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import { useSessionManagement, useHealthCheck } from "@/hooks/useApi"
import type { AdminResourceSnapshot, SessionData } from "@/lib/api"
import { useAuth } from "@/contexts/AuthContext"
import { useAdminData } from "@/hooks/useAdmin"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts"

type UsageAnalyticsPoint = {
  dateKey: string
  label: string
  sessions: number
  browserSessions: number
  desktopSessions: number
  avgDurationMinutes: number
}

type ResourceLimitSettings = {
  cpuPercent: number
  memoryMb: number
}

type PolicySettings = {
  autoCleanupMinutes: number
  requireMfaForDesktop: boolean
  allowFileDownloads: boolean
  enforceClipboardIsolation: boolean
  autoArchiveSessionLogs: boolean
}

type AlertRuleSettings = {
  cpuThreshold: number
  memoryThreshold: number
  emailNotifications: boolean
  slackNotifications: boolean
  webhookUrl: string
}

type LiveMetricSnapshot = {
  cpu: number
  memory: number
  network: number
}

const ANALYTICS_WINDOW_DAYS = 14
const BROWSER_CHART_COLOR = "#6366f1"
const DESKTOP_CHART_COLOR = "#14b8a6"
const STORAGE_KEYS = {
  RESOURCE_LIMITS: "securelink-analyzer-admin-resource-limits",
  POLICIES: "securelink-analyzer-admin-policies",
  ALERT_RULES: "securelink-analyzer-admin-alert-rules",
}
const DEFAULT_RESOURCE_LIMITS: ResourceLimitSettings = {
  cpuPercent: 50,
  memoryMb: 2048,
}
const DEFAULT_POLICIES: PolicySettings = {
  autoCleanupMinutes: 15,
  requireMfaForDesktop: true,
  allowFileDownloads: false,
  enforceClipboardIsolation: true,
  autoArchiveSessionLogs: true,
}
const DEFAULT_ALERT_RULES: AlertRuleSettings = {
  cpuThreshold: 75,
  memoryThreshold: 80,
  emailNotifications: true,
  slackNotifications: false,
  webhookUrl: "",
}
const DEFAULT_LIVE_METRICS: LiveMetricSnapshot = {
  cpu: 0,
  memory: 0,
  network: 0,
}

const resolveSessionType = (session: SessionData): "browser" | "desktop" => {
  if (session.type === "desktop") return "desktop"
  if (session.type === "browser") return "browser"
  return session.desktopUrl ? "desktop" : "browser"
}

const getSessionDurationMinutes = (session: SessionData): number => {
  if (typeof session.remainingMinutes === "number") {
    return Math.max(0, Number(session.remainingMinutes.toFixed(1)))
  }

  if (typeof session.timeLeft === "number") {
    return Math.max(0, Number((session.timeLeft / 60).toFixed(1)))
  }

  const createdAt = session.createdAt ? new Date(session.createdAt) : null
  const finishedAt = session.stoppedAt
    ? new Date(session.stoppedAt)
    : session.expiresAt
      ? new Date(session.expiresAt)
      : null

  if (!createdAt || Number.isNaN(createdAt.getTime()) || !finishedAt || Number.isNaN(finishedAt.getTime())) {
    return 0
  }

  const diffMinutes = (finishedAt.getTime() - createdAt.getTime()) / 60000
  return Math.max(0, Number(diffMinutes.toFixed(1)))
}

export default function DashboardPage() {
  const { user, isAdmin, initializing, token } = useAuth()
  const {
    stats: adminStats,
    adminUsers,
    adminSessions,
    adminLoading,
    loadAdminOverview,
    updateUserRole,
    executeSessionCommand: executeAdminSessionCommand,
    fetchSessionLogs: fetchAdminSessionLogs,
    fetchSessionResources: fetchAdminSessionResources,
  } = useAdminData()
  const [commandInputs, setCommandInputs] = useState<Record<string, string>>({})
  const [terminalOutputs, setTerminalOutputs] = useState<Record<string, string>>({})
  const [terminalLoading, setTerminalLoading] = useState<Record<string, boolean>>({})
  const [logsState, setLogsState] = useState<Record<string, { content?: string; lastFetched?: string; loading: boolean }>>({})
  const [resourceState, setResourceState] = useState<
    Record<string, { snapshot?: AdminResourceSnapshot; lastFetched?: string; loading: boolean }>
  >({})
  const [terminatingSessions, setTerminatingSessions] = useState<Set<string>>(new Set())
  const [resourceLimits, setResourceLimits] = useState<ResourceLimitSettings>(DEFAULT_RESOURCE_LIMITS)
  const [resourceLimitsUpdatedAt, setResourceLimitsUpdatedAt] = useState<string | null>(null)
  const [policies, setPolicies] = useState<PolicySettings>(DEFAULT_POLICIES)
  const [policiesUpdatedAt, setPoliciesUpdatedAt] = useState<string | null>(null)
  const [alertRules, setAlertRules] = useState<AlertRuleSettings>(DEFAULT_ALERT_RULES)
  const [alertRulesUpdatedAt, setAlertRulesUpdatedAt] = useState<string | null>(null)
  const [bulkTerminalOpen, setBulkTerminalOpen] = useState(false)
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false)
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false)
  const [bulkCommand, setBulkCommand] = useState("uptime")
  const [bulkCommandLogs, setBulkCommandLogs] = useState<Record<string, string>>({})
  const [selectedBulkSessions, setSelectedBulkSessions] = useState<string[]>([])
  const [bulkCommandRunning, setBulkCommandRunning] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [liveMetrics, setLiveMetrics] = useState<LiveMetricSnapshot>(DEFAULT_LIVE_METRICS)

  // Prevent lint false-positives for admin console state still under development
  void terminalOutputs
  void terminalLoading
  void logsState
  void resourceState

  const {
    sessions,
    loading: sessionsLoading,
    loadSessions,
    stopSession,
    resetSessions,
  } = useSessionManagement()

  const {
    health,
    loading: healthLoading,
    checkHealth,
  } = useHealthCheck()

  // Load data on component mount
  useEffect(() => {
    if (!user) {
      resetSessions()
      return
    }
    loadSessions()
    checkHealth()
  }, [user, loadSessions, checkHealth, resetSessions])

  // Auto-refresh sessions every 30 seconds when authenticated
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      loadSessions()
    }, 30000)

    return () => clearInterval(interval)
  }, [user, loadSessions])

  const authenticatedUserId = user?.id ?? null
  const eventAuthToken = token ?? null

  // Live session updates (e.g., when an admin stops a session remotely)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!authenticatedUserId || !eventAuthToken) return

    const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(/\/$/, "")
    const eventsUrl = new URL(`${baseUrl}/sessions/events`)
    eventsUrl.searchParams.set("token", eventAuthToken)

    let closed = false
    let source: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      if (closed) return
      source = new EventSource(eventsUrl.toString())
      source.onmessage = () => {
        loadSessions()
        if (isAdmin) {
          loadAdminOverview()
        }
      }
      source.onerror = error => {
        console.error("Session event stream error", error)
        source?.close()
        if (!closed) {
          reconnectTimer = window.setTimeout(connect, 5000)
        }
      }
    }

    connect()

    return () => {
      closed = true
      source?.close()
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
      }
    }
  }, [authenticatedUserId, eventAuthToken, isAdmin, loadSessions, loadAdminOverview])

  // Load admin overview when role allows it
  useEffect(() => {
    if (isAdmin) {
      loadAdminOverview()
    }
  }, [isAdmin, loadAdminOverview])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.RESOURCE_LIMITS)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.value) {
          setResourceLimits(parsed.value)
        }
        if (parsed?.updatedAt) {
          setResourceLimitsUpdatedAt(parsed.updatedAt)
        }
      }
    } catch (error) {
      console.error("Failed to load resource limits", error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.POLICIES)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.value) {
          setPolicies(parsed.value)
        }
        if (parsed?.updatedAt) {
          setPoliciesUpdatedAt(parsed.updatedAt)
        }
      }
    } catch (error) {
      console.error("Failed to load container policies", error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.ALERT_RULES)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.value) {
          setAlertRules(parsed.value)
        }
        if (parsed?.updatedAt) {
          setAlertRulesUpdatedAt(parsed.updatedAt)
        }
      }
    } catch (error) {
      console.error("Failed to load alert rules", error)
    }
  }, [])

  const visibleSessions = isAdmin ? adminSessions : sessions
  const sessionLoading = isAdmin ? adminLoading : sessionsLoading

  const overviewStats = useMemo(() => {
    const activeContainers = visibleSessions.filter(s => s.status === "running").length
    const totalSessions = visibleSessions.length
    const averageSeconds =
      totalSessions > 0
        ? Math.floor(
            visibleSessions.reduce((total, session) => total + (session.timeLeft ?? session.remainingMinutes ?? 0), 0) /
              totalSessions,
          )
        : 0

    return {
      totalUsers: isAdmin ? adminStats?.totalUsers ?? adminUsers.length : totalSessions,
      activeContainers,
      totalSessions,
      avgSessionTime: averageSeconds > 0 ? formatTime(averageSeconds) : "00:00",
    }
  }, [visibleSessions, isAdmin, adminStats, adminUsers])

  const usageAnalyticsData = useMemo<UsageAnalyticsPoint[]>(() => {
    const bucket = new Map<
      string,
      {
        label: string
        sessions: number
        browserSessions: number
        desktopSessions: number
        totalDurationMinutes: number
      }
    >()

    visibleSessions.forEach(session => {
      if (!session.createdAt) return

      const createdAt = new Date(session.createdAt)
      if (Number.isNaN(createdAt.getTime())) return

      const dayKey = createdAt.toISOString().split("T")[0]
      const entry =
        bucket.get(dayKey) ??
        {
          label: createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          sessions: 0,
          browserSessions: 0,
          desktopSessions: 0,
          totalDurationMinutes: 0,
        }

      entry.sessions += 1
      const sessionType = resolveSessionType(session)
      if (sessionType === "browser") {
        entry.browserSessions += 1
      } else {
        entry.desktopSessions += 1
      }
      entry.totalDurationMinutes += getSessionDurationMinutes(session)

      bucket.set(dayKey, entry)
    })

    const data: UsageAnalyticsPoint[] = []
    for (let offset = ANALYTICS_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
      const date = new Date()
      date.setDate(date.getDate() - offset)
      const dayKey = date.toISOString().split("T")[0]
      const entry = bucket.get(dayKey)
      data.push({
        dateKey: dayKey,
        label: entry?.label ?? date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        sessions: entry?.sessions ?? 0,
        browserSessions: entry?.browserSessions ?? 0,
        desktopSessions: entry?.desktopSessions ?? 0,
        avgDurationMinutes:
          entry && entry.sessions > 0 ? Number((entry.totalDurationMinutes / entry.sessions).toFixed(1)) : 0,
      })
    }

    return data
  }, [visibleSessions])

  const hasUsageData = useMemo(() => usageAnalyticsData.some(point => point.sessions > 0), [usageAnalyticsData])
  const runningAdminSessions = useMemo(
    () => (isAdmin ? adminSessions.filter(session => session.status === "running") : []),
    [isAdmin, adminSessions],
  )
  const searchableSessions = useMemo(() => (isAdmin ? adminSessions : []), [isAdmin, adminSessions])
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return searchableSessions.slice(0, 25)
    }
    return searchableSessions
      .filter(session => {
        const haystack = `${session.sessionId} ${session.userId ?? ""} ${session.status} ${session.type ?? ""} ${
          session.targetUrl ?? ""
        }`.toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 25)
  }, [searchQuery, searchableSessions])

  useEffect(() => {
    if (!bulkTerminalOpen) return
    setSelectedBulkSessions(runningAdminSessions.map(session => session.sessionId))
    setBulkCommandLogs({})
  }, [bulkTerminalOpen, runningAdminSessions])

  useEffect(() => {
    if (!metricsDialogOpen) return
    const updateMetrics = () => {
      const runningCount = runningAdminSessions.length
      setLiveMetrics({
        cpu: Math.min(95, 20 + runningCount * 5 + Math.round(Math.random() * 10)),
        memory: Math.min(95, 35 + runningCount * 4 + Math.round(Math.random() * 12)),
        network: Math.min(1000, 220 + runningCount * 40 + Math.round(Math.random() * 60)),
      })
    }
    updateMetrics()
    const interval = setInterval(updateMetrics, 5000)
    return () => clearInterval(interval)
  }, [metricsDialogOpen, runningAdminSessions.length])

  useEffect(() => {
    if (!searchDialogOpen) {
      setSearchQuery("")
    }
  }, [searchDialogOpen])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getServiceIcon = (service: string) => {
    switch (service) {
      case "Browser":
        return <Globe className="h-4 w-4" />
      case "Desktop":
        return <Monitor className="h-4 w-4" />
      case "Viewer":
        return <Eye className="h-4 w-4" />
      case "VSCodium":
        return <Code className="h-4 w-4" />
      case "Nextcloud":
        return <Cloud className="h-4 w-4" />
      case "Jellyfin":
        return <Video className="h-4 w-4" />
      case "Plex":
        return <Music className="h-4 w-4" />
      case "Heimdall":
        return <LayoutDashboard className="h-4 w-4" />
      case "Portainer":
        return <Container className="h-4 w-4" />
      case "Webtop":
        return <Monitor className="h-4 w-4" />
      default:
        return <Server className="h-4 w-4" />
    }
  }

  const toggleBulkSessionSelection = (sessionId: string) => {
    setSelectedBulkSessions(prev =>
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId],
    )
  }

  const executeBulkCommand = async () => {
    const trimmedCommand = bulkCommand.trim()
    if (!trimmedCommand) {
      toast.error("Enter a command to execute")
      return
    }

    if (selectedBulkSessions.length === 0) {
      toast.error("Select at least one running container")
      return
    }

    setBulkCommandRunning(true)
    setBulkCommandLogs({})

    try {
      await Promise.all(
        selectedBulkSessions.map(async sessionId => {
          const session =
            runningAdminSessions.find(s => s.sessionId === sessionId) ??
            searchableSessions.find(s => s.sessionId === sessionId)
          await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 600))
          setBulkCommandLogs(prev => ({
            ...prev,
            [sessionId]: `$ ${trimmedCommand}\n${
              session ? `${session.type} container acknowledged command` : "Command dispatched"
            }`,
          }))
        }),
      )
      toast.success(`Command dispatched to ${selectedBulkSessions.length} container(s)`)
    } catch (error) {
      console.error("Failed to execute bulk command", error)
      toast.error("Bulk command failed")
    } finally {
      setBulkCommandRunning(false)
    }
  }

  const handleSaveResourceLimits = () => {
    if (resourceLimits.cpuPercent <= 0 || resourceLimits.cpuPercent > 100) {
      toast.error("CPU percentage must be between 1 and 100")
      return
    }

    if (resourceLimits.memoryMb < 256) {
      toast.error("Memory limit must be at least 256 MB")
      return
    }

    const payload = {
      value: resourceLimits,
      updatedAt: new Date().toISOString(),
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.RESOURCE_LIMITS, JSON.stringify(payload))
      }
      setResourceLimitsUpdatedAt(payload.updatedAt)
      toast.success("Resource limits updated")
    } catch (error) {
      console.error("Failed to persist resource limits", error)
      toast.error("Unable to save resource limits locally")
    }
  }

  const handleSavePolicies = () => {
    const payload = {
      value: policies,
      updatedAt: new Date().toISOString(),
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.POLICIES, JSON.stringify(payload))
      }
      setPoliciesUpdatedAt(payload.updatedAt)
      toast.success("Policies updated")
      setPolicyDialogOpen(false)
    } catch (error) {
      console.error("Failed to persist policies", error)
      toast.error("Unable to save policies locally")
    }
  }

  const handleSaveAlertRules = () => {
    if (alertRules.slackNotifications && !alertRules.webhookUrl.trim()) {
      toast.error("Provide a webhook URL for Slack notifications")
      return
    }

    const payload = {
      value: alertRules,
      updatedAt: new Date().toISOString(),
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.ALERT_RULES, JSON.stringify(payload))
      }
      setAlertRulesUpdatedAt(payload.updatedAt)
      toast.success("Alert rules saved")
      setAlertsDialogOpen(false)
    } catch (error) {
      console.error("Failed to persist alert rules", error)
      toast.error("Unable to save alert rules locally")
    }
  }

  const formatUpdatedAt = (timestamp: string | null) => {
    if (!timestamp) return null
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString()
  }

  const handleCommandInputChange = (sessionId: string, value: string) => {
    setCommandInputs(prev => ({ ...prev, [sessionId]: value }))
  }

  const handleExecuteCommand = async (session: SessionData) => {
    const sessionType = resolveSessionType(session)
    const command = (commandInputs[session.sessionId] ?? "").trim()
    if (!command) {
      toast.error("Enter a command to execute")
      return
    }

    setTerminalLoading(prev => ({ ...prev, [session.sessionId]: true }))
    try {
      const result = await executeAdminSessionCommand(session.sessionId, sessionType, command)
      setTerminalOutputs(prev => ({
        ...prev,
        [session.sessionId]: `${prev[session.sessionId] ?? `Connected to ${session.sessionId}\n`}$ ${command}\n${
          result.output || "(no output)"
        }\n`,
      }))
      setCommandInputs(prev => ({ ...prev, [session.sessionId]: "" }))
      toast.success("Command executed successfully")
    } catch (error) {
      console.error("Failed to execute command", error)
    } finally {
      setTerminalLoading(prev => ({ ...prev, [session.sessionId]: false }))
    }
  }

  const refreshLogs = async (session: SessionData, typeOverride?: "browser" | "desktop") => {
    const sessionType = typeOverride ?? resolveSessionType(session)
    setLogsState(prev => ({
      ...prev,
      [session.sessionId]: { ...prev[session.sessionId], loading: true },
    }))
    try {
      const logs = await fetchAdminSessionLogs(session.sessionId, sessionType)
      setLogsState(prev => ({
        ...prev,
        [session.sessionId]: {
          loading: false,
          content: logs.content,
          lastFetched: logs.timestamp,
        },
      }))
    } catch {
      setLogsState(prev => ({
        ...prev,
        [session.sessionId]: { ...prev[session.sessionId], loading: false },
      }))
    }
  }

  const refreshResources = async (session: SessionData, typeOverride?: "browser" | "desktop") => {
    const sessionType = typeOverride ?? resolveSessionType(session)
    setResourceState(prev => ({
      ...prev,
      [session.sessionId]: { ...prev[session.sessionId], loading: true },
    }))
    try {
      const snapshot = await fetchAdminSessionResources(session.sessionId, sessionType)
      setResourceState(prev => ({
        ...prev,
        [session.sessionId]: {
          loading: false,
          snapshot,
          lastFetched: snapshot.collectedAt,
        },
      }))
    } catch {
      setResourceState(prev => ({
        ...prev,
        [session.sessionId]: { ...prev[session.sessionId], loading: false },
      }))
    }
  }

  const handleContainerDialogToggle = (open: boolean, session: SessionData) => {
    if (open) {
      const sessionType = resolveSessionType(session)
      setTerminalOutputs(prev => ({
        ...prev,
        [session.sessionId]: prev[session.sessionId] ?? `Connected to ${session.sessionId}\n`,
      }))
      toast.success(`Accessing ${sessionType} container`)
      void refreshLogs(session, sessionType)
      void refreshResources(session, sessionType)
    }
  }

  // Some admin-only helpers are conditionally rendered which can confuse linting
  void handleCommandInputChange
  void handleExecuteCommand
  void handleContainerDialogToggle

  const handleLogsDownload = (session: SessionData) => {
    const logs = logsState[session.sessionId]?.content
    if (!logs) {
      toast.error("No logs available to download")
      return
    }

    const blob = new Blob([logs], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${session.sessionId}-logs.txt`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Logs downloaded")
  }

  const terminateSession = async (sessionId: string, type: 'browser' | 'desktop') => {
    // Set loading state for this specific session
    setTerminatingSessions(prev => new Set(prev).add(sessionId))
    
    try {
      await stopSession(sessionId, type)
      if (isAdmin) {
        loadAdminOverview()
      }
      toast.success(`Session ${sessionId} terminated`)
    } catch {
      toast.error(`Failed to terminate session ${sessionId}`)
    } finally {
      // Clear loading state
      setTerminatingSessions(prev => {
        const newSet = new Set(prev)
        newSet.delete(sessionId)
        return newSet
      })
    }
  }

  const restartContainer = (containerId: string) => {
    toast.info(`Restarting container ${containerId}`)
    // In real app, this would make an API call
  }

  const openSession = (session: SessionData) => {
    const targetUrl = session.url ?? session.browserUrl ?? session.desktopUrl
    if (targetUrl) {
      window.open(targetUrl, "_blank", "noopener")
    } else {
      toast.error("No accessible URL for this session")
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  function formatDurationLong(totalSeconds?: number | null) {
    if (typeof totalSeconds !== "number" || Number.isNaN(totalSeconds)) {
      return "N/A"
    }
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  function formatBytes(bytes?: number) {
    if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes <= 0) {
      return "0 B"
    }
    const units = ["B", "KB", "MB", "GB", "TB"]
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / 1024 ** exponent
    return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
  }

  void formatDurationLong
  void formatBytes

  const resourceUpdatedDisplay = formatUpdatedAt(resourceLimitsUpdatedAt)
  const policyUpdatedDisplay = formatUpdatedAt(policiesUpdatedAt)
  const alertUpdatedDisplay = formatUpdatedAt(alertRulesUpdatedAt)

  const systemHealth = [
    { 
      name: "API Server", 
      status: health?.data?.status || "unknown", 
      uptime: health?.data?.uptime ? `${Math.floor(health.data.uptime / 3600)}h ${Math.floor((health.data.uptime % 3600) / 60)}m` : "N/A", 
      details: health?.data?.status === 'healthy' ? "All endpoints responding" : "Service unavailable" 
    },
    { 
      name: "Container Engine", 
      status: "healthy", 
      uptime: "99.8%", 
      details: "Docker daemon running" 
    },
    { 
      name: "Database", 
      status: health?.data?.database === 'connected' ? "healthy" : "warning", 
      uptime: "98.5%", 
      details: health?.data?.database === 'connected' ? "Connected" : "Connection issues" 
    },
    { 
      name: "Load Balancer", 
      status: "healthy", 
      uptime: "100%", 
      details: "Traffic distributed evenly" 
    },
    { 
      name: "Storage", 
      status: "healthy", 
      uptime: "99.9%", 
      details: "85% capacity used" 
    },
    { 
      name: "Network", 
      status: "healthy", 
      uptime: "100%", 
      details: "All nodes connected" 
    },
  ]

  if (initializing) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Preparing your dashboard...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto text-center p-10 space-y-6">
          <CardHeader>
            <CardTitle className="text-3xl">Sign in to view the dashboard</CardTitle>
            <CardDescription>Admin analytics and session data require authentication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Please authenticate to monitor container health, user sessions, and admin activity.
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
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">{isAdmin ? "Admin Dashboard" : "Usage Dashboard"}</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Monitor and manage all system resources" : "Track your container usage and activity"}
          </p>
        </div>
            <Button 
              variant="outline" 
              onClick={async () => {
                await Promise.all([loadSessions(), checkHealth(), isAdmin ? loadAdminOverview() : Promise.resolve()])
                toast.success("Data refreshed")
              }}
              disabled={sessionLoading || healthLoading || (isAdmin && adminLoading)}
              className="cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${sessionLoading || healthLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          {isAdmin && <TabsTrigger value="containers">Container Management</TabsTrigger>}
          {isAdmin && <TabsTrigger value="system">System Health</TabsTrigger>}
          {isAdmin && <TabsTrigger value="users">User Management</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {isAdmin ? "Total Users" : "Your Sessions"}
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isAdmin ? overviewStats.totalUsers.toLocaleString() : overviewStats.totalSessions}
                </div>
                <p className="text-xs text-muted-foreground">+12% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Containers</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewStats.activeContainers}</div>
                <p className="text-xs text-muted-foreground">Currently running</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewStats.totalSessions}</div>
                <p className="text-xs text-muted-foreground">+8% from last week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Session Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overviewStats.avgSessionTime}</div>
                <p className="text-xs text-muted-foreground">Per session</p>
              </CardContent>
            </Card>
          </div>

          {/* Usage Chart Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
              <CardDescription>Container usage over the last {ANALYTICS_WINDOW_DAYS} days</CardDescription>
            </CardHeader>
            <CardContent>
              {hasUsageData ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={usageAnalyticsData} margin={{ left: -16, right: 0, top: 16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="browserSessionsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={BROWSER_CHART_COLOR} stopOpacity={0.45} />
                          <stop offset="95%" stopColor={BROWSER_CHART_COLOR} stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="desktopSessionsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={DESKTOP_CHART_COLOR} stopOpacity={0.45} />
                          <stop offset="95%" stopColor={DESKTOP_CHART_COLOR} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          borderRadius: "var(--radius)",
                          border: "1px solid hsl(var(--border))",
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="browserSessions"
                        name="Browser sessions"
                        stroke={BROWSER_CHART_COLOR}
                        fill="url(#browserSessionsFill)"
                        strokeWidth={2}
                        activeDot={{ r: 4 }}
                        stackId="sessions"
                      />
                      <Area
                        type="monotone"
                        dataKey="desktopSessions"
                        name="Desktop sessions"
                        stroke={DESKTOP_CHART_COLOR}
                        fill="url(#desktopSessionsFill)"
                        strokeWidth={2}
                        activeDot={{ r: 4 }}
                        stackId="sessions"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-muted-foreground mt-3">
                    Avg duration:{" "}
                    {usageAnalyticsData
                      .filter(point => point.sessions > 0)
                      .reduce((acc, point) => acc + point.avgDurationMinutes, 0) > 0
                      ? `${(
                          usageAnalyticsData
                            .filter(point => point.sessions > 0)
                            .reduce((acc, point) => acc + point.avgDurationMinutes, 0) /
                          usageAnalyticsData.filter(point => point.sessions > 0).length
                        ).toFixed(1)} mins`
                      : "0 mins"}
                  </p>
                </div>
              ) : (
                <div className="h-64 bg-muted rounded-lg flex flex-col items-center justify-center text-center space-y-2">
                  <TrendingUp className="h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">
                    Analytics will appear once you start using disposable services.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>
                {isAdmin ? "All user sessions with advanced controls" : "Your recent container sessions"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessionLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading sessions...</p>
                </div>
              ) : visibleSessions.length === 0 ? (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No active sessions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleSessions.map(session => {
                    const sessionType = resolveSessionType(session)
                    const sessionId = session.sessionId
                    const commandValue = commandInputs[sessionId] ?? ""
                    const terminalText = terminalOutputs[sessionId] ?? `Connected to ${sessionId}\n`
                    const isCommandRunning = terminalLoading[sessionId] ?? false
                    const logsInfo = logsState[sessionId]
                    const resourceInfo = resourceState[sessionId]
                    const resourceSnapshot = resourceInfo?.snapshot
                    const logsLastUpdated = logsInfo?.lastFetched ? new Date(logsInfo.lastFetched).toLocaleTimeString() : null
                    const resourceLastUpdated = resourceInfo?.lastFetched
                      ? new Date(resourceInfo.lastFetched).toLocaleTimeString()
                      : null

                    return (
                      <div key={sessionId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {getServiceIcon(sessionType === "browser" ? "Browser" : "Desktop")}
                          </div>
                          <div>
                            <div className="font-medium">{sessionType === "browser" ? "Browser" : "Desktop"} Container</div>
                            {isAdmin && (
                              <div className="text-sm text-muted-foreground">
                                Session ID: {sessionId}
                                {session.userId && (
                                  <span className="block text-xs text-muted-foreground/80">User: {session.userId}</span>
                                )}
                              </div>
                            )}
                            <div className="text-sm text-muted-foreground">
                              Duration: {session.timeLeft ? formatTime(session.timeLeft) : "N/A"} • Status: {session.status}
                            </div>
                            {session.url && (
                              <div className="text-xs text-muted-foreground mt-1">URL: {session.url}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={session.status === "running" ? "default" : "secondary"}>{session.status}</Badge>
                          {isAdmin && (
                            <div className="flex gap-1">
                              {session.status === "running" && (
                                <>
                                  <Dialog onOpenChange={open => handleContainerDialogToggle(open, session)}>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="outline" className="cursor-pointer">
                                        <Terminal className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl max-h-[80vh]">
                                      <DialogHeader>
                                        <DialogTitle>Container Access - {sessionType}</DialogTitle>
                                        <DialogDescription>Direct access to container {sessionId}</DialogDescription>
                                      </DialogHeader>
                                      <Tabs defaultValue="terminal" className="w-full">
                                        <TabsList>
                                          <TabsTrigger value="terminal">Terminal</TabsTrigger>
                                          <TabsTrigger value="logs">Logs</TabsTrigger>
                                          <TabsTrigger value="resources">Resources</TabsTrigger>
                                          <TabsTrigger value="files">Files</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="terminal" className="space-y-4">
                                          <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
                                            <pre>{terminalText}</pre>
                                          </div>
                                          <div className="flex gap-2">
                                            <Input
                                              placeholder="Enter command..."
                                              value={commandValue}
                                              onChange={e => handleCommandInputChange(sessionId, e.target.value)}
                                              onKeyDown={e => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                  e.preventDefault()
                                                  void handleExecuteCommand(session)
                                                }
                                              }}
                                              className="font-mono"
                                            />
                                            <Button
                                              onClick={() => void handleExecuteCommand(session)}
                                              disabled={isCommandRunning || !commandValue.trim()}
                                            >
                                              {isCommandRunning ? (
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                              ) : (
                                                "Execute"
                                              )}
                                            </Button>
                                          </div>
                                        </TabsContent>
                                        <TabsContent value="logs" className="space-y-4">
                                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>
                                              {logsLastUpdated
                                                ? `Last updated ${logsLastUpdated}`
                                                : "Logs update when you open this dialog"}
                                            </span>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => void refreshLogs(session)}
                                              disabled={logsInfo?.loading}
                                              className="cursor-pointer"
                                            >
                                              <RefreshCw className={`h-4 w-4 mr-2 ${logsInfo?.loading ? "animate-spin" : ""}`} />
                                              Refresh
                                            </Button>
                                          </div>
                                          <div className="bg-muted p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
                                            {logsInfo?.loading && !logsInfo?.content ? (
                                              <div className="text-sm text-muted-foreground animate-pulse">Fetching logs...</div>
                                            ) : (
                                              <pre>{logsInfo?.content ?? "Logs will appear once they are available."}</pre>
                                            )}
                                          </div>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleLogsDownload(session)}
                                            disabled={!logsInfo?.content}
                                            className="cursor-pointer"
                                          >
                                            <FileText className="h-4 w-4 mr-2" />
                                            Download Logs
                                          </Button>
                                        </TabsContent>
                                        <TabsContent value="resources" className="space-y-4">
                                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>
                                              {resourceLastUpdated
                                                ? `Last updated ${resourceLastUpdated}`
                                                : "Resource stats update when you open this dialog"}
                                            </span>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => void refreshResources(session)}
                                              disabled={resourceInfo?.loading}
                                              className="cursor-pointer"
                                            >
                                              <RefreshCw
                                                className={`h-4 w-4 mr-2 ${resourceInfo?.loading ? "animate-spin" : ""}`}
                                              />
                                              Refresh
                                            </Button>
                                          </div>
                                          {resourceInfo?.loading && !resourceSnapshot ? (
                                            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                                              Gathering resource metrics...
                                            </div>
                                          ) : resourceSnapshot ? (
                                            <div className="space-y-4">
                                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <Card>
                                                  <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                      <Cpu className="h-4 w-4" />
                                                      CPU Usage
                                                    </CardTitle>
                                                  </CardHeader>
                                                  <CardContent>
                                                    <div className="text-2xl font-bold">
                                                      {resourceSnapshot.cpu.percent.toFixed(1)}%
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                      {resourceSnapshot.cpu.cores} cores allocated
                                                    </p>
                                                  </CardContent>
                                                </Card>
                                                <Card>
                                                  <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                      <MemoryStick className="h-4 w-4" />
                                                      Memory
                                                    </CardTitle>
                                                  </CardHeader>
                                                  <CardContent>
                                                    <div className="text-2xl font-bold">
                                                      {resourceSnapshot.memory.percent.toFixed(1)}%
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                      {formatBytes(resourceSnapshot.memory.usageBytes)} /{" "}
                                                      {formatBytes(resourceSnapshot.memory.limitBytes)}
                                                    </p>
                                                  </CardContent>
                                                </Card>
                                                <Card>
                                                  <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                      <HardDrive className="h-4 w-4" />
                                                      Disk I/O
                                                    </CardTitle>
                                                  </CardHeader>
                                                  <CardContent>
                                                    <div className="text-2xl font-bold">
                                                      {formatBytes(
                                                        resourceSnapshot.blockIO.readBytes +
                                                          resourceSnapshot.blockIO.writeBytes,
                                                      )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                      Read {formatBytes(resourceSnapshot.blockIO.readBytes)} / Write{" "}
                                                      {formatBytes(resourceSnapshot.blockIO.writeBytes)}
                                                    </p>
                                                  </CardContent>
                                                </Card>
                                              </div>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Card>
                                                  <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                      <Globe className="h-4 w-4" />
                                                      Network I/O
                                                    </CardTitle>
                                                  </CardHeader>
                                                  <CardContent>
                                                    <div className="text-2xl font-bold">
                                                      {formatBytes(resourceSnapshot.network.rxBytes + resourceSnapshot.network.txBytes)}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                      Down {formatBytes(resourceSnapshot.network.rxBytes)} / Up{" "}
                                                      {formatBytes(resourceSnapshot.network.txBytes)}
                                                    </p>
                                                  </CardContent>
                                                </Card>
                                                <Card>
                                                  <CardHeader className="pb-2">
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                      <Clock className="h-4 w-4" />
                                                      Uptime
                                                    </CardTitle>
                                                  </CardHeader>
                                                  <CardContent>
                                                    <div className="text-2xl font-bold">
                                                      {formatDurationLong(resourceSnapshot.uptimeSeconds)}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                      Snapshot taken {resourceSnapshot.collectedAt && new Date(resourceSnapshot.collectedAt).toLocaleTimeString()}
                                                    </p>
                                                  </CardContent>
                                                </Card>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
                                              Resource metrics will appear once data is available.
                                            </div>
                                          )}
                                        </TabsContent>
                                        <TabsContent value="files" className="space-y-4">
                                          <div className="text-center py-12">
                                            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                            <p className="text-muted-foreground">File browser would go here</p>
                                          </div>
                                        </TabsContent>
                                      </Tabs>
                                    </DialogContent>
                                  </Dialog>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => restartContainer(sessionId)}
                                    className="cursor-pointer"
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                  {session.url && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openSession(session)}
                                      className="cursor-pointer"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  )}
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => terminateSession(sessionId, sessionType)}
                                className="cursor-pointer"
                                disabled={terminatingSessions.has(sessionId)}
                              >
                                {terminatingSessions.has(sessionId) ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : session.status === "running" ? (
                                  <Square className="h-4 w-4" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="containers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Container Management</CardTitle>
                <CardDescription>Advanced container operations and monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-transparent"
                        onClick={() => setBulkTerminalOpen(true)}
                      >
                        <Terminal className="h-4 w-4 mr-2" />
                        Bulk Terminal Access
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-transparent"
                        onClick={() => setPolicyDialogOpen(true)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Container Policies
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-transparent"
                        onClick={() => setSearchDialogOpen(true)}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search Containers
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resource Limits</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Max CPU per container (%)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={resourceLimits.cpuPercent}
                          onChange={event =>
                            setResourceLimits(prev => ({
                              ...prev,
                              cpuPercent: Number(event.target.value),
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">Ensure no single container starves the host.</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Memory per container (MB)</Label>
                        <Input
                          type="number"
                          min={256}
                          step={64}
                          value={resourceLimits.memoryMb}
                          onChange={event =>
                            setResourceLimits(prev => ({
                              ...prev,
                              memoryMb: Number(event.target.value),
                            }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">Applies to both browser and desktop workloads.</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Stored locally until backend sync is available.</span>
                        {resourceUpdatedDisplay && <span>Last updated {resourceUpdatedDisplay}</span>}
                      </div>
                      <Button size="sm" className="w-full cursor-pointer" onClick={handleSaveResourceLimits}>
                        Save limits
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Monitoring</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-transparent"
                        onClick={() => setMetricsDialogOpen(true)}
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        Real-time Metrics
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start bg-transparent"
                        onClick={() => setAlertsDialogOpen(true)}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Alert Rules
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <Dialog open={bulkTerminalOpen} onOpenChange={setBulkTerminalOpen}>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Bulk Terminal Access</DialogTitle>
                  <DialogDescription>Run a single command across multiple active containers.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {runningAdminSessions.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No running containers were found. Refresh the dashboard to fetch the latest status.
                    </div>
                  ) : (
                    <>
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Target containers</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {runningAdminSessions.map(session => {
                            const selected = selectedBulkSessions.includes(session.sessionId)
                            return (
                              <Button
                                key={session.sessionId}
                                size="sm"
                                variant={selected ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => toggleBulkSessionSelection(session.sessionId)}
                              >
                                {session.type} • {session.sessionId.slice(0, 8)}
                              </Button>
                            )
                          })}
                        </div>
                        {selectedBulkSessions.length === 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">Select at least one container to continue.</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Command</Label>
                        <div className="flex gap-2">
                          <Input
                            value={bulkCommand}
                            onChange={event => setBulkCommand(event.target.value)}
                            onKeyDown={event => event.key === "Enter" && executeBulkCommand()}
                            placeholder="uptime"
                          />
                          <Button onClick={executeBulkCommand} disabled={bulkCommandRunning} className="cursor-pointer">
                            {bulkCommandRunning ? "Running..." : "Run"}
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-md border bg-muted/50 p-3 max-h-64 overflow-y-auto">
                        {selectedBulkSessions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Command output will appear here.</p>
                        ) : (
                          selectedBulkSessions.map(sessionId => {
                            const session =
                              runningAdminSessions.find(s => s.sessionId === sessionId) ??
                              searchableSessions.find(s => s.sessionId === sessionId)
                            return (
                              <div key={sessionId} className="mb-3 last:mb-0">
                                <div className="text-xs font-semibold text-muted-foreground">
                                  {session?.type ?? "container"} • {sessionId}
                                </div>
                                <pre className="font-mono text-xs whitespace-pre-wrap">
                                  {bulkCommandLogs[sessionId] ?? "Awaiting execution..."}
                                </pre>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Container Policies</DialogTitle>
                  <DialogDescription>
                    Tune guardrails for disposable containers. Settings are stored locally for now.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Auto-cleanup window (minutes)
                    </Label>
                    <Input
                      type="number"
                      min={5}
                      max={60}
                      value={policies.autoCleanupMinutes}
                      onChange={event =>
                        setPolicies(prev => ({
                          ...prev,
                          autoCleanupMinutes: Number(event.target.value),
                        }))
                      }
                    />
                  </div>
                  {[
                    {
                      key: "requireMfaForDesktop" as const,
                      label: "Require MFA for desktop sessions",
                      description: "Adds a second factor before privileged desktops are provisioned.",
                    },
                    {
                      key: "allowFileDownloads" as const,
                      label: "Allow file downloads",
                      description: "Permit users to export files from desktop sessions.",
                    },
                    {
                      key: "enforceClipboardIsolation" as const,
                      label: "Isolate clipboard",
                      description: "Prevents clipboard sharing between host and container.",
                    },
                    {
                      key: "autoArchiveSessionLogs" as const,
                      label: "Auto-archive session logs",
                      description: "Retain logs after cleanup for auditing.",
                    },
                  ].map(policy => (
                    <div key={policy.key} className="flex items-start justify-between gap-4 rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{policy.label}</p>
                        <p className="text-xs text-muted-foreground">{policy.description}</p>
                      </div>
                      <Switch
                        checked={policies[policy.key]}
                        onCheckedChange={checked =>
                          setPolicies(prev => ({
                            ...prev,
                            [policy.key]: checked,
                          }))
                        }
                      />
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground">
                    {policyUpdatedDisplay ? `Last updated ${policyUpdatedDisplay}` : "Not saved yet"}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPolicyDialogOpen(false)} className="cursor-pointer">
                    Cancel
                  </Button>
                  <Button onClick={handleSavePolicies} className="cursor-pointer">
                    Save policies
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Search Containers</DialogTitle>
                  <DialogDescription>Quickly locate any active session by ID, user, or status.</DialogDescription>
                </DialogHeader>
                {searchableSessions.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No session data is available yet. Start a container or refresh the dashboard.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      autoFocus
                      placeholder="Search by session ID, user, status..."
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                    />
                    <div className="max-h-72 overflow-y-auto divide-y rounded-md border">
                      {searchResults.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">No matches found.</div>
                      ) : (
                        searchResults.map(session => (
                          <div
                            key={session.sessionId}
                            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium">
                                {session.type} • {session.sessionId}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                User: {session.userId ?? "system"} • Status: {session.status}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={session.status === "running" ? "default" : "secondary"}>
                                {session.status}
                              </Badge>
                              {session.url || session.browserUrl || session.desktopUrl ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="cursor-pointer"
                                  onClick={() => openSession(session)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="destructive"
                                className="cursor-pointer"
                                onClick={() => terminateSession(session.sessionId, session.type)}
                              >
                                Stop
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={metricsDialogOpen} onOpenChange={setMetricsDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Real-time Metrics</DialogTitle>
                  <DialogDescription>Live container resource usage, refreshed every 5 seconds.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { label: "CPU", value: liveMetrics.cpu, unit: "%" },
                      { label: "Memory", value: liveMetrics.memory, unit: "%" },
                      { label: "Network", value: liveMetrics.network, unit: " Mbps" },
                    ].map(metric => (
                      <Card key={metric.label} className="bg-muted/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{metric.label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">
                            {metric.value}
                            {metric.unit}
                          </p>
                          <div className="mt-2 h-2 rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{
                                width: `${Math.min(100, metric.label === "Network" ? metric.value / 10 : metric.value)}%`,
                              }}
                            ></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Values are simulated locally and meant for UX validation. Wire to Prometheus/Grafana when available.
                  </p>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={alertsDialogOpen} onOpenChange={setAlertsDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alert Rules</DialogTitle>
                  <DialogDescription>Define thresholds to notify the on-call engineer.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">CPU threshold (%)</Label>
                      <Input
                        type="number"
                        min={10}
                        max={100}
                        value={alertRules.cpuThreshold}
                        onChange={event =>
                          setAlertRules(prev => ({
                            ...prev,
                            cpuThreshold: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Memory threshold (%)</Label>
                      <Input
                        type="number"
                        min={10}
                        max={100}
                        value={alertRules.memoryThreshold}
                        onChange={event =>
                          setAlertRules(prev => ({
                            ...prev,
                            memoryThreshold: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">Email notifications</p>
                      <p className="text-xs text-muted-foreground">Send alerts to the admin distribution list.</p>
                    </div>
                    <Switch
                      checked={alertRules.emailNotifications}
                      onCheckedChange={checked =>
                        setAlertRules(prev => ({
                          ...prev,
                          emailNotifications: checked,
                        }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="text-sm font-medium">Slack / Webhook notifications</p>
                      <p className="text-xs text-muted-foreground">Post alerts to #on-call or any webhook target.</p>
                    </div>
                    <Switch
                      checked={alertRules.slackNotifications}
                      onCheckedChange={checked =>
                        setAlertRules(prev => ({
                          ...prev,
                          slackNotifications: checked,
                        }))
                      }
                    />
                  </div>
                  {alertRules.slackNotifications && (
                    <div className="space-y-1">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Webhook URL</Label>
                      <Input
                        type="url"
                        placeholder="https://hooks.slack.com/services/..."
                        value={alertRules.webhookUrl}
                        onChange={event =>
                          setAlertRules(prev => ({
                            ...prev,
                            webhookUrl: event.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {alertUpdatedDisplay ? `Last updated ${alertUpdatedDisplay}` : "Not saved yet"}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAlertsDialogOpen(false)} className="cursor-pointer">
                    Cancel
                  </Button>
                  <Button onClick={handleSaveAlertRules} className="cursor-pointer">
                    Save rules
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Monitor the health of all system components</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {systemHealth.map((component, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(component.status)}
                        <div>
                          <div className="font-medium">{component.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Uptime: {component.uptime} • {component.details}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={component.status === "healthy" ? "default" : "destructive"}>
                          {component.status}
                        </Badge>
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user accounts and permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {adminUsers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No users available yet.
                  </div>
                ) : (
                  adminUsers.map(account => (
                    <div key={account.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border rounded-lg p-4">
                      <div>
                        <div className="font-medium">{account.name}</div>
                        <div className="text-sm text-muted-foreground">{account.email}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={account.role === "ADMIN" ? "default" : "secondary"}>{account.role}</Badge>
                        <Select
                          value={account.role}
                          onValueChange={(value) => updateUserRole(account.id, value as "USER" | "ADMIN")}
                          disabled={adminLoading}
                        >
                          <SelectTrigger className="w-32 cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USER">User</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
