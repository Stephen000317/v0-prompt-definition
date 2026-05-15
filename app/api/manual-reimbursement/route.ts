import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// 手动新增报销记录
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      employee_name,
      amount,
      month,
      account_number,
      bank_branch,
      bank_name,
      bank_region,
      note,
    } = body

    // 验证必填字段
    if (!employee_name || !amount || !month) {
      return NextResponse.json(
        { error: "员工姓名、金额和月份为必填项" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 检查该月份是否已锁定
    const { data: lockData } = await supabase
      .from("month_locks")
      .select("is_locked")
      .eq("month", month)
      .single()

    if (lockData?.is_locked) {
      return NextResponse.json(
        { error: `${month} 已锁定，无法新增报销记录` },
        { status: 400 }
      )
    }

    // 查看该员工该月是否已有记录
    const { data: existingRecord } = await supabase
      .from("reimbursements")
      .select("*")
      .eq("employee_name", employee_name)
      .eq("month", month)
      .single()

    if (existingRecord) {
      // 如果存在，更新金额（累加）
      const newAmount = Number(existingRecord.amount) + Number(amount)
      const { error: updateError } = await supabase
        .from("reimbursements")
        .update({
          amount: newAmount,
          account_number: account_number || existingRecord.account_number,
          bank_branch: bank_branch || existingRecord.bank_branch,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRecord.id)

      if (updateError) {
        console.error("[manual-reimbursement] Update error:", updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      // 同时添加明细记录
      await supabase.from("reimbursement_details").insert({
        employee_name,
        amount: Number(amount),
        month,
        date: new Date().toISOString().split("T")[0],
        category: "手动添加",
        note: note || "手动新增报销",
      })

      return NextResponse.json({
        success: true,
        message: `已更新 ${employee_name} ${month} 的报销金额，新增 ¥${amount}，总计 ¥${newAmount.toFixed(2)}`,
      })
    } else {
      // 如果不存在，创建新记录
      const { error: insertError } = await supabase.from("reimbursements").insert({
        employee_name,
        amount: Number(amount),
        month,
        account_number: account_number || "",
        bank_branch: bank_branch || "",
      })

      if (insertError) {
        console.error("[manual-reimbursement] Insert error:", insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      // 同时添加明细记录
      await supabase.from("reimbursement_details").insert({
        employee_name,
        amount: Number(amount),
        month,
        date: new Date().toISOString().split("T")[0],
        category: "手动添加",
        note: note || "手动新增报销",
      })

      return NextResponse.json({
        success: true,
        message: `已新增 ${employee_name} ${month} 的报销记录，金额 ¥${amount}`,
      })
    }
  } catch (error) {
    console.error("[manual-reimbursement] Exception:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
