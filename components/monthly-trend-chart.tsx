"use client"

import { Card } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import type { MonthlyData } from "@/lib/db"
import { useMemo, useState, useEffect, useRef } from "react"

interface MonthlyTrendChartProps {
  data: MonthlyData[]
  currentMonth: string
}

export function MonthlyTrendChart({ data, currentMonth }: MonthlyTrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 500, height: 280 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height) - 10,
        })
      }
    }

    updateDimensions()
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  const filteredData = useMemo(() => {
    const currentMatch = currentMonth.match(/(\d+)年(\d+)月/)
    if (!currentMatch) return data

    const [, currentYear, currentMonthNum] = currentMatch
    const currentValue = Number(currentYear) * 100 + Number(currentMonthNum)

    return data.filter((monthData) => {
      const match = monthData.month.match(/(\d+)年(\d+)月/)
      if (!match) return false
      const [, year, month] = match
      const monthValue = Number(year) * 100 + Number(month)
      return monthValue <= currentValue
    })
  }, [data, currentMonth])

  const formatMonthLabel = (month: string) => {
    const match = month.match(/(\d+)月/)
    return match ? match[1] + "月" : month
  }

  return (
    <Card
      className="chart-container p-3 print:break-inside-avoid print:p-2 flex flex-col"
      style={{ minHeight: "320px" }}
    >
      <h3 className="mb-2 text-base font-semibold print:mb-1 print:text-[10px]">每月报销趋势</h3>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "280px" }}
        className="print-chart-container flex items-center justify-center"
      >
        {filteredData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">暂无数据</div>
        ) : (
          <LineChart
            width={dimensions.width}
            height={dimensions.height}
            data={filteredData}
            margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              stroke="#374151"
              fontSize={11}
              tickMargin={8}
              height={50}
              interval={0}
              angle={-45}
              textAnchor="end"
              tick={{ fill: "#000000", fontSize: 11 }}
              tickFormatter={formatMonthLabel}
            />
            <YAxis
              stroke="#374151"
              fontSize={10}
              tickMargin={5}
              width={55}
              tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
              tick={{ fill: "#000000", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
              }}
              formatter={(value: number) =>
                `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              }
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#000000"
              strokeWidth={2}
              dot={{ fill: "#000000", r: 4 }}
              name="报销总额"
            />
          </LineChart>
        )}
      </div>
    </Card>
  )
}
