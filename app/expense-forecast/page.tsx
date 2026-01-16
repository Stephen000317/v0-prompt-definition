"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, Users, Tag, Edit2, Save } from "lucide-react"
import Link from "next/link"

interface ForecastItem {
  name: string
  predicted: number
  historical: number
  trend: number
  budget: number
  actual: number
  isEditing?: boolean
}

interface ForecastData {
  employeeForecasts: ForecastItem[]
  categoryForecasts: ForecastItem[]
  totalPredicted: number
  totalBudget: number
  totalActual: number
}

export default function ExpenseForecastPage() {
  const [forecastData, setForecastData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState("")
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem("isLoggedIn")
      if (!isLoggedIn) {
        router.push("/login")
      }
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    loadForecastData()
  }, [])

  async function loadForecastData() {
    try {
      const now = new Date()
      const monthStr = `${now.getFullYear()}年${now.getMonth() + 1}月`
      setCurrentMonth(monthStr)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime()

      const coreEmployees = ["蒋坤洪", "李宇航", "Justin"]
      const novemberStart = new Date("2025-11-01").getTime()
      const januaryStart = new Date("2026-01-01").getTime()

      const { data: detailsData, error: detailsError } = await supabase
        .from("reimbursement_details")
        .select("*")
        .order("date", { ascending: false })

      if (detailsError) throw detailsError

      // Get summary data for employees without details
      const { data: summaryData, error: summaryError } = await supabase
        .from("reimbursements")
        .select("*")
        .order("month", { ascending: false })

      if (summaryError) throw summaryError

      const { data: budgetData } = await supabase.from("budgets").select("*").eq("month", monthStr)

      const budgetMap = new Map()
      budgetData?.forEach((b) => {
        const key = b.employee_name ? `employee_${b.employee_name}` : `category_${b.category}`
        budgetMap.set(key, b.budget_amount)
      })

      const employeeData: Record<string, number[]> = {}
      const categoryData: Record<string, number[]> = {}
      const employeeActual: Record<string, number> = {}
      const categoryActual: Record<string, number> = {}
      const employeesWithDetails = new Set<string>()
      const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000

      const categoryMonthCounts: Record<string, number> = {}

      if (detailsData && detailsData.length > 0) {
        detailsData.forEach((record) => {
          employeesWithDetails.add(record.employee_name)

          const isCoreEmployee = coreEmployees.includes(record.employee_name)
          const shouldInclude = isCoreEmployee
            ? record.date && record.date > threeMonthsAgo
            : record.date && record.date >= novemberStart && record.date < januaryStart

          if (shouldInclude) {
            if (!employeeData[record.employee_name]) {
              employeeData[record.employee_name] = []
            }
            employeeData[record.employee_name].push(record.amount)

            const category = record.category || "其他"
            if (!categoryData[category]) {
              categoryData[category] = []
              categoryMonthCounts[category] = 3 // Default to 3 months assumption
            }
            categoryData[category].push(record.amount)
          }

          if (record.date && record.date >= monthStart && record.date <= monthEnd) {
            employeeActual[record.employee_name] = (employeeActual[record.employee_name] || 0) + record.amount
            const category = record.category || "其他"
            categoryActual[category] = (categoryActual[category] || 0) + record.amount
          }
        })
      }

      if (summaryData && summaryData.length > 0) {
        summaryData.forEach((record) => {
          // Skip if employee already has detail records
          if (employeesWithDetails.has(record.employee_name)) return

          // Only include November and December 2025 data for employees without details
          if (record.month === "2025年11月" || record.month === "2025年12月") {
            if (!employeeData[record.employee_name]) {
              employeeData[record.employee_name] = []
            }
            employeeData[record.employee_name].push(Number(record.amount))
          }
        })
      }

      Object.keys(categoryData).forEach((category) => {
        // If all amounts in this category come from non-core employees, use 2 months
        // Otherwise use 3 months (conservative estimate)
        let hasCoreEmployee = false
        if (detailsData) {
          detailsData.forEach((record) => {
            if ((record.category || "其他") === category && coreEmployees.includes(record.employee_name)) {
              hasCoreEmployee = true
            }
          })
        }
        categoryMonthCounts[category] = hasCoreEmployee ? 3 : 2
      })

      const employeeForecasts = Object.entries(employeeData).map(([name, amounts]) => {
        const isCoreEmployee = coreEmployees.includes(name)
        const hasDetails = employeesWithDetails.has(name)
        const total = amounts.reduce((sum, amt) => sum + amt, 0)
        const monthsCount = hasDetails ? (isCoreEmployee ? 3 : 2) : 2
        const avg = total / monthsCount
        const trend = amounts.length > 1 ? (amounts[0] - amounts[amounts.length - 1]) / amounts.length : 0
        const predicted = Math.round(avg + trend)
        const budget = budgetMap.get(`employee_${name}`) || predicted
        const actual = employeeActual[name] || 0

        return {
          name,
          predicted,
          historical: Math.round(avg),
          trend: avg > 0 ? Math.round((trend / avg) * 100) : 0,
          budget: Number(budget),
          actual: Math.round(actual),
        }
      })

      const categoryForecasts = Object.entries(categoryData).map(([category, amounts]) => {
        const total = amounts.reduce((sum, amt) => sum + amt, 0)
        const monthsCount = categoryMonthCounts[category] || 3
        const avg = total / monthsCount
        const trend = amounts.length > 1 ? (amounts[0] - amounts[amounts.length - 1]) / amounts.length : 0
        const predicted = Math.round(avg + trend)
        const budget = budgetMap.get(`category_${category}`) || predicted
        const actual = categoryActual[category] || 0

        return {
          name: category,
          predicted,
          historical: Math.round(avg),
          trend: avg > 0 ? Math.round((trend / avg) * 100) : 0,
          budget: Number(budget),
          actual: Math.round(actual),
        }
      })

      const totalPredicted = employeeForecasts.reduce((sum, item) => sum + item.predicted, 0)
      const totalBudget = employeeForecasts.reduce((sum, item) => sum + item.budget, 0)
      const totalActual = employeeForecasts.reduce((sum, item) => sum + item.actual, 0)

      setForecastData({
        employeeForecasts: employeeForecasts.sort((a, b) => b.predicted - a.predicted),
        categoryForecasts: categoryForecasts.sort((a, b) => b.predicted - a.predicted),
        totalPredicted,
        totalBudget,
        totalActual,
      })
    } catch (error) {
      console.error("Error loading forecast data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleEditBudget(type: "employee" | "category", index: number) {
    if (!forecastData) return

    const list = type === "employee" ? forecastData.employeeForecasts : forecastData.categoryForecasts
    const newList = [...list]
    newList[index] = { ...newList[index], isEditing: true }

    setForecastData({
      ...forecastData,
      [type === "employee" ? "employeeForecasts" : "categoryForecasts"]: newList,
    })
  }

  async function handleSaveBudget(type: "employee" | "category", index: number, newBudget: number) {
    if (!forecastData) return

    const list = type === "employee" ? forecastData.employeeForecasts : forecastData.categoryForecasts
    const item = list[index]

    try {
      console.log("[v0] Saving budget:", { type, name: item.name, newBudget, month: currentMonth })

      const { error } = await supabase.from("budgets").upsert(
        {
          employee_name: type === "employee" ? item.name : null,
          category: type === "category" ? item.name : null,
          month: currentMonth,
          budget_amount: newBudget,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "employee_name,category,month",
        },
      )

      if (error) {
        console.error("[v0] Error saving budget:", error)
        alert("保存失败，请重试")
        return
      }

      console.log("[v0] Budget saved successfully")

      const newList = [...list]
      newList[index] = { ...newList[index], budget: newBudget, isEditing: false }

      const totalBudget = type === "employee" ? newList.reduce((sum, i) => sum + i.budget, 0) : forecastData.totalBudget

      setForecastData({
        ...forecastData,
        [type === "employee" ? "employeeForecasts" : "categoryForecasts"]: newList,
        totalBudget: type === "employee" ? totalBudget : forecastData.totalBudget,
      })

      alert("预算已保存")
    } catch (error) {
      console.error("[v0] Error saving budget:", error)
      alert("保存失败，请重试")
    }
  }

  function getProgressPercentage(actual: number, budget: number): number {
    if (budget === 0) return 0
    return Math.min(Math.round((actual / budget) * 100), 100)
  }

  function getProgressColor(percentage: number): string {
    if (percentage >= 90) return "bg-red-500"
    if (percentage >= 70) return "bg-yellow-500"
    return "bg-green-500"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载预测数据...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">费用测算</h1>
              <p className="text-gray-600 mt-1">{currentMonth}预算执行情况</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="text-sm text-gray-600 mb-2">本月总预算</div>
            <div className="text-3xl font-bold text-blue-600 mb-2">¥{forecastData?.totalBudget.toLocaleString()}</div>
            <div className="text-sm text-gray-600 mb-1">
              已花费: ¥{forecastData?.totalActual.toLocaleString()}
              <span className="ml-2">
                ({forecastData ? getProgressPercentage(forecastData.totalActual, forecastData.totalBudget) : 0}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  forecastData
                    ? getProgressColor(getProgressPercentage(forecastData.totalActual, forecastData.totalBudget))
                    : "bg-gray-300"
                }`}
                style={{
                  width: `${forecastData ? getProgressPercentage(forecastData.totalActual, forecastData.totalBudget) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Employee Forecast */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-semibold">按人员预测</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {forecastData?.employeeForecasts.map((item, index) => {
                const progress = getProgressPercentage(item.actual, item.budget)
                return (
                  <div key={item.name} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-600">预测: ¥{item.predicted.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      {item.isEditing ? (
                        <>
                          <input
                            type="number"
                            defaultValue={item.budget}
                            className="flex-1 px-3 py-1 border border-gray-300 rounded"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveBudget("employee", index, Number(e.currentTarget.value))
                              }
                              if (e.key === "Escape") {
                                const newList = [...forecastData.employeeForecasts]
                                newList[index] = { ...newList[index], isEditing: false }
                                setForecastData({ ...forecastData, employeeForecasts: newList })
                              }
                            }}
                            autoFocus
                          />
                          <Save
                            className="w-4 h-4 text-green-600 cursor-pointer hover:text-green-700"
                            onClick={(e) => {
                              const input = e.currentTarget.previousElementSibling as HTMLInputElement
                              handleSaveBudget("employee", index, Number(input.value))
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <div className="flex-1 text-lg font-semibold text-blue-600">
                            预算: ¥{item.budget.toLocaleString()}
                          </div>
                          <Edit2
                            className="w-4 h-4 text-gray-400 cursor-pointer hover:text-blue-600"
                            onClick={() => handleEditBudget("employee", index)}
                          />
                        </>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      已花费: ¥{item.actual.toLocaleString()} ({progress}%)
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getProgressColor(progress)}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Category Forecast */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-semibold">按分类预测</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {forecastData?.categoryForecasts.map((item, index) => {
                const progress = getProgressPercentage(item.actual, item.budget)
                return (
                  <div key={item.name} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-600">预测: ¥{item.predicted.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      {item.isEditing ? (
                        <>
                          <input
                            type="number"
                            defaultValue={item.budget}
                            className="flex-1 px-3 py-1 border border-gray-300 rounded"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveBudget("category", index, Number(e.currentTarget.value))
                              }
                              if (e.key === "Escape") {
                                const newList = [...forecastData.categoryForecasts]
                                newList[index] = { ...newList[index], isEditing: false }
                                setForecastData({ ...forecastData, categoryForecasts: newList })
                              }
                            }}
                            autoFocus
                          />
                          <Save
                            className="w-4 h-4 text-green-600 cursor-pointer hover:text-green-700"
                            onClick={(e) => {
                              const input = e.currentTarget.previousElementSibling as HTMLInputElement
                              handleSaveBudget("category", index, Number(input.value))
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <div className="flex-1 text-lg font-semibold text-green-600">
                            预算: ¥{item.budget.toLocaleString()}
                          </div>
                          <Edit2
                            className="w-4 h-4 text-gray-400 cursor-pointer hover:text-green-600"
                            onClick={() => handleEditBudget("category", index)}
                          />
                        </>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      已花费: ¥{item.actual.toLocaleString()} ({progress}%)
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getProgressColor(progress)}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Methodology */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">功能说明</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>点击预算金额旁的编辑图标可手动调整预算</li>
            <li>进度条显示本月已花费占预算的百分比（绿色&lt;70%，黄色70-90%，红色&gt;90%）</li>
            <li>预测基于最近2-3个月的历史数据和趋势分析</li>
            <li>预算数据自动保存到数据库</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
