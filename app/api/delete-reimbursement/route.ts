import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isProtectedMonth, verifyAdminPassword } from "@/lib/auth-protection"

export async function POST(request: Request) {
  console.log("[v0] Delete reimbursement API called")

  let employee_name: string
  let month: string
  let adminUsername: string | undefined
  let adminPassword: string | undefined

  try {
    const body = await request.json()
    employee_name = body.employee_name
    month = body.month
    adminUsername = body.adminUsername
    adminPassword = body.adminPassword

    console.log("[v0] Delete request params:", { employee_name, month })

    if (!employee_name || !month) {
      return NextResponse.json(
        {
          success: false,
          error: "缺少必需参数：employee_name 或 month",
        },
        { status: 200 },
      )
    }

    if (isProtectedMonth(month)) {
      if (!adminUsername || !adminPassword) {
        return NextResponse.json(
          {
            success: false,
            error: "此月份数据受保护，需要管理员权限",
            requiresAuth: true,
          },
          { status: 200 },
        )
      }

      if (!verifyAdminPassword(adminUsername, adminPassword)) {
        return NextResponse.json(
          {
            success: false,
            error: "管理员账号或密码错误",
            requiresAuth: true,
          },
          { status: 200 },
        )
      }
    }
  } catch (parseError) {
    console.error("[v0] Failed to parse request body:", parseError)
    return NextResponse.json(
      {
        success: false,
        error: "请求数据格式错误",
      },
      { status: 200 },
    )
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase credentials")
      return NextResponse.json(
        {
          success: false,
          error: "服务器配置错误：缺少Supabase凭证",
        },
        { status: 200 },
      )
    }

    console.log("[v0] Creating Supabase client with URL:", supabaseUrl)

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log("[v0] Querying records to delete...")
    const { data: records, error: queryError } = await supabase
      .from("reimbursements")
      .select("id")
      .eq("employee_name", employee_name)
      .eq("month", month)

    if (queryError) {
      console.error("[v0] Query error:", queryError)
      return NextResponse.json(
        {
          success: false,
          error: `查询记录失败: ${queryError.message}`,
        },
        { status: 200 },
      )
    }

    console.log("[v0] Found records to delete:", records)

    if (!records || records.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `未找到${employee_name}在${month}的报销记录`,
        },
        { status: 200 },
      )
    }

    console.log("[v0] Deleting records...")
    const { error: deleteError } = await supabase
      .from("reimbursements")
      .delete()
      .eq("employee_name", employee_name)
      .eq("month", month)

    if (deleteError) {
      console.error("[v0] Delete error:", deleteError)
      return NextResponse.json(
        {
          success: false,
          error: `删除失败: ${deleteError.message}`,
        },
        { status: 200 },
      )
    }

    console.log("[v0] Successfully deleted", records.length, "record(s)")

    return NextResponse.json(
      {
        success: true,
        message: `成功删除${records.length}条报销记录`,
        deleted_count: records.length,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Delete reimbursement error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "删除报销记录失败",
      },
      { status: 200 },
    )
  }
}
