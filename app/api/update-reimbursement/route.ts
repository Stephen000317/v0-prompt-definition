import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Update reimbursement API called")

    const body = await request.json()
    console.log("[v0] Update request body:", body)

    const { id, old_employee_name, new_employee_name, employee_name, amount, note, month } = body

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient(supabaseUrl, supabaseKey)

    let recordId = id
    let existingRecord: any = null

    // 如果没有id，但有old_employee_name和month，先查询获取记录
    if (!recordId && old_employee_name && month) {
      console.log("[v0] Querying by old_employee_name and month:", old_employee_name, month)

      const { data, error: queryError } = await supabase
        .from("reimbursements")
        .select("*")
        .eq("employee_name", old_employee_name)
        .eq("month", month)
        .limit(1)
        .single()

      if (queryError || !data) {
        console.error("[v0] Query error:", queryError)
        return NextResponse.json(
          {
            success: false,
            error: `未找到员工${old_employee_name}在${month}的报销记录`,
          },
          { status: 200 },
        )
      }

      recordId = data.id
      existingRecord = data
      console.log("[v0] Found record:", existingRecord)
    }

    if (!recordId) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少必需参数：需要提供id或(old_employee_name + month)",
        },
        { status: 200 },
      )
    }

    // 如果还没有existingRecord，通过id查询
    if (!existingRecord) {
      const { data, error: fetchError } = await supabase.from("reimbursements").select("*").eq("id", recordId).single()

      if (fetchError || !data) {
        console.error("[v0] Fetch error:", fetchError)
        return NextResponse.json(
          {
            success: false,
            error: "未找到该报销记录",
          },
          { status: 200 },
        )
      }
      existingRecord = data
    }

    const updateData: { employee_name?: string; amount?: number; note?: string } = {}

    if (new_employee_name !== undefined) {
      updateData.employee_name = new_employee_name
      console.log("[v0] Updating employee_name to:", new_employee_name)
    } else if (employee_name !== undefined) {
      updateData.employee_name = employee_name
    }

    if (amount !== undefined) {
      const amountNum = Number.parseFloat(amount.toString().replace(/[¥元,]/g, ""))
      if (isNaN(amountNum) || amountNum <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "报销金额必须是大于0的有效数字",
          },
          { status: 200 },
        )
      }
      updateData.amount = amountNum
    }

    if (note !== undefined) {
      updateData.note = note
    }

    console.log("[v0] Update data:", updateData)

    // 更新报销记录
    const { error: updateError } = await supabase.from("reimbursements").update(updateData).eq("id", recordId)

    if (updateError) {
      console.error("[v0] Update error:", updateError)
      return NextResponse.json(
        {
          success: false,
          error: "更新报销记录失败: " + updateError.message,
        },
        { status: 200 },
      )
    }

    console.log("[v0] Update successful")

    // 如果金额改变了，需要更新月度汇总
    if (amount !== undefined) {
      const { data: monthRecords } = await supabase
        .from("reimbursements")
        .select("amount")
        .eq("month", existingRecord.month)

      const total = monthRecords?.reduce((sum, r) => sum + Number(r.amount), 0) || 0

      await supabase.from("monthly_summaries").upsert(
        {
          month: existingRecord.month,
          total_amount: total,
        },
        {
          onConflict: "month", // 指定当month冲突时更新现有记录
        },
      )
    }

    return NextResponse.json({
      success: true,
      message: `已成功更新报销记录${new_employee_name ? `，员工姓名已改为${new_employee_name}` : ""}`,
      needsRefresh: true,
    })
  } catch (error) {
    console.error("[v0] Update reimbursement error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "更新报销记录时发生错误: " + (error as Error).message,
      },
      { status: 200 },
    )
  }
}
