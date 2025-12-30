"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Send, User, GripVertical } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface AIChatbotProps {
  allRecords: { [key: string]: any[] }
  monthlyData: { month: string; total?: number; amount?: number }[]
  currentMonth?: string
  onClose: () => void
  onRecordAdded?: () => void // 添加回调函数，当记录添加成功时触发
}

export function AIChatbot({ allRecords, monthlyData, currentMonth, onClose, onRecordAdded }: AIChatbotProps) {
  // 计算数据摘要
  const totalRecords = Object.values(allRecords).flat().length
  const totalAmount = monthlyData.reduce((sum, m) => sum + (m?.total || m?.amount || 0), 0)

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `👋 您好！我是您的AI财务分析助手

📊 当前数据概览：
• ${totalRecords} 笔报销记录
• 累计金额 ¥${totalAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

💡 我能帮您：
• 查询任意员工的报销明细和总额
• 分析月度报销趋势和异常情况
• 提供财务数据洞察和建议

试试问我：
"蒋坤洪12月报销了多少？"
"哪个月的报销金额最高？"
"帮我分析一下最近的报销趋势"`,
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false) // 添加速率限制状态追踪
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState({ x: 16, y: 80 }) // 初始位置 (left: 16px, bottom: 80px转换为从上往下)
  const [size, setSize] = useState({ width: 420, height: 420 }) // Added size state for resizable chatbot
  const [isDragging, setIsDragging] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [initialResize, setInitialResize] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })
  const chatbotRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (chatbotRef.current) {
      const rect = chatbotRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
      setIsDragging(true)
    }
  }

  const handleResizeMouseDown = (e: React.MouseEvent, direction: string) => {
    e.preventDefault()
    e.stopPropagation()
    setResizeDirection(direction)
    setInitialResize({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        const maxX = window.innerWidth - size.width
        const maxY = window.innerHeight - size.height

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        })
      }

      if (resizeDirection) {
        const deltaX = e.clientX - initialResize.x
        const deltaY = e.clientY - initialResize.y

        let newWidth = initialResize.width
        let newHeight = initialResize.height
        let newX = initialResize.posX
        let newY = initialResize.posY

        // Handle horizontal resizing
        if (resizeDirection.includes("e")) {
          newWidth = Math.max(350, Math.min(800, initialResize.width + deltaX))
        } else if (resizeDirection.includes("w")) {
          const potentialWidth = initialResize.width - deltaX
          if (potentialWidth >= 350 && potentialWidth <= 800) {
            newWidth = potentialWidth
            newX = initialResize.posX + deltaX
          }
        }

        // Handle vertical resizing
        if (resizeDirection.includes("s")) {
          newHeight = Math.max(400, Math.min(900, initialResize.height + deltaY))
        } else if (resizeDirection.includes("n")) {
          const potentialHeight = initialResize.height - deltaY
          if (potentialHeight >= 400 && potentialHeight <= 900) {
            newHeight = potentialHeight
            newY = initialResize.posY + deltaY
          }
        }

        setSize({ width: newWidth, height: newHeight })
        setPosition({ x: newX, y: newY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setResizeDirection(null)
    }

    if (isDragging || resizeDirection) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, resizeDirection, dragOffset, initialResize, size.width, size.height, position.x, position.y])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }],
          allRecords,
          monthlyData,
        }),
      })

      const data = await response.json()

      if (data.error) {
        const isRateLimitError =
          data.response.includes("今日使用限制") ||
          data.response.includes("rate_limit") ||
          data.response.includes("Rate limit")

        if (isRateLimitError) {
          setIsRateLimited(true)
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `🚫 AI助手已达到今日使用限制\n\n您可以：\n• 使用表格手动管理报销记录\n• 等待明天重置后继续使用AI功能\n• 访问 Groq 控制台升级服务`,
            },
          ])
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `错误：${data.response || "未知错误"}`,
            },
          ])
        }
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }])
      }

      if (!data.error && data.needsRefresh && onRecordAdded) {
        onRecordAdded()
      }
    } catch (error) {
      console.error("[v0] Chat error:", error)
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，分析时出现错误。请检查网络连接后重试。" }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      ref={chatbotRef}
      className="fixed bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50 print:hidden overflow-hidden"
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: isDragging || resizeDirection ? "none" : "box-shadow 0.2s",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <GripVertical className="w-4 h-4 opacity-70" />
          <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-5 h-5 text-white" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.9" />
              <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.6" />
              <circle cx="24" cy="8" r="2" fill="currentColor" opacity="0.6" />
              <circle cx="8" cy="24" r="2" fill="currentColor" opacity="0.6" />
              <circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.6" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-base">AI报销分析助手</h3>
            <p className="text-xs text-blue-100">智能财务分析</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white/90 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-all"
          aria-label="关闭"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gradient-to-b from-gray-50 to-white">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4 text-blue-600"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.9" />
                  <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.6" />
                  <circle cx="24" cy="8" r="2" fill="currentColor" opacity="0.6" />
                  <circle cx="8" cy="24" r="2" fill="currentColor" opacity="0.6" />
                  <circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.6" />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[75%] p-3.5 rounded-xl text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-800 border border-gray-200 shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="3" fill="currentColor" opacity="0.9" />
                <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.6" />
                <circle cx="24" cy="8" r="2" fill="currentColor" opacity="0.6" />
                <circle cx="8" cy="24" r="2" fill="currentColor" opacity="0.6" />
                <circle cx="24" cy="24" r="2" fill="currentColor" opacity="0.6" />
              </svg>
            </div>
            <div className="bg-white border border-gray-200 p-3.5 rounded-xl shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        {isRateLimited && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>AI功能已达到使用限制，请使用手动操作</span>
          </div>
        )}
        <div className="flex gap-2.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isRateLimited ? "AI功能暂时不可用" : "问我关于报销数据的问题..."}
            disabled={isLoading || isRateLimited}
            className="flex-1 text-sm border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg h-10"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || isRateLimited}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 h-10"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Top */}
      <div
        onMouseDown={(e) => handleResizeMouseDown(e, "n")}
        className="absolute top-0 left-0 right-0 h-1 cursor-n-resize hover:bg-blue-500/20"
        style={{ touchAction: "none" }}
      />
      {/* Bottom */}
      <div
        onMouseDown={(e) => handleResizeMouseDown(e, "s")}
        className="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize hover:bg-blue-500/20"
        style={{ touchAction: "none" }}
      />
      {/* Left */}
      <div
        onMouseDown={(e) => handleResizeMouseDown(e, "w")}
        className="absolute top-0 bottom-0 left-0 w-1 cursor-w-resize hover:bg-blue-500/20"
        style={{ touchAction: "none" }}
      />
      {/* Right */}
      <div
        onMouseDown={(e) => handleResizeMouseDown(e, "e")}
        className="absolute top-0 bottom-0 right-0 w-1 cursor-e-resize hover:bg-blue-500/20"
        style={{ touchAction: "none" }}
      />
      {/* Top-left corner */}
      <div
        onMouseDown={(e) => handleResizeMouseDown(e, "nw")}
        className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize hover:bg-blue-500/30"
        style={{ touchAction: "none" }}
      />
      {/* Top-right corner */}
      <div
        onMouseDown={(e) => handleResizeMouseDown(e, "ne")}
        className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize hover:bg-blue-500/30"
        style={{ touchAction: "none" }}
      />
      {/* Bottom-left corner */}
      <div
        onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
        className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize hover:bg-blue-500/30"
        style={{ touchAction: "none" }}
      />
      {/* Bottom-right corner */}
      <div
        onMouseDown={(e) => handleResizeMouseDown(e, "se")}
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-blue-500/30"
        style={{ touchAction: "none" }}
      />
    </div>
  )
}
