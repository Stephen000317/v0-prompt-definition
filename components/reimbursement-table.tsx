"use client"

import type React from "react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2, Pencil } from "lucide-react"
import type { ReimbursementRecord } from "@/lib/db"

interface ReimbursementTableProps {
  records: ReimbursementRecord[]
  onDelete: (id: string) => void
  onEdit: (record: ReimbursementRecord) => void
  onShowDetails?: (record: ReimbursementRecord) => void
}

export function ReimbursementTable({ records, onDelete, onEdit, onShowDetails }: ReimbursementTableProps) {
  const monthlyTotal = records.reduce((sum, record) => sum + record.amount, 0)

  return (
    <Card className="overflow-hidden border border-gray-300">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-100">
              <th
                className="border-r border-gray-300 px-4 py-3 text-left text-sm font-semibold"
                style={{ color: "#000000 !important" } as React.CSSProperties}
              >
                员工姓名
              </th>
              <th
                className="border-r border-gray-300 px-4 py-3 text-left text-sm font-semibold"
                style={{ color: "#000000 !important" } as React.CSSProperties}
              >
                报销金额 (¥)
              </th>
              <th
                className="border-r border-gray-300 px-4 py-3 text-left text-sm font-semibold"
                style={{ color: "#000000 !important" } as React.CSSProperties}
              >
                开户行
              </th>
              <th
                className="border-r border-gray-300 px-4 py-3 text-left text-sm font-semibold"
                style={{ color: "#000000 !important" } as React.CSSProperties}
              >
                账号
              </th>
              <th
                className="border-r border-gray-300 px-4 py-3 text-left text-sm font-semibold"
                style={{ color: "#000000 !important" } as React.CSSProperties}
              >
                备注
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold print:hidden"
                style={{ color: "#000000 !important" } as React.CSSProperties}
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center"
                  style={{ color: "#666666 !important" } as React.CSSProperties}
                >
                  暂无报销记录
                </td>
              </tr>
            ) : (
              <>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-gray-300 transition-colors hover:bg-gray-50">
                    <td
                      className="border-r border-gray-300 px-4 py-3 text-sm"
                      style={{ color: "#000000 !important" } as React.CSSProperties}
                    >
                      {record.employee_name}
                    </td>
                    <td
                      className="border-r border-gray-300 px-4 py-3 text-sm font-semibold cursor-pointer hover:bg-blue-50 transition-colors"
                      style={{ color: "#000000 !important" } as React.CSSProperties}
                      onDoubleClick={() => onShowDetails?.(record)}
                      title="双击查看明细"
                    >
                      ¥{record.amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td
                      className="border-r border-gray-300 px-4 py-3 text-sm"
                      style={{ color: "#000000 !important" } as React.CSSProperties}
                    >
                      {record.bank_branch}
                    </td>
                    <td
                      className="border-r border-gray-300 px-4 py-3 text-sm"
                      style={{ color: "#000000 !important" } as React.CSSProperties}
                    >
                      {record.account_number}
                    </td>
                    <td
                      className="border-r border-gray-300 px-4 py-3 text-sm"
                      style={{ color: "#000000 !important" } as React.CSSProperties}
                    >
                      {record.note || "-"}
                    </td>
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex gap-2">
                        <Button
                          onClick={() => onEdit(record)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => onDelete(record.id!)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-400 bg-blue-50">
                  <td
                    className="border-r border-gray-300 px-4 py-3 text-sm font-bold"
                    style={{ color: "#000000 !important" } as React.CSSProperties}
                  >
                    本月合计
                  </td>
                  <td
                    className="border-r border-gray-300 px-4 py-3 text-sm font-bold text-blue-600"
                    style={{ color: "#2563eb !important" } as React.CSSProperties}
                  >
                    ¥{monthlyTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="border-r border-gray-300 px-4 py-3" colSpan={3}></td>
                  <td className="px-4 py-3 print:hidden"></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
