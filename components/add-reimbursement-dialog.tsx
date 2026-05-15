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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"

interface Employee {
  name: string
  account_number?: string
  bank_branch?: string
  bank_name?: string
  bank_region?: string
}

interface AddReimbursementDialogProps {
  onSuccess?: () => void
  employees?: Employee[]
}

export function AddReimbursementDialog({ onSuccess, employees = [] }: AddReimbursementDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNewEmployee, setIsNewEmployee] = useState(false)
  const [formData, setFormData] = useState({
    employee_name: "",
    amount: "",
    month: "",
    account_number: "",
    bank_branch: "",
    bank_name: "",
    bank_region: "",
    note: "",
  })

  // 当选择员工时，自动填充银行信息
  const handleEmployeeChange = (name: string) => {
    if (name === "__new__") {
      setIsNewEmployee(true)
      setFormData((prev) => ({
        ...prev,
        employee_name: "",
        account_number: "",
        bank_branch: "",
        bank_name: "",
        bank_region: "",
      }))
    } else {
      setIsNewEmployee(false)
      setFormData((prev) => ({ ...prev, employee_name: name }))
      
      const employee = employees.find((e) => e.name === name)
      if (employee) {
        setFormData((prev) => ({
          ...prev,
          employee_name: name,
          account_number: employee.account_number || "",
          bank_branch: employee.bank_branch || "",
          bank_name: employee.bank_name || "",
          bank_region: employee.bank_region || "",
        }))
      }
    }
  }

  // 生成月份选项（最近12个月）
  const getMonthOptions = () => {
    const options = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = date.getFullYear()
      const month = date.getMonth() + 1
      options.push(`${year}年${month}月`)
    }
    return options
  }

  const handleSubmit = async () => {
    if (!formData.employee_name || !formData.amount || !formData.month) {
      alert("请填写员工姓名、金额和月份")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/manual-reimbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message)
        setOpen(false)
        setIsNewEmployee(false)
        setFormData({
          employee_name: "",
          amount: "",
          month: "",
          account_number: "",
          bank_branch: "",
          bank_name: "",
          bank_region: "",
          note: "",
        })
        onSuccess?.()
      } else {
        alert(result.error || "新增失败")
      }
    } catch (error) {
      console.error("Error adding reimbursement:", error)
      alert("新增失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新增报销
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-zinc-900">
        <DialogHeader>
          <DialogTitle>手动新增报销</DialogTitle>
          <DialogDescription>
            添加一条新的报销记录，金额会累加到该员工该月的总金额中
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="employee" className="text-right">
              员工
            </Label>
            <select
              id="employee"
              className="col-span-3 flex h-10 w-full rounded-md border border-input bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              value={isNewEmployee ? "__new__" : formData.employee_name}
              onChange={(e) => handleEmployeeChange(e.target.value)}
            >
              <option value="">选择员工</option>
              {employees.map((emp) => (
                <option key={emp.name} value={emp.name}>
                  {emp.name}
                </option>
              ))}
              <option value="__new__">+ 新建员工</option>
            </select>
          </div>
          
          {/* 新建员工时显示姓名输入框 */}
          {isNewEmployee && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new_name" className="text-right">
                姓名
              </Label>
              <Input
                id="new_name"
                placeholder="输入新员工姓名"
                className="col-span-3"
                value={formData.employee_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, employee_name: e.target.value }))}
              />
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="month" className="text-right">
              月份
            </Label>
            <select
              id="month"
              className="col-span-3 flex h-10 w-full rounded-md border border-input bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              value={formData.month}
              onChange={(e) => setFormData((prev) => ({ ...prev, month: e.target.value }))}
            >
              <option value="">选择月份</option>
              {getMonthOptions().map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              金额
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              className="col-span-3"
              value={formData.amount}
              onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="account" className="text-right">
              银行账号
            </Label>
            <Input
              id="account"
              placeholder="银行卡号"
              className="col-span-3"
              value={formData.account_number}
              onChange={(e) => setFormData((prev) => ({ ...prev, account_number: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="bank" className="text-right">
              开户行
            </Label>
            <Input
              id="bank"
              placeholder="银行支行名称"
              className="col-span-3"
              value={formData.bank_branch}
              onChange={(e) => setFormData((prev) => ({ ...prev, bank_branch: e.target.value }))}
            />
          </div>
          
          {/* 新建员工时显示更多银行信息 */}
          {isNewEmployee && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bank_name" className="text-right">
                  银行名称
                </Label>
                <Input
                  id="bank_name"
                  placeholder="如：中信银行"
                  className="col-span-3"
                  value={formData.bank_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bank_name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bank_region" className="text-right">
                  银行地区
                </Label>
                <Input
                  id="bank_region"
                  placeholder="如：广东省/深圳市"
                  className="col-span-3"
                  value={formData.bank_region}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bank_region: e.target.value }))}
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="note" className="text-right">
              备注
            </Label>
            <Input
              id="note"
              placeholder="报销说明（可选）"
              className="col-span-3"
              value={formData.note}
              onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "提交中..." : "确认新增"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
