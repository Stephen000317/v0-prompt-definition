import { NextResponse } from "next/server"

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

    const nameMapping: Record<string, string> = {
      Stephen: "蒋坤洪",
      stephen: "蒋坤洪",
      lewis: "李宇航",
      Lewis: "李宇航",
      "Lewis Li": "李宇航",
      "lewis li": "李宇航",
    }

    const reverseNameMapping: Record<string, string> = {
      蒋坤洪: "Stephen",
      李宇航: "Lewis",
    }

    // 如果传入的是中文名，转换为英文名去飞书查询
    const feishuEmployeeName = reverseNameMapping[employeeName] || employeeName
    console.log("[v0] 姓名映射:", { employeeName, feishuEmployeeName })

    // 获取飞书访问令牌
    const tokenResponse = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.FEISHU_APP_ID,
        app_secret: process.env.FEISHU_APP_SECRET,
      }),
    })

    const tokenData = await tokenResponse.json()
    if (tokenData.code !== 0) {
      throw new Error(`获取访问令牌失败: ${tokenData.msg}`)
    }

    const accessToken = tokenData.tenant_access_token
    const appToken = process.env.FEISHU_APP_TOKEN
    const tableId = process.env.FEISHU_TABLE_ID

    const extractValue = (field: any): string => {
      if (!field) return ""
      if (typeof field === "string" || typeof field === "number") return String(field)

      // 处理 {type: 1, value: [{text: "...", type: "text"}]} 结构
      if (field.value && Array.isArray(field.value) && field.value.length > 0) {
        const firstValue = field.value[0]
        if (firstValue.text) return firstValue.text
        if (typeof firstValue === "string") return firstValue
      }

      // 处理数组
      if (Array.isArray(field)) {
        const first = field[0]
        if (!first) return ""
        if (typeof first === "string") return first
        if (first.text) return first.text
        if (first.name) return first.name
      }

      // 处理简单对象
      if (field.text) return field.text
      if (field.name) return field.name

      return ""
    }

    // 从飞书获取所有数据
    const allRecords: FeishuRecord[] = []
    let hasMore = true
    let pageToken = ""
    let pageCount = 0
    const maxPages = 10 // 限制最多获取10页

    while (hasMore && pageCount < maxPages) {
      const requestBody: Record<string, unknown> = {
        page_size: 500,
        sort: [
          {
            field_name: "日期",
            desc: true,
          },
        ],
      }

      if (pageToken) {
        requestBody.page_token = pageToken
      }

      const response = await fetch(
        `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      )

      const data = await response.json()

      if (data.code !== 0) {
        throw new Error(`飞书API错误: ${data.msg}`)
      }

      if (data.data?.items) {
        allRecords.push(...data.data.items)
      }

      hasMore = data.data?.has_more || false
      pageToken = data.data?.page_token || ""
      pageCount++

      // 检测重复的page_token，避免无限循环
      if (hasMore && pageToken === requestBody.page_token) {
        console.log("[v0] Detected duplicate page_token, stopping pagination")
        break
      }
    }

    if (allRecords.length > 0) {
      const firstRecord = allRecords[0]
      const fieldNames = Object.keys(firstRecord.fields)
      console.log("[v0] 飞书表格的字段名称:", fieldNames)

      console.log("[v0] 第一条记录原始字段结构:", JSON.stringify(firstRecord.fields["支出人"], null, 2))
      console.log("[v0] 前5条记录的支出人字段:")
      for (let i = 0; i < Math.min(5, allRecords.length); i++) {
        const empName = extractValue(allRecords[i].fields["支出人"])
        const monthField = extractValue(allRecords[i].fields["月份"])
        const amountField = extractValue(allRecords[i].fields["金额"])
        console.log(`[v0]   记录${i + 1}: 支出人="${empName}" 月份="${monthField}" 金额="${amountField}"`)
      }

      console.log("[v0] 第一条记录示例:", {
        支出人: extractValue(firstRecord.fields["支出人"]),
        月份: extractValue(firstRecord.fields["月份"]),
        日期: extractValue(firstRecord.fields["日期"]),
        金额: extractValue(firstRecord.fields["金额"]),
        分类: extractValue(firstRecord.fields["分类"]),
      })
    }

    // 解析月份
    const parseMonth = (monthStr: string): { year: number; month: number } | null => {
      const patterns = [
        /(\d{4})-(\d{1,2})/, // 2025-12
        /(\d{4})年(\d{1,2})月/, // 2025年12月
        /(\d{4})\/(\d{1,2})/, // 2025/12
      ]

      for (const pattern of patterns) {
        const match = monthStr.match(pattern)
        if (match) {
          return { year: Number.parseInt(match[1]), month: Number.parseInt(match[2]) }
        }
      }
      return null
    }

    // 提取目标月份的年和月
    const targetMonth = parseMonth(month)
    console.log("[v0] 目标月份:", targetMonth)
    if (!targetMonth) {
      return NextResponse.json({ success: false, error: "无效的月份格式" })
    }

    // 过滤出目标员工和目标月份的记录
    const details: Array<{ date: string; category: string; amount: number; note: string }> = []

    let totalRecordsChecked = 0
    let matchedRecords = 0

    const uniqueDetails = new Set<string>()

    for (const item of allRecords) {
      totalRecordsChecked++
      const fields = item.fields
      const recordEmployeeName = extractValue(fields["支出人"])
      const monthField = extractValue(fields["月份"])
      const dateField = extractValue(fields["日期"])
      const category = extractValue(fields["分类"])
      const amountStr = extractValue(fields["金额"])
      const note = extractValue(fields["支出说明"])

      if (recordEmployeeName.toLowerCase() !== feishuEmployeeName.toLowerCase()) continue

      // 检查月份
      const recordMonth = parseMonth(monthField)
      if (!recordMonth || recordMonth.year !== targetMonth.year || recordMonth.month !== targetMonth.month) {
        continue
      }

      matchedRecords++
      // 提取金额
      const amount = Number.parseFloat(amountStr)
      if (Number.isNaN(amount)) continue

      const uniqueKey = `${recordEmployeeName}_${dateField}_${amount}_${category}_${note}`

      // 只保留第一次出现的记录
      if (!uniqueDetails.has(uniqueKey)) {
        uniqueDetails.add(uniqueKey)
        details.push({
          date: dateField,
          category,
          amount,
          note,
        })
      }
    }

    console.log("[v0] 记录过滤结果:", {
      totalRecordsChecked,
      matchedRecords,
      detailsCount: details.length,
      employeeName,
      feishuEmployeeName,
      month,
    })

    // 按日期排序（从早到晚）
    details.sort((a, b) => Number(a.date) - Number(b.date))

    return NextResponse.json({
      success: true,
      details,
      totalAmount: details.reduce((sum, d) => sum + d.amount, 0),
      recordCount: details.length,
    })
  } catch (error) {
    console.error("[v0] Error fetching amount details:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "获取明细失败",
    })
  }
}
