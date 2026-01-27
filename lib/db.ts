import { createClient } from "@/lib/supabase/client"

export interface ReimbursementRecord {
  id?: string
  employee_name: string
  amount: number
  account_number: string
  bank_branch: string
  note?: string
  month: string
  created_at?: string
}

export interface EmployeeInfo {
  id?: string
  name: string
  account_number: string
  bank_branch: string
}

export interface MonthlySummary {
  month: string
  total_amount: number
  record_count: number
}

export interface MonthlyData {
  month: string
  total: number
}

// 获取指定月份的报销记录
export async function getReimbursementsByMonth(month: string): Promise<ReimbursementRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("reimbursements")
    .select("*")
    .eq("month", month)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching reimbursements:", error)
    return []
  }

  return data || []
}

// 添加报销记录
export async function addReimbursement(record: ReimbursementRecord): Promise<boolean> {
  const supabase = createClient()

  // 插入报销记录
  const { error: insertError } = await supabase.from("reimbursements").insert([
    {
      employee_name: record.employee_name,
      amount: record.amount,
      account_number: record.account_number,
      bank_branch: record.bank_branch,
      note: record.note || null,
      month: record.month,
    },
  ])

  if (insertError) {
    console.error("[v0] Error adding reimbursement:", insertError)
    return false
  }

  // 更新月度汇总
  await updateMonthlySummary(record.month)

  return true
}

// 更新报销记录
export async function updateReimbursement(
  id: string,
  formData: {
    name: string
    amount: string
    account: string
    branch: string
    note: string
  },
): Promise<boolean> {
  try {
    console.log("[v0] Calling update-reimbursement API...")
    const response = await fetch("/api/update-reimbursement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id,
        employee_name: formData.name,
        amount: Number.parseFloat(formData.amount),
        account_number: formData.account,
        bank_branch: formData.branch,
        note: formData.note || null,
      }),
    })

    const result = await response.json()
    console.log("[v0] API response:", result)

    if (!result.success) {
      if (result.requiresAuth) {
        console.log("[v0] Detected REQUIRES_AUTH, throwing error")
        throw new Error("REQUIRES_AUTH")
      }
      throw new Error(result.error || "更新失败")
    }

    return true
  } catch (error) {
    console.error("[v0] Error updating reimbursement:", error)
    throw error
  }
}

// 删除报销记录
export async function deleteReimbursement(id: string): Promise<boolean> {
  const supabase = createClient()

  // 先查询记录以获取月份信息
  const { data: record, error: fetchError } = await supabase
    .from("reimbursements")
    .select("month")
    .eq("id", id)
    .single()

  if (fetchError || !record) {
    console.error("[v0] Error fetching reimbursement before delete:", fetchError)
    return false
  }

  const month = record.month

  // 删除记录
  const { error } = await supabase.from("reimbursements").delete().eq("id", id)

  if (error) {
    console.error("[v0] Error deleting reimbursement:", error)
    return false
  }

  // 更新月度汇总
  await updateMonthlySummary(month)

  return true
}

// 更新月度汇总
async function updateMonthlySummary(month: string) {
  if (!month) {
    console.error("[v0] Cannot update monthly summary: month is null or undefined")
    return
  }

  const supabase = createClient()

  // 计算该月的总额和记录数
  const { data: records } = await supabase.from("reimbursements").select("amount").eq("month", month)

  const totalAmount = records?.reduce((sum, r) => sum + Number(r.amount), 0) || 0
  const recordCount = records?.length || 0

  // 更新或插入月度汇总
  const { error } = await supabase.from("monthly_summaries").upsert(
    {
      month,
      total_amount: totalAmount,
      record_count: recordCount,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "month",
    },
  )

  if (error) {
    console.error("[v0] Error updating monthly summary:", error)
  }
}

// 获取所有月度汇总
export async function getMonthlySummaries(): Promise<MonthlySummary[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("monthly_summaries")
    .select("month, total_amount, record_count")
    .order("month", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching monthly summaries:", error)
    return []
  }

  return data || []
}

// 获取所有员工
export async function getEmployees(): Promise<EmployeeInfo[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from("employees").select("*").order("name", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching employees:", error)
    return []
  }

  return data || []
}

// 添加员工
export async function addEmployee(employee: EmployeeInfo): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase.from("employees").insert([
    {
      name: employee.name,
      account_number: employee.account_number,
      bank_branch: employee.bank_branch,
    },
  ])

  if (error) {
    console.error("[v0] Error adding employee:", error)
    return false
  }

  return true
}

// 删除员工
export async function deleteEmployee(id: string): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase.from("employees").delete().eq("id", id)

  if (error) {
    console.error("[v0] Error deleting employee:", error)
    return false
  }

  return true
}

// 迁移localStorage数据到Supabase
export async function migrateFromLocalStorage() {
  const supabase = createClient()

  try {
    // 迁移员工数据
    const employeesData = localStorage.getItem("employees")
    if (employeesData) {
      const employees: EmployeeInfo[] = JSON.parse(employeesData)
      for (const emp of employees) {
        await addEmployee(emp)
      }
    }

    // 迁移报销记录
    const recordsData = localStorage.getItem("records")
    if (recordsData) {
      const records: { [key: string]: ReimbursementRecord[] } = JSON.parse(recordsData)
      for (const [month, monthRecords] of Object.entries(records)) {
        for (const record of monthRecords) {
          await addReimbursement({ ...record, month })
        }
      }
    }

    console.log("[v0] Migration completed successfully")
    return true
  } catch (error) {
    console.error("[v0] Migration error:", error)
    return false
  }
}

// 初始化示例数据
export async function initializeSampleData(): Promise<boolean> {
  const supabase = createClient()

  try {
    console.log("[v0] Starting sample data initialization...")

    const { count: recordCount, error: countError } = await supabase
      .from("reimbursements")
      .select("*", { count: "exact", head: true })

    if (countError) {
      console.error("[v0] Error checking reimbursement count:", countError)
    }

    if (recordCount && recordCount > 0) {
      console.log(`[v0] Found ${recordCount} existing records, skipping initialization`)
      return true
    }

    console.log("[v0] No reimbursement records found, proceeding with initialization...")

    const { count: employeeCount } = await supabase.from("employees").select("*", { count: "exact", head: true })

    if (!employeeCount || employeeCount === 0) {
      const employees = [
        { name: "李宇航", account_number: "6231 3601 0996 1108", bank_branch: "招商银行股份有限公司北京青年路支行" },
        { name: "Justin", account_number: "6231 3601 0996 1108", bank_branch: "招商银行股份有限公司北京青年路支行" },
        {
          name: "蒋坤洪",
          account_number: "6228 4800 5710 1274 579",
          bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
        },
        {
          name: "徐荣",
          account_number: "6222 0340 0001 6124 418",
          bank_branch: "中国工商银行股份有限公司深圳高新园支行",
        },
        { name: "刘国华", account_number: "6214 8378 3704 8465", bank_branch: "招商银行股份有限公司深圳汉京中心支行" },
        {
          name: "李心骋",
          account_number: "6217 8520 0001 0209 362",
          bank_branch: "中国银行股份有限公司深圳软件园支行",
        },
        { name: "汪慧灵", account_number: "6214 8310 4369 8445", bank_branch: "招商银行股份有限公司北京十里河分行" },
        {
          name: "朱帆",
          account_number: "6217 0016 3006 7101 953",
          bank_branch: "中国建设银行股份有限公司合肥贵池路支行",
        },
        { name: "刘宇", account_number: "6216 6320 0000 1149 071", bank_branch: "中国银行深圳深大支行" },
        { name: "管思缘", account_number: "6216 6320 0000 1279 001", bank_branch: "中国银行股份有限公司深圳深大支行" },
        {
          name: "李志超",
          account_number: "6228 4817 2819 0850 276",
          bank_branch: "中国农业银行股份有限公司邯郸肥乡支行",
        },
        { name: "潘巧玲", account_number: "6214 8665 5633 9474", bank_branch: "招商银行股份有限公司深圳华润城支行" },
        {
          name: "李楠楠",
          account_number: "6227 0000 6472 4713 549",
          bank_branch: "中国建设银行股份有限公司天津滨海第一支行",
        },
      ]

      console.log("[v0] Inserting employees...")
      const { error: empError } = await supabase.from("employees").insert(employees)
      if (empError) {
        console.error("[v0] Error inserting employees:", empError)
        throw empError
      }
      console.log(`[v0] Successfully inserted ${employees.length} employees`)
    } else {
      console.log(`[v0] Found ${employeeCount} existing employees, skipping employee insertion`)
    }

    const allRecords = [
      // 3月
      {
        month: "2025年3月",
        employee_name: "蒋坤洪",
        amount: 2522.97,
        account_number: "6228 4800 5710 1274 579",
        bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
      },
      {
        month: "2025年3月",
        employee_name: "李楠楠",
        amount: 3097.06,
        account_number: "6227 0000 6472 4713 549",
        bank_branch: "中国建设银行股份有限公司天津滨海第一支行",
      },
      {
        month: "2025年3月",
        employee_name: "潘巧玲",
        amount: 5000.0,
        account_number: "6214 8665 5633 9474",
        bank_branch: "招商银行股份有限公司深圳华润城支行",
      },
      {
        month: "2025年3月",
        employee_name: "李宇航",
        amount: 20339.02,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年3月",
        employee_name: "Justin",
        amount: 4695.42,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      // 4月
      {
        month: "2025年4月",
        employee_name: "李宇航",
        amount: 37574.85,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年4月",
        employee_name: "Justin",
        amount: 10195.41,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年4月",
        employee_name: "蒋坤洪",
        amount: 2030.97,
        account_number: "6228 4800 5710 1274 579",
        bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
      },
      {
        month: "2025年4月",
        employee_name: "潘巧玲",
        amount: 1500.0,
        account_number: "6214 8665 5633 9474",
        bank_branch: "招商银行股份有限公司深圳华润城支行",
      },
      {
        month: "2025年4月",
        employee_name: "李志超",
        amount: 750.0,
        account_number: "6228 4817 2819 0850 276",
        bank_branch: "中国农业银行股份有限公司邯郸肥乡支行",
      },
      {
        month: "2025年4月",
        employee_name: "刘国华",
        amount: 100.0,
        account_number: "6214 8378 3704 8465",
        bank_branch: "招商银行股份有限公司深圳汉京中心支行",
      },
      // 5月
      {
        month: "2025年5月",
        employee_name: "李宇航",
        amount: 4777.72,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年5月",
        employee_name: "Justin",
        amount: 4933.14,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年5月",
        employee_name: "蒋坤洪",
        amount: 4723.1,
        account_number: "6228 4800 5710 1274 579",
        bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
      },
      {
        month: "2025年5月",
        employee_name: "李志超",
        amount: 3485.01,
        account_number: "6228 4817 2819 0850 276",
        bank_branch: "中国农业银行股份有限公司邯郸肥乡支行",
      },
      {
        month: "2025年5月",
        employee_name: "潘巧玲",
        amount: 1200.0,
        account_number: "6214 8665 5633 9474",
        bank_branch: "招商银行股份有限公司深圳华润城支行",
      },
      {
        month: "2025年5月",
        employee_name: "汪慧灵",
        amount: 1510.0,
        account_number: "6214 8310 4369 8445",
        bank_branch: "招商银行股份有限公司北京十里河分行",
      },
      {
        month: "2025年5月",
        employee_name: "徐荣",
        amount: 73.3,
        account_number: "6222 0340 0001 6124 418",
        bank_branch: "深圳工商银行高新园支行",
      },
      // 6月
      {
        month: "2025年6月",
        employee_name: "李宇航",
        amount: 10263.0,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年6月",
        employee_name: "Justin",
        amount: 3764.0,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年6月",
        employee_name: "蒋坤洪",
        amount: 5703.77,
        account_number: "6228 4800 5710 1274 579",
        bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
      },
      {
        month: "2025年6月",
        employee_name: "李志超",
        amount: 4033.04,
        account_number: "6228 4817 2819 0850 276",
        bank_branch: "中国农业银行股份有限公司邯郸肥乡支行",
      },
      {
        month: "2025年6月",
        employee_name: "徐荣",
        amount: 507.0,
        account_number: "6222 0340 0001 6124 418",
        bank_branch: "中国工商银行股份有限公司深圳高新园支行",
      },
      // 7月
      {
        month: "2025年7月",
        employee_name: "李宇航",
        amount: 9847.0,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年7月",
        employee_name: "蒋坤洪",
        amount: 9490.41,
        account_number: "6228 4800 5710 1274 579",
        bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
      },
      {
        month: "2025年7月",
        employee_name: "徐荣",
        amount: 1800.0,
        account_number: "6222 0340 0001 6124 418",
        bank_branch: "中国工商银行股份有限公司深圳高新园支行",
      },
      {
        month: "2025年7月",
        employee_name: "刘国华",
        amount: 355.9,
        account_number: "6214 8378 3704 8465",
        bank_branch: "招商银行股份有限公司深圳汉京中心支行",
      },
      // 8月
      {
        month: "2025年8月",
        employee_name: "李宇航",
        amount: 8653.92,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年8月",
        employee_name: "蒋坤洪",
        amount: 11333.87,
        account_number: "6228 4800 5710 1274 579",
        bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
        note: "已冲销",
      },
      {
        month: "2025年8月",
        employee_name: "徐荣",
        amount: 3793.0,
        account_number: "6222 0340 0001 6124 418",
        bank_branch: "中国工商银行股份有限公司深圳高新园支行",
      },
      {
        month: "2025年8月",
        employee_name: "汪慧灵",
        amount: 2344.0,
        account_number: "6214 8310 4369 8445",
        bank_branch: "招商银行股份有限公司北京十里河分行",
      },
      {
        month: "2025年8月",
        employee_name: "李心骋",
        amount: 1186.06,
        account_number: "6217 8520 0001 0209 362",
        bank_branch: "中国银行股份有限公司深圳软件园支行",
      },
      // 9月
      {
        month: "2025年9月",
        employee_name: "李宇航",
        amount: 5619.5,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年9月",
        employee_name: "蒋坤洪",
        amount: 8605.3,
        account_number: "6228 4800 5710 1274 579",
        bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
        note: "已冲销备用金累计剩余-1429.58",
      },
      {
        month: "2025年9月",
        employee_name: "徐荣",
        amount: 1800.0,
        account_number: "6222 0340 0001 6124 418",
        bank_branch: "中国工商银行股份有限公司深圳高新园支行",
      },
      {
        month: "2025年9月",
        employee_name: "Justin",
        amount: 950.0,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      // 10月
      {
        month: "2025年10月",
        employee_name: "李宇航",
        amount: 135911.47,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年10月",
        employee_name: "蒋坤洪",
        amount: 22631.12,
        account_number: "6228 4800 5710 1274 579",
        bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
        note: "已冲销备用金累计剩余-4060.7",
      },
      {
        month: "2025年10月",
        employee_name: "Justin",
        amount: 23508.0,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年10月",
        employee_name: "徐荣",
        amount: 1800.0,
        account_number: "6222 0340 0001 6124 418",
        bank_branch: "中国工商银行股份有限公司深圳高新园支行",
      },
      // 11月
      {
        month: "2025年11月",
        employee_name: "李宇航",
        amount: 22347.12,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年11月",
        employee_name: "蒋坤洪",
        amount: 9838.46,
        account_number: "6228 4800 5710 1274 579",
        bank_branch: "中国农业银行股份有限公司武汉藏龙岛支行",
      },
      {
        month: "2025年11月",
        employee_name: "Justin",
        amount: 18879.71,
        account_number: "6231 3601 0996 1108",
        bank_branch: "招商银行股份有限公司北京青年路支行",
      },
      {
        month: "2025年11月",
        employee_name: "徐荣",
        amount: 2747.0,
        account_number: "6222 0340 0001 6124 418",
        bank_branch: "中国工商银行股份有限公司深圳高新园支行",
      },
      {
        month: "2025年11月",
        employee_name: "刘国华",
        amount: 283.1,
        account_number: "6214 8378 3704 8465",
        bank_branch: "招商银行股份有限公司深圳汉京中心支行",
      },
      {
        month: "2025年11月",
        employee_name: "李心骋",
        amount: 2166.0,
        account_number: "6217 8520 0001 0209 362",
        bank_branch: "中国银行股份有限公司深圳软件园支行",
      },
      {
        month: "2025年11月",
        employee_name: "汪慧灵",
        amount: 288.0,
        account_number: "6214 8310 4369 8445",
        bank_branch: "招商银行股份有限公司北京十里河分行",
      },
      {
        month: "2025年11月",
        employee_name: "朱帆",
        amount: 2469.78,
        account_number: "6217 0016 3006 7101 953",
        bank_branch: "中国建设银行股份有限公司合肥贵池路支行",
      },
    ]

    console.log(`[v0] Inserting ${allRecords.length} reimbursement records...`)
    const { error: recError } = await supabase.from("reimbursements").insert(allRecords)
    if (recError) {
      console.error("[v0] Error inserting reimbursements:", recError)
      throw recError
    }
    console.log(`[v0] Successfully inserted ${allRecords.length} reimbursement records`)

    console.log("[v0] Updating monthly summaries...")
    const months = [
      "2025年3月",
      "2025年4月",
      "2025年5月",
      "2025年6月",
      "2025年7月",
      "2025年8月",
      "2025年9月",
      "2025年10月",
      "2025年11月",
    ]
    for (const month of months) {
      await updateMonthlySummary(month)
    }
    console.log("[v0] Successfully updated monthly summaries")

    console.log("[v0] Sample data initialization completed successfully!")
    return true
  } catch (error) {
    console.error("[v0] Fatal error initializing sample data:", error)
    return false
  }
}

// 加载所有报销记录
export async function loadAllRecords(): Promise<{ [key: string]: ReimbursementRecord[] }> {
  try {
    const supabase = createClient()
    
    // 添加重试机制
    let retries = 3
    let lastError: Error | null = null
    
    while (retries > 0) {
      try {
        const { data, error } = await supabase
          .from("reimbursements")
          .select("*")
          .order("created_at", { ascending: true })

        if (error) {
          throw error
        }

        // 按月份分组
        const recordsByMonth: { [key: string]: ReimbursementRecord[] } = {}
        for (const record of data || []) {
          if (!recordsByMonth[record.month]) {
            recordsByMonth[record.month] = []
          }
          recordsByMonth[record.month].push(record)
        }

        return recordsByMonth
      } catch (e) {
        lastError = e as Error
        retries--
        if (retries > 0) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    
    console.error("[v0] Error fetching all reimbursements after retries:", lastError)
    return {}
  } catch (error) {
    console.error("[v0] Error fetching all reimbursements:", error)
    return {}
  }
}

// 导出数据备份功能
export async function exportDataBackup(): Promise<boolean> {
  const supabase = createClient()

  try {
    console.log("[v0] Starting data export...")

    // 获取所有报销记录
    const { data: reimbursements, error: reimbError } = await supabase
      .from("reimbursements")
      .select("*")
      .order("created_at", { ascending: true })

    if (reimbError) throw reimbError

    // 获取所有员工信息
    const { data: employees, error: empError } = await supabase
      .from("employees")
      .select("*")
      .order("name", { ascending: true })

    if (empError) throw empError

    // 获取月度汇总
    const { data: summaries, error: summError } = await supabase
      .from("monthly_summaries")
      .select("*")
      .order("month", { ascending: true })

    if (summError) throw summError

    // 创建备份对象
    const backup = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      data: {
        reimbursements: reimbursements || [],
        employees: employees || [],
        monthly_summaries: summaries || [],
      },
      stats: {
        totalReimbursements: reimbursements?.length || 0,
        totalEmployees: employees?.length || 0,
        totalAmount: reimbursements?.reduce((sum, r) => sum + Number(r.amount), 0) || 0,
      },
    }

    // 创建下载链接
    const dataStr = JSON.stringify(backup, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `报销系统备份_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log("[v0] Data export completed successfully")
    return true
  } catch (error) {
    console.error("[v0] Error exporting data:", error)
    return false
  }
}

export const loadEmployees = getEmployees
export const saveRecord = addReimbursement
export const updateRecord = updateReimbursement
export const deleteRecord = deleteReimbursement
export const saveEmployee = addEmployee
