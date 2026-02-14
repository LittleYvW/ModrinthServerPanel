/**
 * Framer Motion 动画配置
 * 统一管理系统中的所有动画效果
 */

import { Variants, Transition } from 'framer-motion';

// ===== 缓动曲线 =====
export const easings = {
  // 标准缓动
  standard: [0.4, 0, 0.2, 1] as const,
  // 进入缓动
  enter: [0, 0, 0.2, 1] as const,
  // 退出缓动
  exit: [0.4, 0, 1, 1] as const,
  // 弹性缓动
  bounce: [0.34, 1.56, 0.64, 1] as const,
  // 弹簧缓动
  spring: [0.175, 0.885, 0.32, 1.275] as const,
  // 平滑缓动
  smooth: [0.25, 0.1, 0.25, 1] as const,
};

// ===== 基础过渡配置 =====
export const transitions = {
  fast: { duration: 0.15, ease: easings.standard } as Transition,
  normal: { duration: 0.25, ease: easings.standard } as Transition,
  slow: { duration: 0.35, ease: easings.standard } as Transition,
  spring: { type: 'spring', stiffness: 400, damping: 25 } as Transition,
  bounce: { type: 'spring', stiffness: 500, damping: 20 } as Transition,
};

// ===== 淡入动画变体 =====
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
};

// ===== 淡入上移动画变体 =====
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easings.enter },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: transitions.fast,
  },
};

// ===== 淡入下移动画变体 =====
export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easings.enter },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: transitions.fast,
  },
};

// ===== 淡入缩放动画变体 =====
export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: easings.spring },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: transitions.fast,
  },
};

// ===== 滑入动画变体（从右） =====
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: easings.enter },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: transitions.fast,
  },
};

// ===== 滑入动画变体（从左） =====
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: easings.enter },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: transitions.fast,
  },
};

// ===== Tab 内容切换动画 =====
export const tabContent: Variants = {
  hidden: (direction: 'left' | 'right') => ({
    opacity: 0,
    x: direction === 'right' ? 16 : -16,
  }),
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: easings.standard },
  },
  exit: (direction: 'left' | 'right') => ({
    opacity: 0,
    x: direction === 'right' ? -16 : 16,
    transition: transitions.fast,
  }),
};

// ===== 交错子元素动画 =====
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

// ===== 列表项动画 =====
export const listItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: easings.enter },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: transitions.fast,
  },
};

// ===== 卡片悬停动画 =====
export const cardHover = {
  rest: {
    y: 0,
    boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
    transition: transitions.normal,
  },
  hover: {
    y: -2,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
    transition: transitions.normal,
  },
};

// ===== 按钮点击动画 =====
export const buttonTap = {
  scale: 0.96,
  transition: transitions.fast,
};

// ===== 弹性缩放动画 =====
export const springScale: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 25 },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: transitions.fast,
  },
};

// ===== 对话框动画 =====
export const dialogOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.normal },
  exit: { opacity: 0, transition: transitions.fast },
};

export const dialogContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: easings.spring },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: transitions.fast,
  },
};

// ===== 下拉菜单动画 =====
export const dropdownMenu: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.15, ease: easings.standard },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

// ===== 面板展开/收起动画 =====
export const panelExpand: Variants = {
  hidden: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.2, ease: easings.exit },
  },
  visible: {
    height: 'auto',
    opacity: 1,
    transition: { duration: 0.3, ease: easings.enter },
  },
};

// ===== 通知/警告动画 =====
export const alertAnimation: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.2, ease: easings.spring },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: transitions.fast,
  },
};

// ===== 进度条动画 =====
export const progressBar = {
  initial: { width: 0 },
  animate: (progress: number) => ({
    width: `${progress}%`,
    transition: { duration: 0.3, ease: easings.standard },
  }),
};

// ===== 悬浮提示动画 =====
export const tooltip: Variants = {
  hidden: { opacity: 0, y: 4, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.15, ease: easings.standard },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.96,
    transition: { duration: 0.1 },
  },
};

// ===== 页面过渡动画 =====
export const pageTransition: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: easings.enter },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2, ease: easings.exit },
  },
};

// ===== 图标旋转动画 =====
export const iconSpin = {
  animate: {
    rotate: 360,
    transition: { duration: 2, ease: 'linear', repeat: Infinity },
  },
};

// ===== 脉冲动画 =====
export const pulse = {
  animate: {
    opacity: [1, 0.7, 1],
    transition: { duration: 2, ease: 'easeInOut', repeat: Infinity },
  },
};

// ===== 悬浮动画 =====
export const float = {
  animate: {
    y: [0, -4, 0],
    transition: { duration: 0.6, ease: easings.bounce },
  },
};

// ===== 闪烁动画 =====
export const shimmer = {
  animate: {
    backgroundPosition: ['-200% 0', '200% 0'],
    transition: { duration: 2, ease: 'linear', repeat: Infinity },
  },
};

// ===== 依赖分析器专用动画 =====

// 分析阶段动画（使用 transform 和 opacity，不影响布局）
export const analysisPhase: Variants = {
  hidden: (index: number) => ({
    opacity: 0,
    y: 15,
    scale: 0.95,
    transition: { delay: index * 0.1 },
  }),
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { 
      delay: index * 0.12,
      duration: 0.35,
      ease: easings.spring,
    },
  }),
  exit: (index: number) => ({
    opacity: 0,
    y: -10,
    scale: 0.98,
    transition: { 
      delay: (3 - index) * 0.05,
      duration: 0.2,
      ease: easings.exit,
    },
  }),
};

// 依赖项动画
export const dependencyItem: Variants = {
  hidden: { 
    opacity: 0, 
    x: -10,
    scale: 0.98,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    scale: 1,
    transition: { 
      duration: 0.25,
      ease: easings.spring,
    },
  },
  exit: {
    opacity: 0,
    x: 10,
    scale: 0.98,
    transition: { duration: 0.15 },
  },
};

// 状态徽章动画
export const statusBadge: Variants = {
  hidden: { 
    scale: 0,
    opacity: 0,
  },
  visible: { 
    scale: 1,
    opacity: 1,
    transition: { 
      type: 'spring',
      stiffness: 500,
      damping: 15,
    },
  },
};

// 扫描线动画
export const scanLine = {
  animate: {
    x: ['-100%', '100%'],
    transition: { 
      duration: 1.5, 
      ease: 'linear' as const, 
      repeat: Infinity,
    },
  },
};

// 分析脉冲动画
export const analysisPulse = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.8, 1, 0.8],
    transition: { 
      duration: 1.5, 
      ease: 'easeInOut' as const, 
      repeat: Infinity,
    },
  },
};

// 结果项交错动画
export const resultStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// 分析阶段容器动画
export const analysisPhaseContainer: Variants = {
  hidden: { opacity: 1 },
  visible: { 
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
  exit: { 
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: easings.exit,
    },
  },
};

// 扫描区域整体退出动画（仅使用 opacity，不影响布局）
export const scanningExit: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
  exit: { 
    opacity: 0,
    transition: { 
      duration: 0.25,
      ease: easings.exit,
      when: 'afterChildren',
    },
  },
};

// 结果区域进入动画（仅使用 transform，不影响布局）
export const resultsEnter: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.96,
    y: 16,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: { 
      duration: 0.35,
      ease: easings.spring,
      delay: 0.1,
    },
  },
  exit: { 
    opacity: 0,
    scale: 0.98,
    y: -8,
    transition: { duration: 0.15 },
  },
};

// 雷达扫描区域退出动画
export const radarExit: Variants = {
  hidden: { opacity: 1, scale: 1 },
  visible: { opacity: 1, scale: 1 },
  exit: { 
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.25, ease: easings.exit },
  },
};

// 成功检查动画
export const successCheck: Variants = {
  hidden: { 
    scale: 0,
    rotate: -180,
  },
  visible: { 
    scale: 1,
    rotate: 0,
    transition: { 
      type: 'spring',
      stiffness: 400,
      damping: 15,
    },
  },
};

// 警告抖动动画
export const warningShake = {
  animate: {
    x: [0, -3, 3, -3, 3, 0],
    transition: { 
      duration: 0.4,
      ease: 'easeInOut' as const,
    },
  },
};

// 数据流动画
export const dataFlow = {
  animate: {
    backgroundPosition: ['0% 0%', '100% 0%'],
    transition: { 
      duration: 1, 
      ease: 'linear' as const, 
      repeat: Infinity,
    },
  },
};
