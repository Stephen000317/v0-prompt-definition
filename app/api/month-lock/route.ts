import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// 获取所有月份的锁定状态
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("month_locks")
      .select("*")
      .order("month", { ascending: false })

    if (error) {
      console.error("[month-lock] Error fetching locks:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("[month-lock] Exception:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

// 锁定或解锁月份
export async function POST(request: Request) {
  try {
    const { month, lock } = await request.json()

    if (!month) {
      return NextResponse.json({ error: "月份不能为空" }, { status: 400 })
    }

    const supabase = await createClient()

    // 使用upsert来更新或插入锁定状态
    const { data, error } = await supabase
      .from("month_locks")
      .upsert(
        {
          month,
          is_locked: lock,
          locked_at: lock ? new Date().toISOString() : null,
          locked_by: lock ? "admin" : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "month" }
      )
      .select()

    if (error) {
      console.error("[month-lock] Error updating lock:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: lock ? `${month} 已锁定` : `${month} 已解锁`,
      data,
    })
  } catch (error) {
    console.error("[month-lock] Exception:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
