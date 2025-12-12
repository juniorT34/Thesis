"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Shield, Activity } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"

export default function ProfilePage() {
  const { user, initializing, refreshProfile } = useAuth()
  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    avatar: "",
    role: (user?.role ?? "USER").toLowerCase(),
    joinDate: user?.createdAt ?? new Date().toISOString(),
  })

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name,
        email: user.email,
        avatar: "",
        role: user.role.toLowerCase(),
        joinDate: user.createdAt ?? new Date().toISOString(),
      })
    }
  }, [user])

  const [settings, setSettings] = useState({
    notifications: true,
    autoStart: false,
    sessionDuration: 5,
    defaultDistro: "ubuntu",
    showWarnings: true,
    theme: "system",
  })

  const handleSaveProfile = async () => {
    await refreshProfile()
    toast.success("Profile refreshed")
  }

  const handleSaveSettings = () => {
    toast.success("Settings saved successfully!")
  }

  const recentActivity = [
    { action: "Started Browser Container", time: "2 hours ago", status: "success" },
    { action: "Extended Desktop session", time: "4 hours ago", status: "info" },
    { action: "Stopped Viewer Container", time: "1 day ago", status: "warning" },
    { action: "Started Desktop Container", time: "2 days ago", status: "success" },
  ]

  if (initializing) {
    return (
      <div className="container mx-auto px-4 py-16 text-center space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto text-center p-10 space-y-6">
          <CardHeader>
            <CardTitle className="text-3xl">Sign in to manage your profile</CardTitle>
            <CardDescription>Authentication is required to view profile information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
        <h1 className="text-3xl font-bold mb-2">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information and profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile.avatar || "/placeholder.svg"} />
                  <AvatarFallback className="text-lg">
                    {profile.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button variant="outline">Change Avatar</Button>
                  <p className="text-sm text-muted-foreground mt-2">JPG, PNG or GIF. Max size 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Account Role</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Member Since</Label>
                  <Input value={new Date(profile.joinDate).toLocaleDateString()} disabled />
                </div>
              </div>

              <Button onClick={handleSaveProfile}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
              <CardDescription>Configure your container service preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications for container events</p>
                </div>
                <Switch
                  checked={settings.notifications}
                  onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, notifications: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-start Containers</Label>
                  <p className="text-sm text-muted-foreground">Automatically start containers on page load</p>
                </div>
                <Switch
                  checked={settings.autoStart}
                  onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, autoStart: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Session Warnings</Label>
                  <p className="text-sm text-muted-foreground">Display warnings before session expiry</p>
                </div>
                <Switch
                  checked={settings.showWarnings}
                  onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, showWarnings: checked }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Session Duration (minutes)</Label>
                  <Select
                    value={settings.sessionDuration.toString()}
                    onValueChange={(value) =>
                      setSettings((prev) => ({ ...prev, sessionDuration: Number.parseInt(value) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 minute</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Default Linux Distribution</Label>
                  <Select
                    value={settings.defaultDistro}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, defaultDistro: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ubuntu">Ubuntu Desktop</SelectItem>
                      <SelectItem value="debian">Debian Desktop</SelectItem>
                      <SelectItem value="fedora">Fedora Desktop</SelectItem>
                      <SelectItem value="centos">CentOS Desktop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleSaveSettings}>Save Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent container usage and actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{activity.action}</div>
                      <div className="text-sm text-muted-foreground">{activity.time}</div>
                    </div>
                    <Badge
                      variant={
                        activity.status === "success"
                          ? "default"
                          : activity.status === "warning"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {activity.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security and privacy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Change Password</Label>
                  <p className="text-sm text-muted-foreground mb-4">Update your password to keep your account secure</p>
                  <div className="space-y-4 max-w-md">
                    <Input type="password" placeholder="Current password" />
                    <Input type="password" placeholder="New password" />
                    <Input type="password" placeholder="Confirm new password" />
                    <Button>Update Password</Button>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <Label className="text-base">Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground mb-4">Add an extra layer of security to your account</p>
                  <Button variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Enable 2FA
                  </Button>
                </div>

                <div className="pt-6 border-t">
                  <Label className="text-base text-destructive">Danger Zone</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete your account and all associated data
                  </p>
                  <Button variant="destructive">Delete Account</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
