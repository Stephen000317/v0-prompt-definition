"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { X, Send, Sparkles } from "lucide-react"

interface AiAnalysisProps {
  onClose: () => void
}

interface Message {
  role: "assistant" | "user"
  content: string
}

export function AiAnalysis({ onClose }: AiAnalysisProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Load initial data and greet user
    const loadData = async () => {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })

        if (response.ok) {
          const data = await response.json()
          setSummary(data.summary)

          const greeting = `你好！我是AI财务助手。\n\n已加载数据：${data.summary?.totalRecords || 0}笔报销，累计¥${data.summary?.totalExpense?.toLocaleString() || "0"}\n\n问我任何问题，比如：\n"李季航11月报销了多少？"\n"11月总额是多少？"\n"哪个月报销最多？"`

          setMessages([{ role: "assistant", content: greeting }])
        }
      } catch (error) {
        console.error("[v0] Load data error:", error)
      }
    }

    loadData()
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userMessage }),
      })

      if (response.ok) {
        const data = await response.json()
        const answer = data.answer || "抱歉，我无法回答这个问题。"
        setMessages((prev) => [...prev, { role: "assistant", content: answer }])
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，处理请求时出现错误。" }])
      }
    } catch (error) {
      console.error("[v0] Chat error:", error)
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，发生了错误，请重试。" }])
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl h-[700px] bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-200/50">
        <div className="bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 px-8 py-5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/25 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-md">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">AI财务助手</h2>
              <p className="text-xs text-blue-100 mt-0.5">智能报销数据分析</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/15 transition-all duration-200 backdrop-blur"
            aria-label="关闭"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
              <div
                className={`max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-200/50"
                    : "bg-white text-gray-800 shadow-md border border-gray-100"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2.5 mb-2.5 pb-2.5 border-b border-gray-100">
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-blue-600">AI助手</span>
                  </div>
                )}
                <p
                  className={`text-[15px] leading-relaxed whitespace-pre-line ${msg.role === "user" ? "font-medium" : ""}`}
                >
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white rounded-2xl px-5 py-3.5 shadow-md border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <div
                      className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms", animationDuration: "1s" }}
                    ></div>
                    <div
                      className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce"
                      style={{ animationDelay: "200ms", animationDuration: "1s" }}
                    ></div>
                    <div
                      className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce"
                      style={{ animationDelay: "400ms", animationDuration: "1s" }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200/80 bg-white/80 backdrop-blur-xl p-5 shadow-lg">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="问我关于报销数据的问题..."
              className="flex-1 px-5 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-[15px] bg-white shadow-sm transition-all duration-200"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed rounded-2xl flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none"
              aria-label="发送"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
