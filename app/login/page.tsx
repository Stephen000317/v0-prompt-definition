"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // 验证账号密码
    if (email === "admin@infist.ai" && password === "20250303") {
      // 设置登录状态
      localStorage.setItem("isLoggedIn", "true")
      localStorage.setItem("loginTime", new Date().getTime().toString())
      // 跳转到主页
      router.push("/")
    } else {
      setError("邮箱或密码错误")
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <Card className="w-full max-w-md p-8 bg-white">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">深圳市无限状态科技有限公司</h1>
          <h2 className="mt-2 text-xl text-gray-700">报销管理系统</h2>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-900">
              邮箱
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              required
              className="bg-white border-gray-300 text-gray-900"
              style={{ color: "#000" }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-900">
              密码
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
              className="bg-white border-gray-300 text-gray-900"
              style={{ color: "#000" }}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>© {new Date().getFullYear()} 深圳市无限状态科技有限公司</p>
        </div>
      </Card>
    </div>
  )
}
