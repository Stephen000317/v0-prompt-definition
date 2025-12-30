-- 创建员工信息表
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  account_number TEXT NOT NULL,
  bank_branch TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建报销记录表
CREATE TABLE IF NOT EXISTS public.reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  account_number TEXT NOT NULL,
  bank_branch TEXT NOT NULL,
  note TEXT,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建月度汇总表
CREATE TABLE IF NOT EXISTS public.monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL UNIQUE,
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  record_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_reimbursements_month ON public.reimbursements(month);
CREATE INDEX IF NOT EXISTS idx_reimbursements_employee ON public.reimbursements(employee_name);
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_month ON public.monthly_summaries(month);

-- 由于这是内部管理系统，暂不启用RLS（如果需要用户认证，可以启用）
-- 如果后续需要多用户支持，取消下面注释
-- ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;
