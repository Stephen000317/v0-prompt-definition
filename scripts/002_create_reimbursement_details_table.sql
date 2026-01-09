-- Create reimbursement_details table to store individual reimbursement records
CREATE TABLE IF NOT EXISTS reimbursement_details (
  id BIGSERIAL PRIMARY KEY,
  employee_name TEXT NOT NULL,
  month TEXT NOT NULL,
  date BIGINT NOT NULL, -- timestamp
  amount DECIMAL(10, 2) NOT NULL,
  category TEXT, -- 分类
  note TEXT, -- 支出说明
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Index for fast queries
  CONSTRAINT unique_detail UNIQUE (employee_name, month, date, amount, category, note)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reimbursement_details_employee_month ON reimbursement_details(employee_name, month);
CREATE INDEX IF NOT EXISTS idx_reimbursement_details_month ON reimbursement_details(month);
