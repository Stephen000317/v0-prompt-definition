import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { messages: clientMessages, allRecords, monthlyData } = await request.json()

    const safeAllRecords = allRecords || {}
    const allRecordsArray = Object.values(safeAllRecords).flat()

    const quickLookup = {
      byEmployee: {} as { [employee: string]: { [month: string]: number } },
      byMonth: {} as { [month: string]: number },
      total: 0,
      recordCount: allRecordsArray.length,
    }

    allRecordsArray.forEach((record: any) => {
      const name = record.employee_name || record.name
      const month = record.month
      const amount = record.amount || 0

      if (!name || !month) return

      if (!quickLookup.byEmployee[name]) {
        quickLookup.byEmployee[name] = {}
      }
      quickLookup.byEmployee[name][month] = (quickLookup.byEmployee[name][month] || 0) + amount
      quickLookup.byMonth[month] = (quickLookup.byMonth[month] || 0) + amount
      quickLookup.total += amount
    })

    const dataContext = JSON.stringify(quickLookup, null, 2)

    const currentDate = new Date()
    const currentDateStr = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月${currentDate.getDate()}日`
    const currentMonthStr = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`

    const systemPrompt = `你是财务AI助手，分析报销数据。

**当前：** ${currentDateStr}（本月=${currentMonthStr}）

**数据：**
\`\`\`json
${dataContext}
\`\`\`

**月份识别：** "X月"="2025年X月"，"本月"="${currentMonthStr}"

**规则：**
1. 月份查询时必须匹配正确的年月格式
2. 问"总计"时必须计算总和："\n💰 总计：¥X,XXX.XX"
3. 无数据时明确说明
4. 简洁专业，金额用千分位

精确性第一，严禁混淆月份。`

    const apiKey = process.env.GROQ_API_KEY

    if (!apiKey) {
      throw new Error("缺少 GROQ_API_KEY 环境变量")
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "add_reimbursement",
          description: "添加报销记录。格式：'姓名 月份 金额'",
          parameters: {
            type: "object",
            properties: {
              employee_name: { type: "string", description: "员工姓名" },
              amount: { type: "string", description: "金额" },
              month: { type: "string", description: "月份，格式：2025年12月" },
              note: { type: "string", description: "备注（可选）" },
            },
            required: ["employee_name", "amount", "month"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "delete_reimbursement",
          description: "删除报销记录",
          parameters: {
            type: "object",
            properties: {
              employee_name: { type: "string", description: "员工姓名" },
              month: { type: "string", description: "月份" },
            },
            required: ["employee_name", "month"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "update_reimbursement",
          description: "修改报销记录",
          parameters: {
            type: "object",
            properties: {
              old_employee_name: { type: "string", description: "原姓名" },
              month: { type: "string", description: "月份" },
              new_employee_name: { type: "string", description: "新姓名（可选）" },
              amount: { type: "string", description: "新金额（可选）" },
              increment_amount: { type: "string", description: "增减金额，如'+5'或'-10'（可选）" },
              note: { type: "string", description: "新备注（可选）" },
            },
            required: ["old_employee_name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "query_reimbursements",
          description: "查询报销记录",
          parameters: {
            type: "object",
            properties: {
              employee_name: { type: "string", description: "员工姓名（可选）" },
              month: { type: "string", description: "月份（可选）" },
              min_amount: { type: "string", description: "最小金额（可选）" },
              max_amount: { type: "string", description: "最大金额（可选）" },
            },
            required: [],
          },
        },
      },
    ]

    const messages = [
      { role: "system", content: systemPrompt },
      ...clientMessages.map((msg: any) => ({ role: msg.role, content: msg.content })),
    ]

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.1,
        max_tokens: 800,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      const errorMessage = errorData.error?.message || response.statusText

      if (response.status === 429 || errorMessage.includes("rate_limit")) {
        const retryMatch = errorMessage.match(/try again in ([\d.]+)/)
        const retrySeconds = retryMatch ? Math.ceil(Number.parseFloat(retryMatch[1])) : null

        return Response.json(
          {
            response: `⏱️ AI助手暂时忙碌中${retrySeconds ? `，请等待${retrySeconds}秒后重试` : ""}。您可以继续使用表格手动管理报销记录。`,
            error: true,
            retryAfter: retrySeconds,
          },
          { status: 200 },
        )
      }

      throw new Error(`Groq API错误: ${errorMessage}`)
    }

    const data = await response.json()
    const assistantMessage = data.choices?.[0]?.message

    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0]
      const functionName = toolCall.function.name
      const functionArgs = JSON.parse(toolCall.function.arguments)

      if (functionName === "add_reimbursement") {
        const amountStr = String(functionArgs.amount)
          .replace(/[¥元,，]/g, "")
          .trim()
        const amountNum = Number.parseFloat(amountStr)

        if (isNaN(amountNum)) {
          return Response.json({
            response: `金额格式错误："${functionArgs.amount}"，请提供有效的数字金额`,
            functionCalled: false,
          })
        }

        const employeeExists = Object.keys(quickLookup.byEmployee).includes(functionArgs.employee_name)
        if (!employeeExists) {
          const createEmployeeResponse = await fetch(`${request.nextUrl.origin}/api/manage-employee`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add",
              name: functionArgs.employee_name,
              account_number: "待补充",
              bank_branch: "待补充",
            }),
          })

          const createEmployeeResult = await createEmployeeResponse.json()
          if (!createEmployeeResult.success) {
            return Response.json({
              response: `创建员工失败：${createEmployeeResult.error}`,
              functionCalled: false,
            })
          }
        }

        try {
          const addResponse = await fetch(`${request.nextUrl.origin}/api/add-reimbursement`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...functionArgs,
              amount: amountNum,
            }),
          })

          const contentType = addResponse.headers.get("content-type")
          if (!contentType || !contentType.includes("application/json")) {
            return Response.json({
              response: "添加失败：服务器返回了非JSON响应",
              functionCalled: false,
            })
          }

          const addResult = await addResponse.json()

          if (addResult.success) {
            return Response.json({
              response: addResult.message,
              functionCalled: true,
              needsRefresh: true,
            })
          } else {
            return Response.json({
              response: `添加失败：${addResult.error}`,
              functionCalled: false,
            })
          }
        } catch (apiError) {
          console.error("[v0] Add reimbursement API error:", apiError)
          return Response.json({
            response: `添加失败：${apiError instanceof Error ? apiError.message : "未知错误"}`,
            functionCalled: false,
          })
        }
      }

      if (functionName === "delete_reimbursement") {
        try {
          console.log("[v0] Calling delete API with args:", functionArgs)

          const deleteResponse = await fetch(`${request.nextUrl.origin}/api/delete-reimbursement`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(functionArgs),
          })

          console.log("[v0] Delete API response status:", deleteResponse.status)
          console.log("[v0] Delete API response headers:", Object.fromEntries(deleteResponse.headers.entries()))

          const contentType = deleteResponse.headers.get("content-type")
          if (!contentType || !contentType.includes("application/json")) {
            const responseText = await deleteResponse.text()
            console.error("[v0] Non-JSON response from delete API:", responseText)
            return Response.json({
              response: `删除失败：服务器返回了非JSON响应（状态码: ${deleteResponse.status}）`,
              functionCalled: false,
            })
          }

          let deleteResult
          try {
            deleteResult = await deleteResponse.json()
            console.log("[v0] Delete API result:", deleteResult)
          } catch (jsonError) {
            console.error("[v0] Failed to parse delete API JSON:", jsonError)
            return Response.json({
              response: "删除失败：无法解析服务器响应",
              functionCalled: false,
            })
          }

          if (deleteResult.success) {
            return Response.json({
              response: deleteResult.message,
              functionCalled: true,
              needsRefresh: true,
            })
          } else {
            return Response.json({
              response: `删除失败：${deleteResult.error}`,
              functionCalled: false,
            })
          }
        } catch (apiError) {
          console.error("[v0] Delete reimbursement API error:", apiError)
          return Response.json({
            response: `删除失败：${apiError instanceof Error ? apiError.message : "未知错误"}`,
            functionCalled: false,
          })
        }
      }

      if (functionName === "update_reimbursement") {
        const targetMonth = functionArgs.month || currentMonthStr

        const queryResponse = await fetch(`${request.nextUrl.origin}/api/query-reimbursements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_name: functionArgs.old_employee_name,
            month: targetMonth,
          }),
        })

        const queryResult = await queryResponse.json()

        if (queryResult.success && queryResult.data && queryResult.data.length > 0) {
          const existingRecord = queryResult.data[0]
          const recordId = existingRecord.id

          const updatePayload: any = {
            id: recordId,
            old_employee_name: functionArgs.old_employee_name,
            month: targetMonth,
          }

          if (functionArgs.new_employee_name) {
            updatePayload.new_employee_name = functionArgs.new_employee_name
          }

          if (functionArgs.increment_amount) {
            const incrementStr = String(functionArgs.increment_amount).trim()
            const incrementNum = Number.parseFloat(incrementStr)

            if (isNaN(incrementNum)) {
              return Response.json({
                response: `增量金额格式错误："${functionArgs.increment_amount}"`,
                functionCalled: false,
              })
            }

            const currentAmount = Number(existingRecord.amount)
            const newAmount = currentAmount + incrementNum

            if (newAmount < 0) {
              return Response.json({
                response: `操作失败：减少${Math.abs(incrementNum)}元后金额将为负数（当前金额：¥${currentAmount.toFixed(2)}）`,
                functionCalled: false,
              })
            }

            updatePayload.amount = newAmount.toFixed(2)
            console.log(
              `[v0] Increment amount: ${currentAmount} ${incrementNum > 0 ? "+" : ""} ${incrementNum} = ${newAmount}`,
            )
          } else if (functionArgs.amount) {
            const amountStr = String(functionArgs.amount)
              .replace(/[¥元,，]/g, "")
              .trim()
            updatePayload.amount = amountStr
          }

          if (functionArgs.note !== undefined) {
            updatePayload.note = functionArgs.note
          }

          const updateResponse = await fetch(`${request.nextUrl.origin}/api/update-reimbursement`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          })

          const contentType = updateResponse.headers.get("content-type")
          if (!contentType || !contentType.includes("application/json")) {
            return Response.json({
              response: "更新失败：服务器返回了非JSON响应",
              functionCalled: false,
            })
          }

          const updateResult = await updateResponse.json()

          if (updateResult.success) {
            return Response.json({
              response: updateResult.message,
              functionCalled: true,
              needsRefresh: true,
            })
          } else {
            return Response.json({
              response: `更新失败：${updateResult.error}`,
              functionCalled: false,
            })
          }
        } else {
          return Response.json({
            response: `未找到${functionArgs.old_employee_name}在${targetMonth}的报销记录`,
            functionCalled: false,
          })
        }
      }

      if (functionName === "query_reimbursements") {
        const queryResponse = await fetch(`${request.nextUrl.origin}/api/query-reimbursements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(functionArgs),
        })

        const queryResult = await queryResponse.json()

        if (queryResult.success) {
          const records = queryResult.data
          if (records.length === 0) {
            return Response.json({
              response: "没有找到符合条件的报销记录",
              functionCalled: true,
            })
          }

          let responseText = `找到 ${records.length} 条报销记录：\n\n`
          let totalAmount = 0

          records.forEach((record: any, index: number) => {
            responseText += `${index + 1}. ${record.employee_name} - ${record.month} - ¥${Number(record.amount).toFixed(2)}`
            if (record.note) {
              responseText += ` - ${record.note}`
            }
            responseText += "\n"
            totalAmount += Number(record.amount)
          })

          responseText += `\n💰 总计：¥${totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

          return Response.json({
            response: responseText,
            functionCalled: true,
          })
        } else {
          return Response.json({
            response: `查询失败：${queryResult.error}`,
            functionCalled: false,
          })
        }
      }
    }

    const aiResponse = assistantMessage?.content || "无法获取回复"

    return Response.json({ response: aiResponse })
  } catch (error) {
    console.error("[v0] Chat error:", error)
    return Response.json(
      {
        response: error instanceof Error ? error.message : "分析失败，请重试",
        error: true,
      },
      { status: 200 },
    )
  }
}
