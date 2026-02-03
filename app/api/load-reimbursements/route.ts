import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("[load-reimbursements] Starting data load...")
    const supabase = await createClient()
    console.log("[load-reimbursements] Supabase client created")
    
    // 获取所有报销记录
    const { data, error } = await supabase
      .from("reimbursements")
      .select("*")
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[load-reimbursements] Supabase error:", JSON.stringify(error))
      return NextResponse.json({ 
        success: false, 
        error: error.message || "Database query failed" 
      }, { status: 500 })
    }
    
    console.log(`[load-reimbursements] Loaded ${data?.length || 0} records`)

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
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 })
  }
}
