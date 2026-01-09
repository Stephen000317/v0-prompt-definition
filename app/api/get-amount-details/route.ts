import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface FeishuRecord {
  fields: {
    [key: string]: {
      type: number
      value?: unknown
    }
  }
}

export async function POST(request: Request) {
  try {
    const { employeeName, month } = await request.json()

    console.log("[v0] 获取明细参数:", { employeeName, month })

    if (!employeeName || !month) {
      return NextResponse.json({ success: false, error: "缺少必要参数" })
    }

    const supabase = await createClient()

    const { data: details, error } = await supabase
      .from("reimbursement_details")
      .select("date, amount, category, note")
      .eq("employee_name", employeeName)
      .eq("month", month)
      .order("date", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching details from database:", error)
      return NextResponse.json({
        success: false,
        error: "获取明细失败",
      })
    }

    if (!details || details.length === 0) {
      // Try to get the total amount from reimbursements table
      const { data: reimbursement } = await supabase
        .from("reimbursements")
        .select("amount")
        .eq("employee_name", employeeName)
        .eq("month", month)
        .single()

      return NextResponse.json({
        success: true,
        details: [],
        totalAmount: reimbursement?.amount || 0,
        recordCount: 0,
      })
    }

    // Format the details
    const formattedDetails = details.map((d) => ({
      date: String(d.date),
      category: d.category || "",
      amount: Number(d.amount),
      note: d.note || "",
    }))

    return NextResponse.json({
      success: true,
      details: formattedDetails,
      totalAmount: formattedDetails.reduce((sum, d) => sum + d.amount, 0),
      recordCount: formattedDetails.length,
    })
  } catch (error) {
    console.error("[v0] Error fetching amount details:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "获取明细失败",
    })
  }
}
