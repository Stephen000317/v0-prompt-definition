"use client"

import { Card } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"
import type { ReimbursementRecord } from "@/lib/db"
import { useMemo, useState, useEffect, useRef } from "react"

interface PersonDistributionChartProps {
  records: ReimbursementRecord[]
}

export function PersonDistributionChart({ records }: PersonDistributionChartProps) {
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

  const safeRecords = records || []

  const aggregatedData = safeRecords.reduce(
    (acc, record) => {
      const employeeName = record.employee_name || "未知"
      const existing = acc.find((item) => item.name === employeeName)
      if (existing) {
        existing.amount += record.amount
      } else {
        acc.push({ name: employeeName, amount: record.amount })
      }
      return acc
    },
    [] as { name: string; amount: number }[],
  )

  const { xAxisInterval, barSize } = useMemo(() => {
    const count = aggregatedData.length
    if (count <= 5) return { xAxisInterval: 0, barSize: 40 }
    if (count <= 10) return { xAxisInterval: 0, barSize: 30 }
    if (count <= 15) return { xAxisInterval: 0, barSize: 20 }
    return { xAxisInterval: 1, barSize: 15 }
  }, [aggregatedData.length])

  return (
    <Card
      className="chart-container p-3 print:break-inside-avoid print:p-2 flex flex-col"
      style={{ minHeight: "320px" }}
    >
      <h3 className="mb-2 text-base font-semibold print:mb-1 print:text-[10px]" style={{ color: "#000" }}>
        本月个人报销分布
      </h3>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "280px" }}
        className="print-chart-container flex items-center justify-center"
      >
        {aggregatedData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-500">暂无数据</div>
        ) : (
          <BarChart
            width={dimensions.width}
            height={dimensions.height}
            data={aggregatedData}
            margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              stroke="#374151"
              fontSize={11}
              angle={-45}
              textAnchor="end"
              height={50}
              interval={xAxisInterval}
              tickMargin={8}
              tick={{ fill: "#000000", fontSize: 11 }}
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
            <Bar dataKey="amount" fill="#000000" radius={[4, 4, 0, 0]} name="报销金额" maxBarSize={barSize} />
          </BarChart>
        )}
      </div>
    </Card>
  )
}
