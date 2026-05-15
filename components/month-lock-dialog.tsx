"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Lock, Unlock, Calendar } from "lucide-react"

interface MonthLock {
  month: string
  is_locked: boolean
  locked_at?: string
}

interface MonthLockDialogProps {
  onLockChange?: () => void
}

export function MonthLockDialog({ onLockChange }: MonthLockDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [locks, setLocks] = useState<MonthLock[]>([])
  const [processingMonth, setProcessingMonth] = useState<string | null>(null)

  // 生成月份列表（最近18个月）
  const getMonthList = () => {
    const months = []
    const now = new Date()
    for (let i = 0; i < 18; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      months.push(`${year}年${month}月`)
    }
    return months
  }

  const fetchLocks = async () => {
    try {
      const response = await fetch("/api/month-lock")
      const result = await response.json()
      if (result.success) {
        setLocks(result.data || [])
      }
    } catch (error) {
      console.error("Error fetching locks:", error)
    }
  }

  useEffect(() => {
    if (open) {
      fetchLocks()
    }
  }, [open])

  const isLocked = (month: string) => {
    return locks.some((l) => l.month === month && l.is_locked)
  }

  const handleToggleLock = async (month: string, lock: boolean) => {
    setProcessingMonth(month)
    try {
      const response = await fetch("/api/month-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, lock }),
      })

      const result = await response.json()

      if (result.success) {
        await fetchLocks()
        onLockChange?.()
      } else {
        alert(result.error || "操作失败")
      }
    } catch (error) {
      console.error("Error toggling lock:", error)
      alert("操作失败，请重试")
    } finally {
      setProcessingMonth(null)
    }
  }

  const months = getMonthList()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Lock className="h-4 w-4 mr-1" />
          月份锁定
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>月份锁定管理</DialogTitle>
          <DialogDescription>
            锁定后的月份在飞书同步时不会被更新，已报销的数据将保持不变
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto">
          <div className="grid gap-2 py-4">
            {months.map((month) => {
              const locked = isLocked(month)
              const isProcessing = processingMonth === month

              return (
                <div
                  key={month}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    locked ? "bg-amber-50 border-amber-200" : "bg-background"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{month}</span>
                    {locked && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                        已锁定
                      </span>
                    )}
                  </div>
                  <Button
                    variant={locked ? "outline" : "default"}
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => handleToggleLock(month, !locked)}
                  >
                    {isProcessing ? (
                      "处理中..."
                    ) : locked ? (
                      <>
                        <Unlock className="h-4 w-4 mr-1" />
                        解锁
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-1" />
                        锁定
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
