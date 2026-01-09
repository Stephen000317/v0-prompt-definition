import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isProtectedMonth, verifyAdminPassword } from "@/lib/auth-protection"

// 飞书多维表格API接口 - 支持分页
async function fetchAllFeishuTableData(appToken: string, tableId: string, accessToken: string) {
  let allItems: any[] = []
  let hasMore = true
  let pageToken: string | undefined = undefined
  let pageCount = 0
  const seenPageTokens = new Set<string>()
  const MAX_RECORDS = 2000
  let previousPageToken: string | undefined = undefined

  while (hasMore) {
    pageCount++

    if (allItems.length >= MAX_RECORDS) {
      break
    }

    if (pageToken && seenPageTokens.has(pageToken)) {
      break
    }

    if (pageToken) {
      seenPageTokens.add(pageToken)
    }

    if (pageToken && pageToken === previousPageToken) {
      break
    }

    const requestBody: any = {
      page_size: 500,
      ...(pageToken ? { page_token: pageToken } : {}),
      sort: [
        {
          field_name: "日期",
          desc: true,
        },
      ],
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

    if (!response.ok) {
      const errorData = await response.json()
      if (errorData.code === 99991672) {
        const permissionUrl = errorData.msg.match(/https:\/\/[^\s"]+/)?.[0]
        throw new Error(
          JSON.stringify({
            type: "permission_denied",
            message: "应用缺少必要权限",
            permissions: errorData.error?.permission_violations?.map((v: any) => v.subject) || [],
            authUrl: permissionUrl,
            details: errorData.msg,
          }),
        )
      }
      throw new Error(`飞书API请求失败 (${response.status}): ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    if (data.data?.items) {
      const itemsCount = data.data.items.length
      allItems = allItems.concat(data.data.items)

      if (itemsCount === 0) {
        break
      }
    }

    previousPageToken = pageToken
    hasMore = data.data?.has_more || false
    pageToken = data.data?.page_token

    if (!hasMore) {
      break
    }

    if (pageCount >= 200) {
      break
    }
  }

  const filteredItems = allItems.filter((item: any) => {
    const fields = item.fields
    const possibleMonthFields = ["月份", "month", "Month", "日期月份", "归属月份", "时间", "日期"]
    let monthField = ""

    for (const fieldName of possibleMonthFields) {
      const value = extractValueForFilter(fields[fieldName])
      if (value) {
        monthField = value
        break
      }
    }

    if (!monthField) {
      return false
    }

    let parsedYear = 0
    let parsedMonth = 0

    const dashMatch = monthField.match(/(\d{4})-(\d{1,2})/)
    if (dashMatch) {
      parsedYear = Number.parseInt(dashMatch[1])
      parsedMonth = Number.parseInt(dashMatch[2])
    }

    const chineseMatch = monthField.match(/(\d{4})年(\d{1,2})月/)
    if (chineseMatch) {
      parsedYear = Number.parseInt(chineseMatch[1])
      parsedMonth = Number.parseInt(chineseMatch[2])
    }

    if (parsedYear === 0 || parsedMonth === 0) {
      return false
    }

    return parsedYear > 2025 || (parsedYear === 2025 && parsedMonth >= 12)
  })

  return { items: filteredItems }
}

export async function POST(request: NextRequest) {
  try {
    let { appToken, tableId, accessToken, adminUsername, adminPassword } = await request.json()

    if (!appToken) appToken = process.env.FEISHU_APP_TOKEN
    if (!tableId) tableId = process.env.FEISHU_TABLE_ID

    if (!accessToken) {
      const appId = process.env.FEISHU_APP_ID
      const appSecret = process.env.FEISHU_APP_SECRET

      if (appId && appSecret) {
        const tokenResponse = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        })

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json()
          accessToken = tokenData.tenant_access_token
        }
      }
    }

    if (!appToken || !tableId || !accessToken) {
      return NextResponse.json(
        {
          error:
            "缺少必要参数：appToken, tableId, accessToken。请在Vercel项目设置中添加环境变量：FEISHU_APP_TOKEN, FEISHU_TABLE_ID, FEISHU_APP_ID, FEISHU_APP_SECRET",
        },
        { status: 400 },
      )
    }

    const feishuData = await fetchAllFeishuTableData(appToken, tableId, accessToken)

    const nameMapping: Record<string, string> = {
      Stephen: "蒋坤洪",
      stephen: "蒋坤洪",
      lewis: "李宇航",
      Lewis: "李宇航",
      "Lewis Li": "李宇航",
      "lewis li": "李宇航",
    }

    const uniqueItems = new Map<string, any>()

    feishuData.items.forEach((item: any) => {
      const fields = item.fields

      // 提取关键字段用于生成唯一键
      let employeeName = extractValue(fields["支出人"])
      if (nameMapping[employeeName]) {
        employeeName = nameMapping[employeeName]
      }

      const amount = extractNumber(fields["金额"])
      const dateField = extractValue(fields["日期"])
      const category = extractValue(fields["分类"])
      const note = extractValue(fields["支出说明"])

      // 生成唯一键：员工+日期+金额+分类+说明
      const uniqueKey = `${employeeName}_${dateField}_${amount}_${category}_${note}`

      // 只保留第一次出现的记录
      if (!uniqueItems.has(uniqueKey)) {
        uniqueItems.set(uniqueKey, item)
      }
    })

    // 将去重后的数据转换回数组
    const deduplicatedItems = Array.from(uniqueItems.values())

    console.log(`[v0] 飞书原始记录数: ${feishuData.items.length}`)
    console.log(`[v0] 去重后记录数: ${deduplicatedItems.length}`)
    console.log(`[v0] 去除重复记录: ${feishuData.items.length - deduplicatedItems.length} 条`)

    if (deduplicatedItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "没有需要同步的新记录（2025年12月及之后）",
        count: 0,
      })
    }

    const aggregatedData: Record<string, { totalAmount: number; records: any[]; month: string; employeeName: string }> =
      {}

    const monthCounts: Record<string, number> = {}

    deduplicatedItems.forEach((item: any) => {
      const fields = item.fields
      const possibleMonthFields = ["月份", "month", "Month", "日期月份", "归属月份", "时间", "日期"]
      let monthField = ""

      for (const fieldName of possibleMonthFields) {
        const value = extractValueForFilter(fields[fieldName])
        if (value) {
          monthField = value
          break
        }
      }

      let employeeName = extractValue(fields["支出人"])
      const amount = extractNumber(fields["金额"])
      const category = extractValue(fields["分类"])
      const note = extractValue(fields["支出说明"])
      const dateField = extractValue(fields["日期"])

      if (nameMapping[employeeName]) {
        employeeName = nameMapping[employeeName]
      }

      if (!monthField) {
        return
      }

      let parsedYear = 0
      let parsedMonth = 0

      const dashMatch = monthField.match(/(\d{4})-(\d{1,2})/)
      if (dashMatch) {
        parsedYear = Number.parseInt(dashMatch[1])
        parsedMonth = Number.parseInt(dashMatch[2])
      }

      const chineseMatch = monthField.match(/(\d{4})年(\d{1,2})月/)
      if (chineseMatch) {
        parsedYear = Number.parseInt(chineseMatch[1])
        parsedMonth = Number.parseInt(chineseMatch[2])
      }

      if (parsedYear === 0 || parsedMonth === 0) {
        return
      }

      const actualMonth = `${parsedYear}年${parsedMonth}月`
      monthCounts[actualMonth] = (monthCounts[actualMonth] || 0) + 1

      const key = `${employeeName}_${actualMonth}`
      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          totalAmount: 0,
          records: [],
          month: actualMonth,
          employeeName: employeeName,
        }
      }

      aggregatedData[key].totalAmount += amount
      aggregatedData[key].records.push({
        amount,
        category,
        note,
        date: dateField,
        monthField: monthField,
      })
    })

    const jiangJan2026Key = "蒋坤洪_2026年1月"
    if (aggregatedData[jiangJan2026Key]) {
      console.log("[v0] === 蒋坤洪 2026年1月 汇总明细 ===")
      console.log(`[v0]   总金额: ¥${aggregatedData[jiangJan2026Key].totalAmount.toFixed(2)}`)
      console.log(`[v0]   记录数: ${aggregatedData[jiangJan2026Key].records.length}`)
      aggregatedData[jiangJan2026Key].records.forEach((record: any, index: number) => {
        console.log(
          `[v0]   ${index + 1}. 日期:${record.date} | 月份:${record.monthField} | ¥${record.amount} | ${record.category}`,
        )
      })
    }

    const jiangDec2025Key = "蒋坤洪_2025年12月"
    if (aggregatedData[jiangDec2025Key]) {
      console.log("[v0] === 蒋坤洪 2025年12月 汇总明细 ===")
      console.log(`[v0]   总金额: ¥${aggregatedData[jiangDec2025Key].totalAmount.toFixed(2)}`)
      console.log(`[v0]   记录数: ${aggregatedData[jiangDec2025Key].records.length}`)
      aggregatedData[jiangDec2025Key].records.forEach((record: any, index: number) => {
        console.log(
          `[v0]   ${index + 1}. 日期:${record.date} | 月份:${record.monthField} | ¥${record.amount} | ${record.category || "无"}`,
        )
      })
    }

    const supabase = await createClient()

    const { data: employees } = await supabase.from("employees").select("name, account_number, bank_branch")

    const employeeInfoMap = new Map<string, { account_number: string; bank_branch: string }>()
    employees?.forEach((emp) => {
      if (emp.name) {
        employeeInfoMap.set(emp.name, {
          account_number: emp.account_number || "",
          bank_branch: emp.bank_branch || "",
        })
      }
    })

    const reimbursements = Object.entries(aggregatedData).map(([key, data]) => {
      const { totalAmount, records, month, employeeName } = data as any

      const employeeInfo = employeeInfoMap.get(employeeName)
      const accountNumber = employeeInfo?.account_number || ""
      const bankBranch = employeeInfo?.bank_branch || ""

      return {
        employee_name: employeeName,
        amount: totalAmount,
        account_number: accountNumber,
        bank_branch: bankBranch,
        note: "",
        month: month,
        created_at: new Date().toISOString(),
      }
    })

    if (reimbursements.length === 0) {
      return NextResponse.json({
        success: true,
        message: "没有需要同步的新记录（2025年12月及之后）",
        count: 0,
      })
    }

    const monthsToCheck = Array.from(new Set(reimbursements.map((r) => r.month)))

    const { data: existingRecords } = await supabase
      .from("reimbursements")
      .select("id, employee_name, amount, month")
      .gte("month", "2025年12月")

    const existingRecordsMap = new Map(
      existingRecords?.map((r) => [`${r.employee_name}_${r.month}`, { id: r.id, amount: r.amount }]) || [],
    )

    const newReimbursements = []
    const updateReimbursements = []

    for (const r of reimbursements) {
      const key = `${r.employee_name}_${r.month}`
      const existing = existingRecordsMap.get(key)

      if (existing) {
        if (isProtectedMonth(r.month)) {
          if (!adminUsername || !adminPassword || !verifyAdminPassword(adminUsername, adminPassword)) {
            console.log(`[v0] 跳过受保护月份的更新: ${r.month}`)
            continue
          }
        }

        if (existing.amount === 0 || Math.abs(existing.amount - r.amount) > 0.01) {
          updateReimbursements.push({
            id: existing.id,
            amount: r.amount,
            account_number: r.account_number,
            bank_branch: r.bank_branch,
          })
        }
      } else {
        newReimbursements.push(r)
      }
    }

    // 获取飞书中的所有员工+月份组合
    const feishuKeys = new Set(reimbursements.map((r) => `${r.employee_name}_${r.month}`))

    const recordsToDelete = []
    for (const [key, value] of existingRecordsMap.entries()) {
      if (!feishuKeys.has(key)) {
        const [employeeName, ...monthParts] = key.split("_")
        const month = monthParts.join("_") // 处理月份中可能包含下划线的情况

        console.log(`[v0] 检测到需要删除的记录: ${employeeName} - ${month}`)

        // 检查是否是受保护的月份
        if (isProtectedMonth(month)) {
          if (!adminUsername || !adminPassword || !verifyAdminPassword(adminUsername, adminPassword)) {
            console.log(`[v0] 跳过受保护月份的删除: ${month}`)
            continue
          }
        }
        recordsToDelete.push(value.id)
      }
    }

    console.log(`[v0] 共找到 ${recordsToDelete.length} 条需要删除的记录`)

    let insertedCount = 0
    let updatedCount = 0
    let deletedCount = 0

    if (newReimbursements.length > 0) {
      const { data, error } = await supabase.from("reimbursements").insert(newReimbursements).select()

      if (error) {
        console.error("数据库插入错误:", error)
        return NextResponse.json({ error: `数据库错误: ${error.message}` }, { status: 500 })
      }
      insertedCount = data.length
    }

    if (updateReimbursements.length > 0) {
      for (const update of updateReimbursements) {
        const { error } = await supabase
          .from("reimbursements")
          .update({
            amount: update.amount,
            account_number: update.account_number,
            bank_branch: update.bank_branch,
          })
          .eq("id", update.id)

        if (!error) {
          updatedCount++
        }
      }
    }

    if (recordsToDelete.length > 0) {
      const { error } = await supabase.from("reimbursements").delete().in("id", recordsToDelete)

      if (!error) {
        deletedCount = recordsToDelete.length
        console.log(`[v0] 删除了 ${deletedCount} 条在飞书中已不存在的记录`)
      } else {
        console.error("删除记录时出错:", error)
      }
    }

    const detailRecords = []
    for (const [key, data] of Object.entries(aggregatedData)) {
      const { records, month, employeeName } = data as any

      for (const record of records) {
        detailRecords.push({
          employee_name: employeeName,
          month: month,
          date: Number.parseInt(record.date) || 0,
          amount: record.amount,
          category: record.category || "",
          note: record.note || "",
        })
      }
    }

    // Delete existing details for the months being synced, then insert new ones
    if (detailRecords.length > 0) {
      const monthsToSync = Array.from(new Set(detailRecords.map((r) => r.month)))

      // Delete old details for these months
      await supabase.from("reimbursement_details").delete().in("month", monthsToSync)

      // Insert new details
      const { error: detailsError } = await supabase.from("reimbursement_details").insert(detailRecords)

      if (detailsError) {
        console.error("[v0] Error inserting details:", detailsError)
      } else {
        console.log(`[v0] Inserted ${detailRecords.length} detail records`)
      }
    }

    const skippedCount = reimbursements.length - newReimbursements.length - updateReimbursements.length

    if (insertedCount === 0 && updatedCount === 0 && deletedCount === 0) {
      return NextResponse.json({
        success: true,
        message: "所有记录已是最新，无需同步",
        count: 0,
        skipped: skippedCount,
      })
    }

    return NextResponse.json({
      success: true,
      message: `同步成功：新增 ${insertedCount} 条，更新 ${updatedCount} 条，删除 ${deletedCount} 条（2025年12月及之后）`,
      count: insertedCount + updatedCount + deletedCount,
      inserted: insertedCount,
      updated: updatedCount,
      deleted: deletedCount,
      skipped: skippedCount,
      monthCounts: monthCounts,
    })
  } catch (error: any) {
    console.error("飞书同步错误:", error)

    try {
      const errorObj = JSON.parse(error.message)
      if (errorObj.type === "permission_denied") {
        return NextResponse.json(
          {
            error: errorObj.message,
            errorType: "permission_denied",
            permissions: errorObj.permissions,
            authUrl: errorObj.authUrl,
            details: errorObj.details,
          },
          { status: 403 },
        )
      }
    } catch {
      // Not a JSON error, continue with normal error handling
    }

    return NextResponse.json({ error: error.message || "同步失败" }, { status: 500 })
  }
}

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

const extractNumber = (field: any) => {
  if (!field) return 0
  if (typeof field === "number") return field
  if (typeof field === "string") return Number.parseFloat(field) || 0
  return 0
}

const extractValueForFilter = (field: any): string => {
  if (!field) return ""
  if (typeof field === "string" || typeof field === "number") return String(field)

  if (field.value && Array.isArray(field.value) && field.value.length > 0) {
    const firstValue = field.value[0]
    if (firstValue.text) return firstValue.text
    if (typeof firstValue === "string") return firstValue
  }

  if (Array.isArray(field)) {
    const first = field[0]
    if (!first) return ""
    if (typeof first === "string") return first
    if (first.text) return first.text
    if (first.name) return first.name
  }

  if (field.text) return field.text
  if (field.name) return field.name

  return ""
}
