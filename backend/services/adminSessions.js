import Docker from "dockerode"
import CustomError from "../utils/CustomError.js"
import logger from "../utils/logger.js"
import { getActiveSessions } from "./docker.js"
import { getActiveDesktopSessions } from "./desktop.js"
import { getSessionById } from "../repositories/session.repository.js"

const docker = new Docker()

const normalizeType = type => (type === "desktop" ? "desktop" : "browser")

const collectStreamOutput = stream =>
  new Promise((resolve, reject) => {
    let output = ""
    stream.on("data", chunk => {
      output += chunk.toString()
    })
    stream.on("end", () => resolve(output))
    stream.on("error", reject)
  })

const ensureContainerAvailable = async (container, sessionId) => {
  try {
    return await container.inspect()
  } catch (error) {
    if (error.statusCode === 404) {
      throw new CustomError(`Container for session ${sessionId} is no longer available`, 404)
    }
    throw error
  }
}

const resolveSessionContainer = async (sessionId, type) => {
  const normalizedType = normalizeType(type)
  const activeList = normalizedType === "desktop" ? getActiveDesktopSessions() : getActiveSessions()
  const activeSession = activeList.find(session => session.sessionId === sessionId)

  if (activeSession?.containerId) {
    activeSession.type = normalizedType
    return {
      container: docker.getContainer(activeSession.containerId),
      session: activeSession,
      type: normalizedType,
    }
  }

  const persisted = await getSessionById(sessionId)
  if (!persisted || (persisted.type && persisted.type !== normalizedType)) {
    throw new CustomError(`Session ${sessionId} not found`, 404)
  }

  if (!persisted.containerId) {
    throw new CustomError(`Session ${sessionId} does not have an active container`, 409)
  }

  return {
    container: docker.getContainer(persisted.containerId),
    session: persisted,
    type: normalizedType,
  }
}

export const executeCommandInSession = async (sessionId, type, command) => {
  if (!command || !command.trim()) {
    throw new CustomError("Command is required", 400)
  }

  const targetSessionType = normalizeType(type)
  const { container } = await resolveSessionContainer(sessionId, targetSessionType)
  const containerInfo = await ensureContainerAvailable(container, sessionId)
  if (!containerInfo?.State?.Running) {
    throw new CustomError(`Session ${sessionId} is not running`, 409)
  }

  const exec = await container.exec({
    Cmd: ["sh", "-c", command],
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  })

  const stream = await exec.start({ hijack: true, stdin: false })
  const output = await collectStreamOutput(stream)
  const { ExitCode } = await exec.inspect()

  logger.info(`Admin executed command on ${sessionId} (${targetSessionType}): ${command}`)

  return {
    command,
    output: output.trim(),
    exitCode: ExitCode ?? 0,
    timestamp: new Date().toISOString(),
  }
}

export const fetchSessionLogs = async (sessionId, type, tail = 200) => {
  const targetSessionType = normalizeType(type)
  const { container, session } = await resolveSessionContainer(sessionId, targetSessionType)
  let containerInfo = null

  try {
    containerInfo = await ensureContainerAvailable(container, sessionId)
  } catch (error) {
    const isBrowser = (session?.type ?? targetSessionType) === "browser"
    if (!isBrowser || error.statusCode !== 404) {
      throw error
    }
  }

  const isBrowser = (session?.type ?? targetSessionType) === "browser"

  const safeTail = Number.isFinite(tail) ? Math.min(Math.max(Math.floor(tail), 50), 2000) : 200
  let logsBuffer
  if (containerInfo?.State?.Running || (containerInfo?.State?.Dead && isBrowser)) {
    logsBuffer = await container.logs({
      stdout: true,
      stderr: true,
      timestamps: true,
      tail: safeTail,
    })
  } else if (isBrowser) {
    // Browser containers often auto-remove; fall back to stored session log data when available
    const fallback = session?.logs ?? ""
    if (!fallback) {
      throw new CustomError(`Session ${sessionId} does not have accessible logs`, 409)
    }
    logsBuffer = Buffer.from(fallback)
  } else {
    throw new CustomError(`Session ${sessionId} is not running`, 409)
  }

  const content = logsBuffer.toString("utf-8")
  logger.debug(`Fetched ${safeTail} log lines for session ${sessionId} (${targetSessionType})`)

  return {
    content,
    tail: safeTail,
    timestamp: new Date().toISOString(),
  }
}

const calculateCpuPercent = stats => {
  const cpuDelta =
    (stats?.cpu_stats?.cpu_usage?.total_usage ?? 0) - (stats?.precpu_stats?.cpu_usage?.total_usage ?? 0)
  const systemDelta = (stats?.cpu_stats?.system_cpu_usage ?? 0) - (stats?.precpu_stats?.system_cpu_usage ?? 0)
  if (cpuDelta <= 0 || systemDelta <= 0) {
    return 0
  }

  const onlineCpus =
    stats?.cpu_stats?.online_cpus ?? stats?.cpu_stats?.cpu_usage?.percpu_usage?.length ?? 1
  return (cpuDelta / systemDelta) * onlineCpus * 100
}

const sumNetworkBytes = networks => {
  if (!networks) {
    return { rxBytes: 0, txBytes: 0 }
  }
  return Object.values(networks).reduce(
    (acc, iface) => {
      acc.rxBytes += iface.rx_bytes ?? 0
      acc.txBytes += iface.tx_bytes ?? 0
      return acc
    },
    { rxBytes: 0, txBytes: 0 },
  )
}

const summarizeBlockIO = blkioStats => {
  if (!blkioStats?.io_service_bytes_recursive) {
    return { readBytes: 0, writeBytes: 0 }
  }

  return blkioStats.io_service_bytes_recursive.reduce(
    (acc, entry) => {
      if (entry.op === "Read") {
        acc.readBytes += entry.value ?? 0
      }
      if (entry.op === "Write") {
        acc.writeBytes += entry.value ?? 0
      }
      return acc
    },
    { readBytes: 0, writeBytes: 0 },
  )
}

export const fetchSessionResourceUsage = async (sessionId, type) => {
  const targetSessionType = normalizeType(type)
  const { container, session } = await resolveSessionContainer(sessionId, targetSessionType)
  const inspection = await ensureContainerAvailable(container, sessionId)

  const stats = await container.stats({ stream: false })
  const cpuPercent = calculateCpuPercent(stats)

  const rawMemoryUsage = stats?.memory_stats?.usage ?? 0
  const cache = stats?.memory_stats?.stats?.cache ?? 0
  const memoryUsage = Math.max(0, rawMemoryUsage - cache)
  const memoryLimit = stats?.memory_stats?.limit ?? 0
  const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0

  const networkBytes = sumNetworkBytes(stats?.networks)
  const blockIO = summarizeBlockIO(stats?.blkio_stats)

  const startedAt = inspection?.State?.StartedAt ? new Date(inspection.State.StartedAt) : null
  const createdAt = !startedAt && session?.createdAt ? new Date(session.createdAt) : null
  const uptimeAnchor = startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : createdAt
  const uptimeSeconds =
    uptimeAnchor && !Number.isNaN(uptimeAnchor.getTime())
      ? Math.max(0, Math.floor((Date.now() - uptimeAnchor.getTime()) / 1000))
      : 0

  return {
    cpu: {
      percent: Number(cpuPercent.toFixed(1)),
      totalUsage: stats?.cpu_stats?.cpu_usage?.total_usage ?? 0,
      systemUsage: stats?.cpu_stats?.system_cpu_usage ?? 0,
      cores: stats?.cpu_stats?.online_cpus ?? stats?.cpu_stats?.cpu_usage?.percpu_usage?.length ?? 1,
    },
    memory: {
      usageBytes: memoryUsage,
      limitBytes: memoryLimit,
      percent: Number(memoryPercent.toFixed(1)),
    },
    network: networkBytes,
    blockIO,
    state: {
      startedAt: startedAt?.toISOString() ?? null,
      status: inspection?.State?.Status ?? "unknown",
    },
    collectedAt: new Date().toISOString(),
    uptimeSeconds,
  }
}


