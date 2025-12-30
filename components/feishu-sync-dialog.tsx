"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

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
    added: number
    skipped: number
    totalFetched: number
  } | null>(null)

  useEffect(() => {
    setMessage({ type: "info", text: "正在连接飞书..." })
    handleSync()
  }, [])

  const handleSync = async () => {
    setLoading(true)
    setMessage({ type: "info", text: "正在同步飞书数据..." })

    try {
      const syncResponse = await fetch("/api/feishu-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // 空对象，服务端会使用环境变量
      })

      const result = await syncResponse.json()

      if (syncResponse.ok) {
        setSyncResult({
          added: result.count || 0,
          skipped: result.skipped || 0,
          totalFetched: result.totalFetched || 0,
        })
        setMessage({
          type: "success",
          text: `同步完成！新增 ${result.count || 0} 条，跳过 ${result.skipped || 0} 条重复`,
        })
        setTimeout(() => {
          onSyncSuccess?.()
          onClose()
        }, 2000)
      } else {
        if (result.error?.includes("环境变量")) {
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
      setMessage({ type: "error", text: "网络错误，请稍后重试" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">飞书数据同步</h2>
          <p className="text-sm text-gray-600 mt-1">从飞书多维表格同步12月报销数据</p>
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
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : message.type === "error"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}
            >
              <p className="font-medium">{message.text}</p>
              {syncResult && message.type === "success" && (
                <div className="mt-3 text-sm space-y-1">
                  <p>• 新增记录: {syncResult.added} 条</p>
                  <p>• 跳过重复: {syncResult.skipped} 条</p>
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
            <Button onClick={handleSync} className="bg-blue-600 hover:bg-blue-700">
              重试
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
