import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// 飞书多维表格API接口 - 支持分页
async function fetchAllFeishuTableData(appToken: string, tableId: string, accessToken: string) {
  let allItems: any[] = []
  let hasMore = true
  let pageToken: string | undefined = undefined
  let pageCount = 0
  const maxPages = 2 // 将最大页数从3改为2（1000条记录），足以覆盖不到800条的表格数据

  const filter = {
    conjunction: "or",
    conditions: [
      {
        field_name: "月份",
        operator: "contains",
        value: ["2025-12"],
      },
      {
        field_name: "月份",
        operator: "contains",
        value: ["12"],
      },
    ],
  }

  while (hasMore && pageCount < maxPages) {
    pageCount++
    console.log(`[v0] 正在获取第 ${pageCount} 页数据...`)

    const response = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 500,
          filter: filter, // 添加筛选条件
          ...(pageToken ? { page_token: pageToken } : {}),
        }),
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
      allItems = allItems.concat(data.data.items)
      console.log(`[v0] 第 ${pageCount} 页获取到 ${data.data.items.length} 条记录，累计 ${allItems.length} 条`)
    }

    hasMore = data.data?.has_more || false
    pageToken = data.data?.page_token

    if (!hasMore) {
      console.log(`[v0] 已获取所有符合条件的数据，共 ${allItems.length} 条记录`)
      break
    }
  }

  if (pageCount >= maxPages && hasMore) {
    console.log(`[v0] ⚠️ 已达到最大页数限制 (${maxPages} 页)，停止获取`)
  }

  return { items: allItems }
}

export async function POST(request: NextRequest) {
  try {
    let { appToken, tableId, accessToken } = await request.json()

    // 如果没有提供配置，尝试从环境变量读取
    if (!appToken) appToken = process.env.FEISHU_APP_TOKEN
    if (!tableId) tableId = process.env.FEISHU_TABLE_ID

    // 如果没有accessToken，尝试使用环境变量中的App ID和Secret获取
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

    // 从飞书获取所有数据（支持分页）
    const feishuData = await fetchAllFeishuTableData(appToken, tableId, accessToken)

    console.log("[v0] 飞书返回的数据总数:", feishuData.items?.length || 0)

    if (!feishuData.items) {
      return NextResponse.json({ error: "未获取到数据" }, { status: 404 })
    }

    if (feishuData.items.length > 0) {
      console.log("[v0] ==================== 飞书表格字段调试信息 ====================")
      for (let i = 0; i < Math.min(3, feishuData.items.length); i++) {
        const item = feishuData.items[i]
        console.log(`[v0] --- 第 ${i + 1} 条记录 ---`)
        console.log("[v0] 所有字段名:", Object.keys(item.fields || {}))

        // 打印每个字段的值
        for (const [fieldName, fieldValue] of Object.entries(item.fields || {})) {
          console.log(`[v0] 字段 "${fieldName}":`, JSON.stringify(fieldValue))
        }
      }
      console.log("[v0] ================================================================")
    }

    const nameMapping: Record<string, string> = {
      Stephen: "蒋坤洪",
      stephen: "蒋坤洪",
      lewis: "李宇航",
      Lewis: "李宇航",
      "Lewis Li": "李宇航",
      "lewis li": "李宇航",
    }

    const aggregatedData: Record<string, { totalAmount: number; records: any[] }> = {}

    const targetMonth = "2025-12" // 目标月份
    console.log("[v0] 筛选条件：查找包含", targetMonth, "的记录")

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

    let processedCount = 0
    let matchedCount = 0

    feishuData.items.forEach((item: any) => {
      const fields = item.fields

      const possibleMonthFields = ["月份", "month", "Month", "日期月份", "归属月份"]
      let monthField = ""

      for (const fieldName of possibleMonthFields) {
        const value = extractValue(fields[fieldName])
        if (value) {
          monthField = value
          break
        }
      }

      let employeeName = extractValue(fields["支出人"])
      const amount = extractNumber(fields["金额"])
      const category = extractValue(fields["分类"])
      const note = extractValue(fields["支出说明"])

      processedCount++

      // 名称映射
      if (nameMapping[employeeName]) {
        employeeName = nameMapping[employeeName]
      }

      const isTargetMonth =
        monthField && (monthField.includes(targetMonth) || (monthField.includes("12") && monthField.includes("2025")))

      if (!isTargetMonth) {
        return
      }

      matchedCount++

      if (matchedCount <= 5) {
        console.log(`[v0] ✓ 匹配到第 ${matchedCount} 条: ${employeeName} - ¥${amount} - 月份: ${monthField}`)
      }

      // 汇总数据
      if (!aggregatedData[employeeName]) {
        aggregatedData[employeeName] = {
          totalAmount: 0,
          records: [],
        }
      }

      aggregatedData[employeeName].totalAmount += amount
      aggregatedData[employeeName].records.push({
        amount,
        category,
        note,
      })
    })

    console.log(`[v0] 处理了 ${processedCount} 条记录，匹配到 ${matchedCount} 条12月记录`)
    console.log("[v0] 汇总后的人员数量:", Object.keys(aggregatedData).length)
    console.log(
      "[v0] 汇总详情:",
      JSON.stringify(
        Object.entries(aggregatedData).map(([name, data]) => ({
          name,
          totalAmount: data.totalAmount,
          recordCount: data.records.length,
        })),
        null,
        2,
      ),
    )

    const supabase = await createClient()

    // 获取所有员工信息用于匹配
    const { data: employees } = await supabase.from("employees").select("name, account_number, bank_branch")

    console.log("[v0] 从数据库获取到的员工信息:", employees?.length || 0, "条")

    // 创建员工信息映射表
    const employeeInfoMap = new Map<string, { account_number: string; bank_branch: string }>()
    employees?.forEach((emp) => {
      if (emp.name) {
        employeeInfoMap.set(emp.name, {
          account_number: emp.account_number || "",
          bank_branch: emp.bank_branch || "",
        })
      }
    })

    const reimbursements = Object.entries(aggregatedData).map(([employeeName, data]) => {
      const { totalAmount, records } = data

      // 从员工信息映射表中获取开户行和账号
      const employeeInfo = employeeInfoMap.get(employeeName)
      const accountNumber = employeeInfo?.account_number || ""
      const bankBranch = employeeInfo?.bank_branch || ""

      if (employeeInfo) {
        console.log(`[v0] ✓ 为 ${employeeName} 匹配到开户行: ${bankBranch}, 账号: ${accountNumber}`)
      } else {
        console.log(`[v0] ⚠️ 未找到 ${employeeName} 的开户行和账号信息`)
      }

      return {
        employee_name: employeeName,
        amount: totalAmount,
        account_number: accountNumber,
        bank_branch: bankBranch,
        note: "", // 备注留空，用户手动添加
        month: "2025年12月",
        created_at: new Date().toISOString(),
      }
    })

    if (reimbursements.length === 0) {
      return NextResponse.json({
        success: true,
        message: `没有需要同步的新记录（2025年12月），已扫描 ${processedCount} 条记录`,
        count: 0,
        skipped: feishuData.items.length,
      })
    }

    const { data: existingRecords } = await supabase
      .from("reimbursements")
      .select("id, employee_name, amount, month")
      .eq("month", "2025年12月")

    console.log("[v0] 数据库中12月已有记录:", existingRecords?.length || 0)

    const existingRecordsMap = new Map(
      existingRecords?.map((r) => [`${r.employee_name}_${r.month}`, { id: r.id, amount: r.amount }]) || [],
    )

    console.log("[v0] 已存在的记录key:", Array.from(existingRecordsMap.keys()))

    const newReimbursements = []
    const updateReimbursements = []

    for (const r of reimbursements) {
      const key = `${r.employee_name}_${r.month}`
      const existing = existingRecordsMap.get(key)

      if (existing) {
        if (existing.amount === 0 || Math.abs(existing.amount - r.amount) > 0.01) {
          console.log(
            `[v0] 🔄 更新记录: ${r.employee_name} - ${r.month} - 金额从 ¥${existing.amount} 更新为 ¥${r.amount}`,
          )
          updateReimbursements.push({
            id: existing.id,
            amount: r.amount,
            account_number: r.account_number,
            bank_branch: r.bank_branch,
          })
        } else {
          console.log(`[v0] ⚠️ 跳过重复记录: ${r.employee_name} - ${r.month} (金额相同: ¥${r.amount})`)
        }
      } else {
        console.log(`[v0] ✓ 新记录: ${r.employee_name} - ${r.month} - ¥${r.amount}`)
        newReimbursements.push(r)
      }
    }

    console.log("[v0] 待插入的汇总记录数量:", newReimbursements.length)
    console.log("[v0] 待更新的汇总记录数量:", updateReimbursements.length)

    let insertedCount = 0
    let updatedCount = 0

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

        if (error) {
          console.error("数据库更新错误:", error)
        } else {
          updatedCount++
        }
      }
    }

    const skippedCount = reimbursements.length - newReimbursements.length - updateReimbursements.length

    if (insertedCount === 0 && updatedCount === 0) {
      return NextResponse.json({
        success: true,
        message: "所有记录已是最新，无需同步",
        count: 0,
        skipped: skippedCount,
      })
    }

    return NextResponse.json({
      success: true,
      message: `同步成功：新增 ${insertedCount} 条，更新 ${updatedCount} 条（2025年12月）`,
      count: insertedCount + updatedCount,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
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
