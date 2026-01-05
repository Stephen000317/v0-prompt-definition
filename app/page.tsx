"use client"

import { useMemo } from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ReimbursementTable } from "@/components/reimbursement-table"
import { MonthlyTrendChart } from "@/components/monthly-trend-chart"
import { PersonDistributionChart } from "@/components/person-distribution-chart"
import { FeishuSyncDialog } from "@/components/feishu-sync-dialog" // Import FeishuSyncDialog component for Feishu integration
import { AIChatbot } from "@/components/ai-chatbot" // Import AIChatbot component
import { AdminAuthDialog } from "@/components/admin-auth-dialog" // Import AdminAuthDialog component
import { ChevronLeft, ChevronRight, Plus, Download, Users, Menu } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  loadAllRecords,
  loadEmployees,
  saveRecord,
  updateRecord,
  deleteRecord,
  saveEmployee,
  deleteEmployee,
  initializeSampleData,
  exportDataBackup,
  type ReimbursementRecord,
  type EmployeeInfo,
  type MonthlyData,
} from "@/lib/db"

export default function Home() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [allRecords, setAllRecords] = useState<{ [month: string]: ReimbursementRecord[] }>({})
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [currentMonth, setCurrentMonth] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [employees, setEmployees] = useState<EmployeeInfo[]>([])
  const [showEmployeeManager, setShowEmployeeManager] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  const [editingRecord, setEditingRecord] = useState<ReimbursementRecord | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    account: "",
    branch: "",
    note: "",
  })
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeInfo | null>(null)
  const [employeeFormData, setEmployeeFormData] = useState({ name: "", account: "", branch: "" })
  const [showChatbot, setShowChatbot] = useState(false)
  const [showAiAnalysis, setShowAiAnalysis] = useState(false)
  const [showFeishuSyncDialog, setShowFeishuSyncDialog] = useState(false) // State for Feishu sync dialog
  const [showAdminAuth, setShowAdminAuth] = useState(false)
  const [pendingUpdate, setPendingUpdate] = useState<{
    id: string
    formData: typeof formData
  } | null>(null)

  const handlePreviousMonth = () => {
    const match = currentMonth.match(/(\d+)年(\d+)月/)
    if (!match) return

    const [, yearStr, monthStr] = match
    let year = Number(yearStr)
    let month = Number(monthStr)

    month--
    if (month < 1) {
      month = 12
      year--
    }

    setCurrentMonth(`${year}年${month}月`)
  }

  const handleNextMonth = () => {
    const match = currentMonth.match(/(\d+)年(\d+)月/)
    if (!match) return

    const [, yearStr, monthStr] = match
    let year = Number(yearStr)
    let month = Number(monthStr)

    month++
    if (month > 12) {
      month = 1
      year++
    }

    setCurrentMonth(`${year}年${month}月`)
  }

  const handleEmployeeSelect = (id: string) => {
    setSelectedEmployeeId(id)
    const selectedEmployee = employees.find((emp) => emp.id === id)
    if (selectedEmployee) {
      setFormData({
        name: selectedEmployee.name,
        amount: "",
        account: selectedEmployee.account_number,
        branch: selectedEmployee.bank_branch,
        note: "",
      })
    }
  }

  const handleFeishuSync = () => {
    setShowFeishuSyncDialog(true)
  }

  const handleRecordAdded = async (newRecord: ReimbursementRecord) => {
    setAllRecords({ ...allRecords, [newRecord.month]: [...(allRecords[newRecord.month] || []), newRecord] })
    setMonthlyData([
      ...monthlyData,
      {
        month: newRecord.month,
        total: (monthlyData.find((m) => m.month === newRecord.month)?.total || 0) + newRecord.amount,
      },
    ])
  }

  useEffect(() => {
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem("isLoggedIn")
      const loginTime = localStorage.getItem("loginTime")

      if (isLoggedIn === "true" && loginTime) {
        const timeDiff = new Date().getTime() - Number(loginTime)
        const hoursDiff = timeDiff / (1000 * 60 * 60)

        if (hoursDiff < 24) {
          setIsAuthenticated(true)
        } else {
          localStorage.removeItem("isLoggedIn")
          localStorage.removeItem("loginTime")
          router.push("/login")
        }
      } else {
        router.push("/login")
      }

      setIsChecking(false)
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (isAuthenticated) {
      loadDataFromSupabase()
    }
  }, [isAuthenticated])

  const loadDataFromSupabase = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const recordsByMonth = await loadAllRecords()
      const employeeList = await loadEmployees()

      const totalRecords = Object.values(recordsByMonth).reduce((sum, records) => sum + records.length, 0)

      if (totalRecords === 0) {
        await initializeSampleData()
        const newRecordsByMonth = await loadAllRecords()
        const newEmployees = await loadEmployees()
        organizeData(newRecordsByMonth, newEmployees)
      } else {
        organizeData(recordsByMonth, employeeList)
      }
    } catch (error) {
      console.error("[v0] 加载数据失败:", error)
      setError("加载数据失败，请刷新页面重试")
    } finally {
      setIsLoading(false)
    }
  }

  const organizeData = (recordsByMonth: { [month: string]: ReimbursementRecord[] }, employeeList: EmployeeInfo[]) => {
    const monthlyDataArray: MonthlyData[] = Object.keys(recordsByMonth)
      .map((month) => ({
        month,
        total: recordsByMonth[month].reduce((sum, record) => sum + record.amount, 0),
      }))
      .sort((a, b) => {
        const matchA = a.month.match(/(\d+)年(\d+)月/)
        const matchB = b.month.match(/(\d+)年(\d+)月/)
        if (!matchA || !matchB) return 0
        const [, yearA, monthA] = matchA
        const [, yearB, monthB] = matchB
        return Number(yearA) * 100 + Number(monthA) - (Number(yearB) * 100 + Number(monthB))
      })

    setAllRecords(recordsByMonth)
    setMonthlyData(monthlyDataArray)
    setEmployees(employeeList)

    if (monthlyDataArray.length > 0) {
      const latestMonth = monthlyDataArray[monthlyDataArray.length - 1].month
      setCurrentMonth(latestMonth)
    } else {
      setCurrentMonth("2025年11月")
    }
  }

  const handleAddRecord = async () => {
    if (!formData.name || !formData.amount) {
      alert("请填写姓名和金额")
      return
    }

    const amount = Number.parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert("请输入有效的金额")
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      if (editingRecord) {
        try {
          console.log("[v0] Attempting to update record...")
          await updateRecord(editingRecord.id, formData)
          console.log("[v0] Update successful")
        } catch (error) {
          console.log("[v0] Caught error in handleAddRecord:", error)
          if ((error as Error).message === "REQUIRES_AUTH") {
            console.log("[v0] Showing admin auth dialog")
            setPendingUpdate({
              id: editingRecord.id,
              formData: { ...formData },
            })
            setShowAdminAuth(true)
            setIsLoading(false)
            return
          }
          throw error
        }
      } else {
        const newRecord: ReimbursementRecord = {
          employee_name: formData.name,
          amount: amount,
          account_number: formData.account,
          bank_branch: formData.branch,
          month: currentMonth,
          note: formData.note,
        }

        await saveRecord(newRecord)

        if (formData.account && formData.branch) {
          const existingEmployee = employees.find((emp) => emp.name === formData.name)
          if (!existingEmployee) {
            const newEmployee: EmployeeInfo = {
              name: formData.name,
              account_number: formData.account,
              bank_branch: formData.branch,
            }
            await saveEmployee(newEmployee)
          }
        }
      }

      await loadDataFromSupabase()

      setFormData({ name: "", amount: "", account: "", branch: "", note: "" })
      setShowForm(false)
      setEditingRecord(null)
    } catch (error) {
      console.error("添加/更新记录失败:", error)
      setError((error as Error).message || "添加/更新记录失败，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteRecord = async (id: string) => {
    if (confirm("确认删除该报销记录？")) {
      setIsLoading(true)
      setError(null)
      try {
        const success = await deleteRecord(id)
        if (success) {
          await loadDataFromSupabase()
        } else {
          setError("删除失败，请重试")
        }
      } catch (error) {
        console.error("[v0] 删除失败:", error)
        setError("删除失败，请重试")
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleAddEmployee = async () => {
    if (!formData.name || !formData.account || !formData.branch) {
      alert("请填写员工姓名、账号和开户行")
      return
    }

    const existingEmployee = employees.find((e) => e.name === formData.name)
    if (existingEmployee) {
      alert("该员工已存在")
      return
    }

    try {
      const newEmployee: EmployeeInfo = {
        name: formData.name,
        account_number: formData.account,
        bank_branch: formData.branch,
      }

      await saveEmployee(newEmployee)
      await loadDataFromSupabase()
      alert("员工添加成功")
    } catch (error) {
      alert("添加员工失败，请重试")
    }
  }

  const handleDeleteEmployee = async (id: string) => {
    if (confirm("确认删除该员工信息？")) {
      try {
        await deleteEmployee(id)
        await loadDataFromSupabase()
      } catch (error) {
        alert("删除失败，请重试")
      }
    }
  }

  const handleSaveBackup = async () => {
    try {
      const success = await exportDataBackup()
      if (success) {
        alert("数据备份已保存到本地！")
      } else {
        alert("数据备份失败，请重试")
      }
    } catch (error) {
      console.error("[v0] Save backup error:", error)
      alert("数据备份失败")
    }
  }

  const handleResetData = async () => {
    if (confirm("确定要重置所有数据吗？此操作不可恢复！")) {
      try {
        await initializeSampleData()
        await loadDataFromSupabase()
        alert("数据重置成功")
      } catch (error) {
        alert("数据重置失败")
      }
    }
  }

  const handleLogout = () => {
    if (confirm("确定要退出登录吗？")) {
      localStorage.removeItem("isLoggedIn")
      localStorage.removeItem("loginTime")
      router.push("/login")
    }
  }

  const sortedMonthlyData = useMemo(() => {
    return [...monthlyData].sort((a, b) => {
      const matchA = a.month.match(/(\d+)年(\d+)月/)
      const matchB = b.month.match(/(\d+)年(\d+)月/)
      if (!matchA || !matchB) return 0
      const [, yearA, monthA] = matchA
      const [, yearB, monthB] = matchB
      return Number(yearA) * 100 + Number(monthA) - (Number(yearB) * 100 + Number(monthB))
    })
  }, [monthlyData])

  const currentMonthMatch = useMemo(() => {
    return currentMonth.match(/(\d+)年(\d+)月/)
  }, [currentMonth])

  const totalAllReimbursement = useMemo(() => {
    if (!currentMonthMatch) {
      return 0
    }
    const [, currentYear, currentMonthNum] = currentMonthMatch
    const currentValue = Number(currentYear) * 100 + Number(currentMonthNum)

    return sortedMonthlyData.reduce((sum, monthData) => {
      const monthMatch = monthData.month.match(/(\d+)年(\d+)月/)
      if (!monthMatch) return sum
      const [, year, month] = monthMatch
      const monthValue = Number(year) * 100 + Number(month)

      if (monthValue <= currentValue) {
        return sum + monthData.total
      }
      return sum
    }, 0)
  }, [sortedMonthlyData, currentMonthMatch])

  const cumulativeRange = useMemo(() => {
    if (sortedMonthlyData.length === 0) {
      return ""
    }

    if (!currentMonthMatch) {
      return ""
    }
    const [, currentYear, currentMonthNum] = currentMonthMatch
    const currentValue = Number(currentYear) * 100 + Number(currentMonthNum)

    const validMonths = sortedMonthlyData.filter((m) => {
      const match = m.month.match(/(\d+)年(\d+)月/)
      if (!match) return false
      const [, y, mo] = match
      return Number(y) * 100 + Number(mo) <= currentValue
    })

    if (validMonths.length === 0) {
      return ""
    }

    const startMonth = validMonths[0].month
    return `${startMonth} - ${currentMonth}`
  }, [sortedMonthlyData, currentMonthMatch])

  const handleEdit = (record: ReimbursementRecord) => {
    setEditingRecord(record)
    setFormData({
      name: record.employee_name,
      amount: record.amount.toString(),
      account: record.account_number,
      branch: record.bank_branch,
      note: record.note || "",
    })
    setShowForm(true)
  }

  const handleExportPDF = () => {
    window.print()
  }

  const currentRecords = allRecords[currentMonth] || []
  const currentMonthTotal = currentRecords.reduce((sum, record) => sum + record.amount, 0)

  const chartHeightClass = useMemo(() => {
    const recordCount = currentRecords.length
    if (recordCount <= 3) return "print-chart-extra-large"
    if (recordCount <= 5) return "print-chart-large"
    if (recordCount <= 8) return "print-chart-medium"
    return "print-chart-small"
  }, [currentRecords.length])

  const handleAdminVerified = async (username: string, password: string) => {
    if (!pendingUpdate) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/update-reimbursement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: pendingUpdate.id,
          employee_name: pendingUpdate.formData.name,
          amount: Number.parseFloat(pendingUpdate.formData.amount),
          account_number: pendingUpdate.formData.account,
          bank_branch: pendingUpdate.formData.branch,
          note: pendingUpdate.formData.note || null,
          adminUsername: username,
          adminPassword: password,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || "更新失败")
        return
      }

      await loadDataFromSupabase()
      setFormData({ name: "", amount: "", account: "", branch: "", note: "" })
      setShowForm(false)
      setEditingRecord(null)
      setShowAdminAuth(false)
      setPendingUpdate(null)
    } catch (error) {
      console.error("更新记录失败:", error)
      setError("更新记录失败，请重试")
    } finally {
      setIsLoading(false)
    }
  }

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">验证登录状态...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (isLoading && monthlyData.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-muted-foreground">加载报销数据中...</p>
          <p className="text-sm text-muted-foreground mt-2">请稍候</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {error && (
        <div className="fixed top-4 right-4 z-50 bg-destructive text-destructive-foreground px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {isLoading && monthlyData.length > 0 && (
        <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center">
          <div className="bg-background p-6 rounded-lg shadow-xl">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-muted-foreground">处理中...</p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl print:max-w-full print-content">
        <div className="print-page-container">
          <div className="mb-6 text-center print:mb-2 print-no-break">
            <h1 className="text-4xl font-bold text-black print:text-xl">深圳市无限状态科技有限公司</h1>
            <h2 className="mt-2 text-2xl font-semibold text-black print:text-base print:mt-0">报销一览表</h2>
            <div className="mt-3 flex items-center justify-center gap-2 print:hidden">
              <Button
                onClick={handlePreviousMonth}
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 bg-white border-gray-300"
              >
                <ChevronLeft className="h-4 w-4 text-black" />
              </Button>
              <p className="min-w-[120px] text-center text-black font-medium">{currentMonth}</p>
              <Button
                onClick={handleNextMonth}
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 bg-white border-gray-300"
              >
                <ChevronRight className="h-4 w-4 text-black" />
              </Button>
            </div>
            <p className="mt-1 hidden text-black print:block print:text-sm print:mt-0">{currentMonth}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6 print:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium transition-all">
                  <Menu className="h-4 w-4" />
                  管理
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setShowForm(!showForm)} className="cursor-pointer gap-2">
                  <Plus className="h-4 w-4" />
                  添加记录
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleFeishuSync} className="cursor-pointer gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Feishu同步
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSaveBackup} className="cursor-pointer gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  保存备份
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowEmployeeManager(!showEmployeeManager)}
                  className="cursor-pointer gap-2"
                >
                  <Users className="h-4 w-4" />
                  员工管理
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={handleExportPDF}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium transition-all print:hidden"
            >
              <Download className="h-4 w-4" />
              导出PDF
            </Button>

            <div className="ml-auto print:hidden">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="gap-2 bg-white border border-gray-300 text-black hover:bg-gray-50 shadow-sm rounded-lg px-4 py-2.5 text-sm font-medium transition-all print:hidden"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                退出登录
              </Button>
            </div>
          </div>

          {showEmployeeManager ? (
            <Card className="mb-6 p-6 print:hidden bg-white border border-gray-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-black">员工管理</h3>
                <Button onClick={() => setShowEmployeeManager(false)} variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </Button>
              </div>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input
                  placeholder="姓名"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="text-black bg-white border-gray-300"
                />
                <Input
                  placeholder="账号"
                  value={formData.account}
                  onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                  className="text-black bg-white border-gray-300"
                />
                <Input
                  placeholder="开户行"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="text-black bg-white border-gray-300"
                />
              </div>
              <div className="mb-4">
                <Button onClick={handleAddEmployee}>添加员工</Button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="px-4 py-2 text-left text-sm font-semibold text-black">姓名</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-black">账号</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-black">开户行</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-black">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-gray-300">
                        <td className="px-4 py-2 text-sm text-black">{emp.name}</td>
                        <td className="px-4 py-2 text-sm text-black">{emp.account_number}</td>
                        <td className="px-4 py-2 text-sm text-black">{emp.bank_branch}</td>
                        <td className="px-4 py-2">
                          <Button
                            onClick={() => handleDeleteEmployee(emp.id!)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                          >
                            删除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {showForm && (
            <Card className="mb-6 p-6 print:hidden bg-white border border-gray-300">
              <h3 className="mb-4 text-lg font-semibold text-black">
                {editingRecord ? "编辑报销记录" : "添加报销记录"}
              </h3>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-black mb-1">员工姓名</label>
                  <select
                    value={formData.name}
                    onChange={(e) => {
                      const selectedName = e.target.value
                      const employee = employees.find((emp) => emp.name === selectedName)
                      if (employee) {
                        setFormData({
                          ...formData,
                          name: selectedName,
                          account: employee.account_number,
                          branch: employee.bank_branch,
                        })
                      } else {
                        setFormData({ ...formData, name: selectedName })
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-black bg-white"
                  >
                    <option value="">选择员工或输入新员工</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="或输入新员工姓名"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-2 text-black bg-white border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">报销金额（¥）</label>
                  <Input
                    placeholder="金额"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    type="number"
                    step="0.01"
                    className="text-black bg-white border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">账号</label>
                  <Input
                    placeholder="银行账号"
                    value={formData.account}
                    onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    className="text-black bg-white border-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-black mb-1">开户行</label>
                  <Input
                    placeholder="开户行"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="text-black bg-white border-gray-300"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-black mb-1">备注</label>
                  <Input
                    placeholder="备注（可选）"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    className="text-black bg-white border-gray-300"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddRecord}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? "修改中..." : editingRecord ? "保存" : "添加"}
                </Button>
                <Button
                  onClick={() => {
                    setShowForm(false)
                    setEditingRecord(null)
                    setFormData({ name: "", amount: "", account: "", branch: "", note: "" })
                  }}
                  variant="outline"
                  className="border-gray-600 text-gray-700 hover:bg-gray-50"
                  disabled={isLoading}
                >
                  取消
                </Button>
              </div>
            </Card>
          )}

          {!showForm && !showEmployeeManager && (
            <>
              <div
                className={`chart-grid mb-6 grid grid-cols-1 gap-8 md:grid-cols-2 print:mb-4 print:gap-6 print-no-break ${chartHeightClass}`}
              >
                <MonthlyTrendChart data={monthlyData} currentMonth={currentMonth} />
                <PersonDistributionChart records={currentRecords} />
              </div>

              <div className="mb-6 print:mb-3 print-no-break">
                <ReimbursementTable records={currentRecords} onDelete={handleDeleteRecord} onEdit={handleEdit} />
              </div>
            </>
          )}

          <div className="mb-6 rounded-lg border border-gray-300 bg-gray-50 p-4 text-center print:mb-2 print:p-2 print:border print:border-gray-400 print-no-break">
            <p className="text-sm text-gray-700 print:text-xs">累计报销总额 ({cumulativeRange})</p>
            <p className="mt-2 text-3xl font-bold text-black print:text-xl print:mt-1">
              ¥{totalAllReimbursement.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* AI Assistant Button */}
      {!showChatbot && (
        <div className="fixed bottom-6 left-6 z-50 print:hidden">
          <button
            onClick={() => setShowChatbot(true)}
            className="w-14 h-14 bg-white hover:bg-gray-50 text-gray-900 rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center border border-gray-200"
            aria-label="打开AI助手"
          >
            <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Center node */}
              <circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.9" />

              {/* Orbital nodes - minimal geometric pattern */}
              <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.6" />
              <circle cx="24" cy="8" r="2" fill="currentColor" opacity="0.6" />
              <circle cx="8" cy="24" r="2" fill="currentColor" opacity="0.6" />
              <circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.6" />
            </svg>
          </button>
        </div>
      )}

      {/* AI Chatbot */}
      {showChatbot && (
        <AIChatbot
          allRecords={allRecords}
          monthlyData={monthlyData}
          currentMonth={currentMonth}
          onClose={() => setShowChatbot(false)}
          onRecordAdded={handleRecordAdded}
        />
      )}

      {/* Feishu Sync Dialog */}
      {showFeishuSyncDialog && (
        <FeishuSyncDialog onClose={() => setShowFeishuSyncDialog(false)} onSyncSuccess={loadDataFromSupabase} />
      )}

      {/* Admin Auth Dialog */}
      <AdminAuthDialog
        open={showAdminAuth}
        onOpenChange={(open) => {
          setShowAdminAuth(open)
          if (!open) {
            setPendingUpdate(null)
          }
        }}
        onVerified={handleAdminVerified}
        title="管理员验证"
        description="此月份数据受保护（2025年3-11月），需要管理员权限才能修改"
      />
    </div>
  )
}
