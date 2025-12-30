import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { appId, appSecret } = await request.json()

    console.log("[v0] Token API called with appId:", appId)

    if (!appId || !appSecret) {
      console.log("[v0] Missing appId or appSecret")
      return NextResponse.json({ error: "缺少 App ID 或 App Secret" }, { status: 400 })
    }

    // 调用飞书 API 获取 tenant_access_token
    console.log("[v0] Calling Feishu API to get tenant_access_token...")
    const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    })

    const data = await response.json()
    console.log("[v0] Feishu API response:", data)

    if (data.code === 0) {
      return NextResponse.json({
        accessToken: data.tenant_access_token,
        expireTime: data.expire,
      })
    } else {
      console.log("[v0] Feishu API error:", data.msg)
      return NextResponse.json({ error: data.msg || "获取 Access Token 失败" }, { status: 400 })
    }
  } catch (error) {
    console.error("[v0] Error fetching Feishu token:", error)
    return NextResponse.json({ error: "获取 Token 失败" }, { status: 500 })
  }
}
