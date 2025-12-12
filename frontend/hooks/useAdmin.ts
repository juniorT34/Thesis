"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import apiClient, {
  AdminCommandResult,
  AdminLogsResponse,
  AdminResourceSnapshot,
  AdminSessionSummary,
  AdminStats,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
  UserAccount,
} from "@/lib/api";

export function useAdminData() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [sessions, setSessions] = useState<AdminSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAdminOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResponse, usersResponse, sessionsResponse] = await Promise.all([
        apiClient.getAdminStats(),
        apiClient.getAdminUsers(),
        apiClient.getAdminSessions(),
      ]);

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }
      if (usersResponse.success && usersResponse.data) {
        setUsers(usersResponse.data);
      }
      if (sessionsResponse.success && sessionsResponse.data) {
        setSessions(sessionsResponse.data);
      }
    } catch (error) {
      console.error("Failed to load admin overview", error);
      toast.error("Unable to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUserRole = useCallback(async (userId: string, role: "USER" | "ADMIN") => {
    try {
      const response = await apiClient.updateUserRole(userId, role);
      if (response.success && response.data) {
        const updatedUser = response.data;
        setUsers((prev) => prev.map((user) => (user.id === userId ? updatedUser : user)));
        toast.success(`Updated role to ${role}`);
      } else {
        toast.error(response.message || "Failed to update role");
      }
    } catch (error) {
      console.error("Failed to update user role", error);
      toast.error("Failed to update user role");
    }
  }, []);

  const createAdminUser = useCallback(
    async (payload: CreateAdminUserPayload) => {
      try {
        const response = await apiClient.createAdminUser(payload);
        if (response.success && response.data) {
          const createdUser = response.data;
          setUsers(prev => [createdUser, ...prev]);
          toast.success(`Created user ${createdUser.email}`);
          return createdUser;
        }
        const message = response.message || "Failed to create user";
        toast.error(message);
        throw new Error(message);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create user";
        toast.error(message);
        throw error;
      }
    },
    [],
  );

  const updateAdminUser = useCallback(
    async (userId: string, payload: UpdateAdminUserPayload) => {
      try {
        const response = await apiClient.updateAdminUser(userId, payload);
        if (response.success && response.data) {
          const updatedUser = response.data;
          setUsers(prev => prev.map(user => (user.id === userId ? updatedUser : user)));
          toast.success(`Updated ${updatedUser.email}`);
          return updatedUser;
        }
        const message = response.message || "Failed to update user";
        toast.error(message);
        throw new Error(message);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update user";
        toast.error(message);
        throw error;
      }
    },
    [],
  );

  const deleteAdminUser = useCallback(async (userId: string) => {
    try {
      const response = await apiClient.deleteAdminUser(userId);
      if (response.success && response.data) {
        setUsers(prev => prev.filter(user => user.id !== userId));
        toast.success("User removed");
        return response.data;
      }
      const message = response.message || "Failed to delete user";
      toast.error(message);
      throw new Error(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete user";
      toast.error(message);
      throw error;
    }
  }, []);

  const executeSessionCommand = useCallback(
    async (sessionId: string, type: "browser" | "desktop", command: string): Promise<AdminCommandResult> => {
      try {
        const response = await apiClient.executeAdminSessionCommand(sessionId, { type, command });
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || "Unable to execute command");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to execute command";
        toast.error(message);
        throw error;
      }
    },
    [],
  );

  const fetchSessionLogs = useCallback(
    async (sessionId: string, type: "desktop" | "browser", tail: number = 200): Promise<AdminLogsResponse> => {
      try {
        const response = await apiClient.getAdminSessionLogs(sessionId, { type, tail });
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || "Unable to fetch logs");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to fetch logs";
        toast.error(message);
        throw error;
      }
    },
    [],
  );

  const fetchSessionResources = useCallback(
    async (sessionId: string, type: "desktop" | "browser"): Promise<AdminResourceSnapshot> => {
      try {
        const response = await apiClient.getAdminSessionResources(sessionId, { type });
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || "Unable to fetch resource usage");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to fetch resource usage";
        toast.error(message);
        throw error;
      }
    },
    [],
  );

  return {
    stats,
    adminUsers: users,
    adminSessions: sessions,
    adminLoading: loading,
    loadAdminOverview,
    updateUserRole,
    createAdminUser,
    updateAdminUser,
    deleteAdminUser,
    executeSessionCommand,
    fetchSessionLogs,
    fetchSessionResources,
  };
}

