import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { action, id, name, account_number, bank_branch } = await request.json()

    const supabase = await createClient()

    if (action === "add") {
      // 添加员工
      if (!name || !account_number || !bank_branch) {
        return NextResponse.json({ error: "缺少必需参数：姓名、账号、开户行" }, { status: 400 })
      }

      const { error } = await supabase.from("employees").insert({
        name,
        account_number,
        bank_branch,
      })

      if (error) {
        console.error("[v0] Add employee error:", error)
        return NextResponse.json({ error: "添加员工失败" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `员工 ${name} 已添加`,
        needsRefresh: true,
      })
    } else if (action === "update") {
      // 更新员工
      if (!id) {
        return NextResponse.json({ error: "缺少必需参数：id" }, { status: 400 })
      }

      const updateData: any = {}
      if (name) updateData.name = name
      if (account_number) updateData.account_number = account_number
      if (bank_branch) updateData.bank_branch = bank_branch

      const { error } = await supabase.from("employees").update(updateData).eq("id", id)

      if (error) {
        console.error("[v0] Update employee error:", error)
        return NextResponse.json({ error: "更新员工失败" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "员工信息已更新",
        needsRefresh: true,
      })
    } else if (action === "delete") {
      // 删除员工
      if (!id) {
        return NextResponse.json({ error: "缺少必需参数：id" }, { status: 400 })
      }

      const { error } = await supabase.from("employees").delete().eq("id", id)

      if (error) {
        console.error("[v0] Delete employee error:", error)
        return NextResponse.json({ error: "删除员工失败" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "员工已删除",
        needsRefresh: true,
      })
    } else {
      return NextResponse.json({ error: "无效的操作类型" }, { status: 400 })
    }
  } catch (error) {
    console.error("[v0] Manage employee error:", error)
    return NextResponse.json({ error: "管理员工时发生错误" }, { status: 500 })
  }
}
