"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AdminAuthDialog } from "@/components/admin-auth-dialog"

interface FeishuSyncDialogProps {
  onClose: () => void
  onSyncSuccess?: () => void
}

export function FeishuSyncDialog({ onClose, onSyncSuccess }: FeishuSyncDialogProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info"
    text: string
  } | null>(null)
  const [syncResult, setSyncResult] = useState<{
    inserted: number
    updated: number
    deleted: number
    skipped: number
  } | null>(null)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [adminCredentials, setAdminCredentials] = useState<{ username: string; password: string } | null>(null)

  useEffect(() => {
    setMessage({ type: "info", text: "正在连接飞书..." })
    handleSync()
  }, [])

  const handleAdminVerified = (username: string, password: string) => {
    setAdminCredentials({ username, password })
    setShowAuthDialog(false)
    handleSync(username, password)
  }

  const handleSync = async (adminUsername?: string, adminPassword?: string) => {
    setLoading(true)
    setMessage({ type: "info", text: "正在同步飞书数据..." })

    try {
      const syncResponse = await fetch("/api/feishu-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(adminUsername && adminPassword ? { adminUsername, adminPassword } : {}),
        }),
      })

      const result = await syncResponse.json()

      if (syncResponse.ok) {
        const inserted = result.inserted || 0
        const updated = result.updated || 0
        const deleted = result.deleted || 0
        const skipped = result.skipped || 0

        setSyncResult({
          inserted,
          updated,
          deleted,
          skipped,
        })

        const parts = []
        if (inserted > 0) parts.push(`新增 ${inserted} 条`)
        if (updated > 0) parts.push(`更新 ${updated} 条`)
        if (deleted > 0) parts.push(`删除 ${deleted} 条`)
        if (skipped > 0) parts.push(`跳过 ${skipped} 条`)

        const summaryText = parts.length > 0 ? `同步完成！${parts.join("，")}` : "同步完成！所有数据已是最新"

        setMessage({
          type: "success",
          text: summaryText,
        })
        setTimeout(() => {
          onSyncSuccess?.()
          onClose()
        }, 2000)
      } else {
        if (result.requiresAuth) {
          setShowAuthDialog(true)
          setMessage({
            type: "info",
            text: "检测到受保护的历史数据，需要管理员验证",
          })
        } else if (result.error?.includes("环境变量")) {
          setMessage({
            type: "error",
            text: "飞书配置未设置。请在Vercel项目设置中添加环境变量：FEISHU_APP_TOKEN, FEISHU_TABLE_ID, FEISHU_APP_ID, FEISHU_APP_SECRET",
          })
        } else {
          setMessage({ type: "error", text: result.error || "同步失败" })
        }
      }
    } catch (error) {
      console.error("[v0] Sync error:", error)
      setMessage({ type: "error", text: `飞书同步错误: ${error}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">飞书同步</h2>
          </div>

          <div className="space-y-4">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}

            {message && (
              <div
                className={`p-4 rounded-lg ${
                  message.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
                    : message.type === "error"
                      ? "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                      : "bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                }`}
              >
                <p className="font-medium">{message.text}</p>
                {syncResult && message.type === "success" && (
                  <div className="mt-3 text-sm space-y-1">
                    {syncResult.inserted > 0 && <p>• 新增记录: {syncResult.inserted} 条</p>}
                    {syncResult.updated > 0 && <p>• 更新记录: {syncResult.updated} 条</p>}
                    {syncResult.deleted > 0 && <p>• 删除记录: {syncResult.deleted} 条</p>}
                    {syncResult.skipped > 0 && <p>• 跳过记录: {syncResult.skipped} 条</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              {loading ? "同步中..." : "关闭"}
            </Button>
            {!loading && message?.type === "error" && (
              <Button onClick={() => handleSync()} className="bg-blue-600 hover:bg-blue-700">
                重试
              </Button>
            )}
          </div>
        </div>
      </div>

      <AdminAuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onVerified={handleAdminVerified}
        title="管理员验证"
        description="检测到要修改受保护的历史数据（2025年3月-11月），请输入管理员账号和密码"
      />
    </>
  )
}
