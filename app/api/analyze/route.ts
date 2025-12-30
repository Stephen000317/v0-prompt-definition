export async function POST(req: Request) {
  try {
    const { records, monthlyData, currentMonth } = await req.json()

    // 准备分析数据
    const totalAmount = monthlyData.reduce((sum: number, m: any) => sum + m.total, 0)
    const avgAmount = totalAmount / monthlyData.length
    const currentMonthData = monthlyData.find((m: any) => m.month === currentMonth)
    const currentMonthTotal = currentMonthData?.total || 0

    // 计算员工报销统计
    const employeeStats: { [key: string]: { count: number; total: number; amounts: number[] } } = {}
    records.forEach((record: any) => {
      if (!employeeStats[record.employee_name]) {
        employeeStats[record.employee_name] = { count: 0, total: 0, amounts: [] }
      }
      employeeStats[record.employee_name].count++
      employeeStats[record.employee_name].total += record.amount
      employeeStats[record.employee_name].amounts.push(record.amount)
    })

    const sortedEmployees = Object.entries(employeeStats).sort((a: any, b: any) => b[1].total - a[1].total)
    const topEmployee = sortedEmployees[0]

    // 计算月度趋势
    let trendAnalysis = ""
    if (monthlyData.length > 1) {
      const recentMonths = monthlyData.slice(-3)
      const isIncreasing = recentMonths.every((m: any, i: number) => i === 0 || m.total >= recentMonths[i - 1].total)
      const isDecreasing = recentMonths.every((m: any, i: number) => i === 0 || m.total <= recentMonths[i - 1].total)

      if (isIncreasing) {
        trendAnalysis = "持续上升趋势"
      } else if (isDecreasing) {
        trendAnalysis = "持续下降趋势"
      } else {
        trendAnalysis = "波动状态"
      }
    } else {
      trendAnalysis = "数据不足以判断趋势"
    }

    // 异常检测
    const allAmounts = records.map((r: any) => r.amount)
    const avgRecordAmount = allAmounts.reduce((sum: number, a: number) => sum + a, 0) / allAmounts.length
    const stdDev = Math.sqrt(
      allAmounts.reduce((sum: number, a: number) => sum + Math.pow(a - avgRecordAmount, 2), 0) / allAmounts.length,
    )
    const anomalies = records.filter((r: any) => Math.abs(r.amount - avgRecordAmount) > 2 * stdDev)

    // 生成分析报告
    let analysis = `## 📊 数据分析报告

### 1️⃣ 整体概览
- **总报销记录数**: ${records.length} 条
- **累计报销总额**: ¥${totalAmount.toFixed(2)}
- **平均月报销额**: ¥${avgAmount.toFixed(2)}
- **当前月份（${currentMonth}）**: ¥${currentMonthTotal.toFixed(2)}
- **月度趋势**: ${trendAnalysis}

### 2️⃣ 报销趋势分析
`

    if (currentMonthTotal > avgAmount * 1.2) {
      analysis += `⚠️ 当前月份报销额较高，比平均值高出 ${(((currentMonthTotal - avgAmount) / avgAmount) * 100).toFixed(1)}%。建议关注是否有特殊项目或活动导致。\n\n`
    } else if (currentMonthTotal < avgAmount * 0.8) {
      analysis += `✅ 当前月份报销额较低，比平均值低 ${(((avgAmount - currentMonthTotal) / avgAmount) * 100).toFixed(1)}%，成本控制良好。\n\n`
    } else {
      analysis += `✅ 当前月份报销额在正常范围内，与平均值相差 ${Math.abs(((currentMonthTotal - avgAmount) / avgAmount) * 100).toFixed(1)}%。\n\n`
    }

    analysis += `### 3️⃣ 异常检测
`
    if (anomalies.length > 0) {
      analysis += `⚠️ 检测到 ${anomalies.length} 笔异常报销（金额偏离平均值超过2个标准差）：\n`
      anomalies.slice(0, 3).forEach((a: any) => {
        analysis += `   - ${a.employee_name}: ¥${a.amount.toFixed(2)}\n`
      })
      if (anomalies.length > 3) {
        analysis += `   - ...还有 ${anomalies.length - 3} 笔\n`
      }
      analysis += `\n建议：核实这些高额报销是否符合规定，是否有正当理由。\n\n`
    } else {
      analysis += `✅ 未检测到异常报销，所有金额均在合理范围内。\n\n`
    }

    analysis += `### 4️⃣ 员工报销模式
- **报销最多的员工**: ${topEmployee?.[0]}
  - 总金额: ¥${topEmployee?.[1].total.toFixed(2)}
  - 报销次数: ${topEmployee?.[1].count} 笔
  - 平均单笔: ¥${(topEmployee?.[1].total / topEmployee?.[1].count).toFixed(2)}
  
- **参与报销的员工总数**: ${Object.keys(employeeStats).length} 人

`

    // 员工报销分布分析
    const topThree = sortedEmployees.slice(0, 3)
    const topThreeTotal = topThree.reduce((sum: number, e: any) => sum + e[1].total, 0)
    const topThreePercent = (topThreeTotal / totalAmount) * 100

    analysis += `- **前三名员工占比**: ${topThreePercent.toFixed(1)}%\n`
    topThree.forEach((e: any, i: number) => {
      analysis += `  ${i + 1}. ${e[0]}: ¥${e[1].total.toFixed(2)} (${((e[1].total / totalAmount) * 100).toFixed(1)}%)\n`
    })

    if (topThreePercent > 70) {
      analysis += `\n⚠️ 报销集中度较高，前三名占比超过70%，建议关注是否存在报销权限或业务分配不均的情况。\n\n`
    } else {
      analysis += `\n✅ 报销分布相对均衡。\n\n`
    }

    analysis += `### 5️⃣ 成本控制建议
`
    if (monthlyData.length >= 3) {
      const last3Months = monthlyData.slice(-3)
      const avgLast3 = last3Months.reduce((sum: any, m: any) => sum + m.total, 0) / 3
      const predictNext = avgLast3 * 1.05 // 预测增长5%

      analysis += `- **近3个月平均**: ¥${avgLast3.toFixed(2)}\n`
      analysis += `- **预测下月**: ¥${predictNext.toFixed(2)} (基于5%增长率)\n`
      analysis += `- **建议预算**: ¥${(predictNext * 1.1).toFixed(2)} (预留10%缓冲)\n\n`
    }

    analysis += `### 6️⃣ 优化建议
`
    const suggestions = []

    if (currentMonthTotal > avgAmount * 1.3) {
      suggestions.push("当前月份报销额显著偏高，建议审查报销流程，确保所有支出符合规定")
    }

    if (anomalies.length > records.length * 0.1) {
      suggestions.push("异常报销比例较高，建议完善报销审批流程，设置更明确的金额标准")
    }

    if (topThreePercent > 80) {
      suggestions.push("报销过于集中在少数员工，建议评估是否需要调整职责分配或报销权限")
    }

    const avgMonthlyGrowth =
      monthlyData.length > 1
        ? ((monthlyData[monthlyData.length - 1].total - monthlyData[0].total) / monthlyData[0].total) * 100
        : 0

    if (avgMonthlyGrowth > 50) {
      suggestions.push("报销总额增长较快，建议制定更严格的预算控制措施")
    }

    if (suggestions.length === 0) {
      suggestions.push("当前报销数据整体健康，建议继续保持现有管理水平")
      suggestions.push("可以考虑建立月度报销审查机制，及时发现潜在问题")
    }

    suggestions.forEach((s, i) => {
      analysis += `${i + 1}. ${s}\n`
    })

    return Response.json({ analysis })
  } catch (error) {
    console.error("[v0] AI analysis error:", error)
    return Response.json({ error: "分析失败，请稍后重试" }, { status: 500 })
  }
}
