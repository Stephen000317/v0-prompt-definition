import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { employee_name, month, min_amount, max_amount } = await request.json()

    const supabase = await createClient()
    let query = supabase
      .from("reimbursements")
      .select("*")
      .order("month", { ascending: false })
      .order("amount", { ascending: false })

    // 添加筛选条件
    if (employee_name) {
      query = query.eq("employee_name", employee_name)
    }
    if (month) {
      query = query.eq("month", month)
    }
    if (min_amount !== undefined) {
      const minNum = Number.parseFloat(min_amount.toString().replace(/[¥元,]/g, ""))
      if (!isNaN(minNum)) {
        query = query.gte("amount", minNum)
      }
    }
    if (max_amount !== undefined) {
      const maxNum = Number.parseFloat(max_amount.toString().replace(/[¥元,]/g, ""))
      if (!isNaN(maxNum)) {
        query = query.lte("amount", maxNum)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Query reimbursements error:", error)
      return NextResponse.json({ error: "查询报销记录失败" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Query reimbursements error:", error)
    return NextResponse.json({ error: "查询报销记录时发生错误" }, { status: 500 })
  }
}
