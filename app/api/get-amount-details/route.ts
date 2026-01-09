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

    const monthMatch = month.match(/(\d{4})年(\d{1,2})月/)
    if (monthMatch) {
      const year = Number.parseInt(monthMatch[1])
      const monthNum = Number.parseInt(monthMatch[2])

      if (year === 2025 && monthNum >= 3 && monthNum <= 11) {
        return NextResponse.json({
          success: true,
          isHistoricalData: true,
          details: [],
          totalAmount: 0,
          recordCount: 0,
          message: "这是历史数据（2025年3-11月），系统中只保存了汇总金额，没有明细记录。",
        })
      }
    }

    const supabase = await createClient()

    let details = null
    let shouldFetchFromFeishu = false

    try {
      const { data: allMonths, error: monthsError } = await supabase
        .from("reimbursement_details")
        .select("month, employee_name")
        .eq("employee_name", employeeName)
        .limit(10)

      console.log("[v0] 数据库中该员工的月份示例:", allMonths)

      const { data, error } = await supabase
        .from("reimbursement_details")
        .select("date, amount, category, note")
        .eq("employee_name", employeeName)
        .eq("month", month)
        .order("date", { ascending: true })

      console.log("[v0] 查询结果:", { dataCount: data?.length || 0, error: error?.message })

      if (error) {
        console.log("[v0] Database query failed, will fetch from Feishu:", error.message)
        shouldFetchFromFeishu = true
      } else if (!data || data.length === 0) {
        console.log("[v0] No details in database, will fetch from Feishu")
        shouldFetchFromFeishu = true
      } else {
        details = data
      }
    } catch (dbError) {
      console.log("[v0] Database error, will fetch from Feishu:", dbError)
      shouldFetchFromFeishu = true
    }

    if (shouldFetchFromFeishu) {
      return await fetchFromFeishu(employeeName, month)
    }

    // Format the details from database
    const formattedDetails = details!.map((d) => ({
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

async function fetchFromFeishu(employeeName: string, month: string) {
  console.log("[v0] Fetching details from Feishu API...")

  // Reverse name mapping: Chinese name -> English name in Feishu
  const reverseNameMapping: { [key: string]: string } = {
    蒋坤洪: "Stephen",
    李宇航: "Lewis Li",
  }

  const feishuEmployeeName = reverseNameMapping[employeeName] || employeeName

  // Get Feishu access token
  const tokenResponse = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  })

  const tokenData = await tokenResponse.json()
  const accessToken = tokenData.tenant_access_token

  // Fetch data from Feishu with date descending sort
  const searchResponse = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${process.env.FEISHU_APP_TOKEN}/tables/${process.env.FEISHU_TABLE_ID}/records/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page_size: 1000,
        sort: [{ field_name: "日期", desc: true }],
      }),
    },
  )

  const searchData = await searchResponse.json()
  const records = searchData.data?.items || []

  const extractValue = (field: any): string => {
    if (!field) return ""
    if (typeof field === "string") return field
    if (typeof field === "number") return String(field)
    if (field.value !== undefined) {
      if (typeof field.value === "string") return field.value
      if (typeof field.value === "number") return String(field.value)
      if (Array.isArray(field.value)) {
        return field.value.map((v: any) => v?.text || String(v)).join("")
      }
    }
    if (field.text) return field.text
    return ""
  }

  // Extract target month parts
  const monthMatch = month.match(/(\d{4})年(\d{1,2})月/)
  const targetYear = monthMatch ? monthMatch[1] : ""
  const targetMonth = monthMatch ? monthMatch[2] : ""

  // Filter and deduplicate
  const seen = new Set<string>()
  const matchedDetails: Array<{
    date: string
    category: string
    amount: number
    note: string
  }> = []

  for (const record of records) {
    const fields = record.fields || {}
    const recordEmployeeName = extractValue(fields["支出人"])
    const monthField = extractValue(fields["月份"])
    const dateField = extractValue(fields["日期"])
    const amountField = extractValue(fields["金额"])
    const categoryField = extractValue(fields["分类"])
    const noteField = extractValue(fields["支出说明"])

    // Check if employee name matches (case insensitive)
    if (recordEmployeeName.toLowerCase() !== feishuEmployeeName.toLowerCase()) {
      continue
    }

    // Check if month matches
    let monthMatches = false
    if (monthField.includes(`${targetYear}-${targetMonth}`) || monthField.includes(`${targetYear}年${targetMonth}月`)) {
      monthMatches = true
    } else {
      const match = monthField.match(/(\d{4})-(\d{1,2})/)
      if (match && match[1] === targetYear && match[2] === targetMonth) {
        monthMatches = true
      }
    }

    if (!monthMatches) continue

    const amount = Number.parseFloat(amountField) || 0
    const uniqueKey = `${recordEmployeeName}_${dateField}_${amount}_${categoryField}_${noteField}`

    if (seen.has(uniqueKey)) continue
    seen.add(uniqueKey)

    matchedDetails.push({
      date: dateField,
      category: categoryField,
      amount: amount,
      note: noteField,
    })
  }

  console.log(`[v0] Found ${matchedDetails.length} details from Feishu`)

  return NextResponse.json({
    success: true,
    details: matchedDetails,
    totalAmount: matchedDetails.reduce((sum, d) => sum + d.amount, 0),
    recordCount: matchedDetails.length,
  })
}
