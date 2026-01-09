"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Loader2, ChevronDown, ChevronRight } from "lucide-react"

interface AmountDetail {
  date: string
  category: string
  amount: number
  note: string
}

interface CategorySummary {
  category: string
  totalAmount: number
  count: number
  details: AmountDetail[]
}

interface AmountDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeName: string
  month: string
  totalAmount: number
}

export function AmountDetailsDialog({
  open,
  onOpenChange,
  employeeName,
  month,
  totalAmount,
}: AmountDetailsDialogProps) {
  const [categories, setCategories] = useState<CategorySummary[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedTotalAmount, setFetchedTotalAmount] = useState(0)

  useEffect(() => {
    if (open && employeeName && month) {
      fetchDetails()
    }
  }, [open, employeeName, month])

  const fetchDetails = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/get-amount-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeName, month }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || "获取明细失败")
      }

      const details = result.details || []
      setFetchedTotalAmount(result.totalAmount || 0)

      const categoryMap = new Map<string, AmountDetail[]>()

      details.forEach((detail: AmountDetail) => {
        const category = detail.category || "其他"
        if (!categoryMap.has(category)) {
          categoryMap.set(category, [])
        }
        categoryMap.get(category)!.push(detail)
      })

      const categorySummaries: CategorySummary[] = Array.from(categoryMap.entries()).map(([category, items]) => ({
        category,
        totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
        count: items.length,
        details: items.sort((a, b) => Number(b.date) - Number(a.date)), // Sort by date descending
      }))

      // Sort categories by total amount descending
      categorySummaries.sort((a, b) => b.totalAmount - a.totalAmount)

      setCategories(categorySummaries)
    } catch (err) {
      console.error("[v0] Error fetching amount details:", err)
      setError(err instanceof Error ? err.message : "获取明细失败")
    } finally {
      setLoading(false)
    }
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const formatDate = (timestamp: string | number) => {
    const date = new Date(Number(timestamp))
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
  }

  const isIncomplete = fetchedTotalAmount > 0 && Math.abs(fetchedTotalAmount - totalAmount) > 0.01

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {employeeName} - {month} 报销明细
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            总金额: ¥{totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">加载明细中...</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-600">{error}</div>
        ) : categories.length === 0 ? (
          <div className="py-8 px-6 space-y-4">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700">暂无明细记录</p>
              <p className="text-sm text-gray-500 mt-2">
                数据库中总金额: ¥
                {totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-gray-700">
              <p className="font-semibold text-yellow-800 mb-2">可能的原因：</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>飞书表格中该员工使用了不同的姓名格式（如英文名、昵称）</li>
                <li>该月份的明细数据还未同步到飞书表格</li>
                <li>这是历史数据（3-11月），飞书中可能已删除</li>
              </ul>
              <p className="mt-3 text-yellow-800">
                <strong>建议：</strong>在飞书表格中搜索该月份的记录，确认"支出人"字段中该员工的实际姓名。
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isIncomplete && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-sm">
                <p className="font-semibold text-yellow-800 mb-1">⚠️ 数据不完整</p>
                <p className="text-yellow-700">
                  飞书明细总额: ¥{fetchedTotalAmount.toFixed(2)} | 数据库总额: ¥{totalAmount.toFixed(2)} | 差额: ¥
                  {Math.abs(totalAmount - fetchedTotalAmount).toFixed(2)}
                </p>
                <p className="text-yellow-700 mt-1">
                  由于飞书API分页限制，可能无法获取所有明细记录。以下仅显示部分数据。
                </p>
              </div>
            )}

            {categories.map((categorySummary) => {
              const isExpanded = expandedCategories.has(categorySummary.category)
              return (
                <Card key={categorySummary.category} className="overflow-hidden border border-gray-300">
                  {/* Category header - clickable to expand/collapse */}
                  <button
                    onClick={() => toggleCategory(categorySummary.category)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                      )}
                      <span className="font-semibold text-gray-900">{categorySummary.category}</span>
                      <span className="text-sm text-gray-500">({categorySummary.count}条)</span>
                    </div>
                    <span className="font-bold text-blue-600">
                      ¥
                      {categorySummary.totalAmount.toLocaleString("zh-CN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </button>

                  {/* Expanded detail table */}
                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b bg-gray-100">
                            <th className="border-r border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-900">
                              日期
                            </th>
                            <th className="border-r border-gray-300 px-4 py-2 text-right text-sm font-semibold text-gray-900">
                              金额 (¥)
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">说明</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categorySummary.details.map((detail, index) => (
                            <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="border-r border-gray-300 px-4 py-2 text-sm text-gray-900">
                                {formatDate(detail.date)}
                              </td>
                              <td className="border-r border-gray-300 px-4 py-2 text-right text-sm font-semibold text-gray-900">
                                ¥
                                {detail.amount.toLocaleString("zh-CN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">{detail.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
