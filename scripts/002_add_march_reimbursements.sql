-- 添加2025年3月报销数据

-- 1. 先添加新员工李楠楠
INSERT INTO employees (name, account_number, bank_branch)
VALUES ('李楠楠', '6227 0000 6472 4713 549', '中国建设银行股份有限公司天津滨海第一支行')
ON CONFLICT (name) DO NOTHING;

-- 2. 更新潘巧玲的银行信息（从华侨城更新为华润城）
UPDATE employees 
SET bank_branch = '招商银行股份有限公司深圳华润城支行'
WHERE name = '潘巧玲';

-- 3. 添加三月份的报销记录
INSERT INTO reimbursements (employee_name, amount, account_number, bank_branch, month, note)
VALUES 
  ('蒋坤洪', 2522.97, '6228 4800 5710 1274 579', '中国农业银行股份有限公司武汉藏龙岛支行', '2025年3月', NULL),
  ('李楠楠', 3097.06, '6227 0000 6472 4713 549', '中国建设银行股份有限公司天津滨海第一支行', '2025年3月', NULL),
  ('潘巧玲', 5000.00, '6214 8665 5633 9474', '招商银行股份有限公司深圳华润城支行', '2025年3月', NULL),
  ('李宇航', 20339.02, '6231 3601 0996 1108', '招商银行股份有限公司北京青年路支行', '2025年3月', NULL),
  ('Justin', 4695.42, '6231 3601 0996 1108', '招商银行股份有限公司北京青年路支行', '2025年3月', NULL);

-- 4. 更新月度汇总数据
INSERT INTO monthly_summaries (month, total_amount, record_count)
VALUES ('2025年3月', 35654.47, 5)
ON CONFLICT (month) 
DO UPDATE SET 
  total_amount = EXCLUDED.total_amount,
  record_count = EXCLUDED.record_count;
