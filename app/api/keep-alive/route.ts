import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// 这个API用于定期ping Supabase，防止免费项目因7天不活动而暂停
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // 添加重试机制，最多重试3次
    let lastError: Error | null = null
    let retries = 3
    
    while (retries > 0) {
      try {
        // 执行多个简单查询来确保数据库完全活跃
        const queries = [
          supabase.from("reimbursements").select("id").limit(1),
          supabase.from("reimbursement_details").select("id").limit(1),
          supabase.from("budgets").select("id").limit(1)
        ]
        
        const results = await Promise.allSettled(queries)
        const successCount = results.filter(r => r.status === 'fulfilled').length
        
        if (successCount > 0) {
          // 至少一个查询成功就算保活成功
          const timestamp = new Date().toISOString()
          console.log(`[keep-alive] Supabase ping successful at ${timestamp} (${successCount}/3 queries succeeded)`)
          
          return NextResponse.json({ 
            success: true, 
            message: "Supabase is alive",
            timestamp,
            queriesSucceeded: successCount,
            totalQueries: 3
          })
        }
        
        throw new Error("All queries failed")
      } catch (error) {
        lastError = error as Error
        retries--
        if (retries > 0) {
          // 等待2秒后重试
          await new Promise(resolve => setTimeout(resolve, 2000))
          console.log(`[keep-alive] Retrying... (${retries} attempts left)`)
        }
      }
    }
    
    console.error("[keep-alive] All retries failed:", lastError)
    return NextResponse.json({ 
      success: false, 
      error: lastError?.message || "Failed after all retries" 
    }, { status: 500 })
  } catch (error) {
    console.error("[keep-alive] Error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
