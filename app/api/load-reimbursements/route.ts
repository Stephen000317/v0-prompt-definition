import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    
    // 获取所有报销记录
    const { data, error } = await supabase
      .from("reimbursements")
      .select("*")
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[load-reimbursements] Error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 按月份分组
    const recordsByMonth: { [key: string]: any[] } = {}
    for (const record of data || []) {
      if (!recordsByMonth[record.month]) {
        recordsByMonth[record.month] = []
      }
      recordsByMonth[record.month].push(record)
    }

    return NextResponse.json({ success: true, data: recordsByMonth })
  } catch (error) {
    console.error("[load-reimbursements] Exception:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
