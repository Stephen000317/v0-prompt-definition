import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// 这个API用于定期ping Supabase，防止免费项目因7天不活动而暂停
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 执行一个简单的查询来保持数据库活跃
    const { data, error } = await supabase
      .from("reimbursements")
      .select("id")
      .limit(1)

    if (error) {
      console.error("[keep-alive] Supabase ping failed:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const timestamp = new Date().toISOString()
    console.log(`[keep-alive] Supabase ping successful at ${timestamp}`)
    
    return NextResponse.json({ 
      success: true, 
      message: "Supabase is alive",
      timestamp,
      recordsFound: data?.length || 0
    })
  } catch (error) {
    console.error("[keep-alive] Error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
