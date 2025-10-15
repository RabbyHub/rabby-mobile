// 个人剩余借款安全边际系数
export const BORROW_SAFE_MARGIN = 0.99;

// 池子剩余存/借款额度安全边际系数
export const SUPPLY_UI_SAFE_MARGIN = 0.995;
export const BORROW_UI_SAFE_MARGIN = 0.99;

// 池子警告阈值
export const RESERVE_USAGE_WARNING_THRESHOLD = 0.98;
// 池子禁止阈值
export const RESERVE_USAGE_BLOCK_THRESHOLD = 0.9999;

// 借款/质押等操作后的健康因子低于该值时，显示风险确认复选框
export const HF_RISK_CHECKBOX_THRESHOLD = 1.5; // 1.5
// 顶部/通用健康因子颜色阈值：>=3 绿色，<1.1 红色，其余为黄色
export const HF_COLOR_GOOD_THRESHOLD = 3; // 3.0
export const HF_COLOR_BAD_THRESHOLD = 1.1; // 1.1

// 清算线
export const LIQUIDATION_HF_THRESHOLD = 1.0; // 1.0
