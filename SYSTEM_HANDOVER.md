# 深圳市无限状态科技有限公司 - 报销管理系统

## 系统交接说明文档

---

## 一、系统概述

这是一个公司内部报销管理系统，用于管理员工报销记录、同步飞书多维表格数据、生成报销报表。

**主要功能：**
- 报销数据管理（查看、新增、编辑、删除）
- 飞书多维表格数据同步
- 月度报销趋势图表
- 个人报销分布统计
- 员工管理（银行卡信息）
- 月份锁定（防止已报销数据被覆盖）
- PDF导出
- AI智能分析

---

## 二、访问信息

### 生产环境
- **网址**: https://v0-prompt-definition-ten.vercel.app
- **登录账号**: admin@infist.ai
- **登录密码**: 20250303

### 管理后台
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **GitHub仓库**: https://github.com/[你的用户名]/v0-prompt-definition

---

## 三、技术架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端 (Next.js 16)                   │
│  - React 19 + TypeScript                                │
│  - Tailwind CSS + shadcn/ui                             │
│  - Recharts (图表)                                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    部署平台 (Vercel)                     │
│  - 自动部署                                              │
│  - Cron Job (每2天保活数据库)                            │
│  - 环境变量管理                                          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   数据库 (Supabase)                      │
│  - PostgreSQL                                           │
│  - 项目ID: gldztzlslijhagcmxhfk                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    外部集成                              │
│  - 飞书多维表格 API (报销数据来源)                        │
│  - Groq AI (智能分析)                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 四、数据库表结构

### 1. reimbursements (报销汇总表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| employee_name | TEXT | 员工姓名 |
| amount | DECIMAL | 报销金额 |
| month | TEXT | 月份 (如: "2026年1月") |
| account_number | TEXT | 银行账号 |
| bank_branch | TEXT | 开户支行 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 2. reimbursement_details (报销明细表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| employee_name | TEXT | 员工姓名 |
| amount | DECIMAL | 金额 |
| month | TEXT | 月份 |
| date | TEXT | 具体日期 |
| category | TEXT | 分类 |
| note | TEXT | 备注说明 |

### 3. employees (员工表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| name | TEXT | 员工姓名 |
| account_number | TEXT | 银行账号 |
| bank_branch | TEXT | 开户支行 |
| bank_name | TEXT | 银行名称 |
| bank_region | TEXT | 银行所在地区 |

### 4. month_locks (月份锁定表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| month | TEXT | 月份 |
| is_locked | BOOLEAN | 是否锁定 |
| locked_at | TIMESTAMP | 锁定时间 |

### 5. budgets (预算表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL | 主键 |
| month | TEXT | 月份 |
| budget_amount | DECIMAL | 预算金额 |

---

## 五、环境变量

在Vercel项目设置中配置以下环境变量：

```bash
# Supabase 数据库
NEXT_PUBLIC_SUPABASE_URL=https://gldztzlslijhagcmxhfk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# 飞书 API
FEISHU_APP_ID=xxx
FEISHU_APP_SECRET=xxx
FEISHU_APP_TOKEN=xxx      # 多维表格的App Token
FEISHU_TABLE_ID=xxx       # 多维表格的Table ID

# AI 分析
GROQ_API_KEY=xxx

# 管理员登录
ADMIN_USERNAME=admin@infist.ai
ADMIN_PASSWORD=20250303
```

---

## 六、日常操作指南

### 1. 飞书同步
1. 登录系统后，点击页面上的 **"飞书同步"** 按钮
2. 系统会自动从飞书多维表格拉取最新数据
3. 同步完成后会显示详细变更（新增/更新/删除了哪些记录）

**注意**：已锁定的月份不会被同步更新

### 2. 月份锁定
1. 点击 **"月份锁定"** 按钮
2. 选择要锁定的月份，点击"锁定"
3. 锁定后，该月份的数据不会被飞书同步覆盖

**建议**：每月报销完成后，锁定该月份

### 3. 手动新增报销
1. 点击 **"新增报销"** 按钮
2. 选择员工（或新建员工）
3. 填写金额、月份、银行信息
4. 点击确认

### 4. 导出PDF
1. 切换到要导出的月份
2. 点击 **"导出PDF"** 按钮
3. 系统会生成当月的报销报表

### 5. 员工管理
1. 点击 **"管理"** → **"员工管理"**
2. 可以查看/修改员工的银行卡信息

---

## 七、飞书多维表格配置

### 表格字段对应关系
| 飞书字段 | 系统字段 |
|---------|---------|
| 支出人 | employee_name |
| 金额 | amount |
| 日期 | date |
| 分类 | category |
| 支出说明 | note |

### 权限配置
如果飞书同步报403错误：
1. 打开飞书多维表格
2. 点击右上角"分享"
3. 在"邀请协作者"中添加飞书应用
4. 给予"可编辑"权限

---

## 八、常见问题

### Q1: 飞书同步失败 (403错误)
**原因**: 飞书应用没有访问多维表格的权限
**解决**: 在飞书多维表格中添加应用为协作者

### Q2: 数据库连接失败
**原因**: Supabase免费版7天不活动会暂停
**解决**: 系统已配置自动保活(每2天)，如果暂停了，去Supabase Dashboard恢复项目

### Q3: 登录失败
**检查**: 
- 账号: admin@infist.ai
- 密码: 20250303
- 如需修改，在Vercel环境变量中更新ADMIN_USERNAME和ADMIN_PASSWORD

### Q4: 图表数据不显示
**解决**: 刷新页面，检查是否有报销数据

---

## 九、代码修改指南

### 本地开发
```bash
# 1. 克隆代码
git clone https://github.com/[用户名]/v0-prompt-definition.git

# 2. 安装依赖
npm install

# 3. 创建.env.local文件，填入环境变量

# 4. 启动开发服务器
npm run dev
```

### 部署
- 代码推送到GitHub后，Vercel会自动部署
- 或在v0.app中修改后，点击"Merge PR"发布

### 主要文件说明
```
app/
  page.tsx              # 主页面
  api/
    feishu-sync/        # 飞书同步API
    manual-reimbursement/ # 手动新增报销API
    month-lock/         # 月份锁定API
    keep-alive/         # 数据库保活API
    
components/
  feishu-sync-dialog.tsx    # 飞书同步对话框
  month-lock-dialog.tsx     # 月份锁定对话框
  add-reimbursement-dialog.tsx  # 新增报销对话框
  reimbursement-table.tsx   # 报销表格
  monthly-trend-chart.tsx   # 月度趋势图
```

---

## 十、联系方式

如有问题，可以：
1. 在v0.app中直接与AI对话修改代码
2. 查看Vercel部署日志排查问题
3. 查看Supabase数据库日志

---

**文档更新日期**: 2026年5月15日
