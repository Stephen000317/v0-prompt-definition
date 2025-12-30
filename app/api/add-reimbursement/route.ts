import type { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { employee_name, amount, month, note } = await request.json()

    if (!employee_name || !amount || !month) {
      return Response.json({
        success: false,
        error: "缺少必填字段：员工姓名、报销金额和月份",
      })
    }

    const parsedAmount = Number.parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return Response.json({
        success: false,
        error: "报销金额必须是大于0的有效数字",
      })
    }

    const supabase = await createClient()

    let { data: employeeData, error: employeeError } = await supabase
      .from("employees")
      .select("account_number, bank_branch")
      .eq("name", employee_name)
      .maybeSingle()

    if (employeeError) {
      console.error("[v0] Query employee error:", employeeError)
      return Response.json({
        success: false,
        error: `查询员工信息失败: ${employeeError.message}`,
      })
    }

    if (!employeeData) {
      console.log(`[v0] Employee "${employee_name}" not found, creating automatically...`)

      const { data: newEmployee, error: createError } = await supabase
        .from("employees")
        .insert({
          name: employee_name,
          account_number: "待补充",
          bank_branch: "待补充",
        })
        .select("account_number, bank_branch")
        .single()

      if (createError) {
        console.error("[v0] Create employee error:", createError)
        return Response.json({
          success: false,
          error: `自动创建员工失败: ${createError.message}`,
        })
      }

      employeeData = newEmployee
      console.log(`[v0] Employee "${employee_name}" created successfully`)
    }

    const { data, error } = await supabase
      .from("reimbursements")
      .insert([
        {
          employee_name,
          amount: parsedAmount,
          bank_branch: employeeData.bank_branch,
          account_number: employeeData.account_number,
          month,
          note: note || "",
        },
      ])
      .select()

    if (error) {
      console.error("[v0] Error adding reimbursement:", error)
      return Response.json({
        success: false,
        error: `数据库错误: ${error.message}`,
      })
    }

    return Response.json({
      success: true,
      data: data?.[0],
      message: `已成功添加${employee_name}在${month}的报销记录，金额¥${parsedAmount.toFixed(2)}`,
    })
  } catch (error) {
    console.error("[v0] Add reimbursement error:", error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "添加报销记录失败",
    })
  }
}
