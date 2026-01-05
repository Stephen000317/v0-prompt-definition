// 历史数据保护工具函数

const PROTECTED_MONTHS = [
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

/**
 * 检查月份是否在保护范围内（2025年3月-11月）
 */
export function isProtectedMonth(month: string): boolean {
  return PROTECTED_MONTHS.includes(month)
}

/**
 * 验证管理员密码
 */
export function verifyAdminPassword(username: string, password: string): boolean {
  const adminUsername = process.env.ADMIN_USERNAME || "admin"
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123"

  return username === adminUsername && password === adminPassword
}

/**
 * 生成保护月份的提示信息
 */
export function getProtectedMonthsMessage(): string {
  return "2025年3月至11月的历史数据受保护，需要管理员权限才能修改"
}
