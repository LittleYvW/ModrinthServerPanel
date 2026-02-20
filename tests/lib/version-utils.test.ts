import { describe, it, expect } from 'vitest'
import {
  compareVersions,
  isNewerVersion,
  getLatestVersion,
  formatVersion,
} from '@/lib/version-utils'

describe('version-utils', () => {
  describe('compareVersions', () => {
    it('应该正确比较相同版本', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
      expect(compareVersions('2.5.3', '2.5.3')).toBe(0)
    })

    it('应该正确判断 v1 < v2', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1)
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    })

    it('应该正确判断 v1 > v2', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    })

    it('应该正确处理不同长度版本号', () => {
      expect(compareVersions('1.0', '1.0.0')).toBe(0)
      expect(compareVersions('1', '1.0.0')).toBe(0)
      expect(compareVersions('1.0.0.1', '1.0.0')).toBe(1)
    })

    it('应该正确处理 Minecraft 版本前缀', () => {
      expect(compareVersions('1.21.1-6.0.9', '1.21.1-6.1.0')).toBe(-1)
      expect(compareVersions('1.20-2.0.0', '1.21-2.0.0')).toBe(0)
      expect(compareVersions('mc1.20-1.2.3', 'mc1.20-1.2.4')).toBe(-1)
    })

    it('应该正确处理预发布版本', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1)
      expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(-1)
      expect(compareVersions('1.0.0-rc', '1.0.0')).toBe(-1)
      expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
      expect(compareVersions('1.0.0-beta', '1.0.0-rc')).toBe(-1)
    })

    it('应该正确处理带 v 前缀的版本', () => {
      expect(compareVersions('v1.0.0', '1.0.0')).toBe(0)
      expect(compareVersions('V1.0.0', 'v1.0.0')).toBe(0)
      expect(compareVersions('v1.0.0', 'v2.0.0')).toBe(-1)
    })
  })

  describe('isNewerVersion', () => {
    it('应该正确判断有新版本', () => {
      expect(isNewerVersion('1.0.0', '2.0.0')).toBe(true)
      expect(isNewerVersion('1.0.0', '1.0.1')).toBe(true)
    })

    it('应该正确判断没有新版本', () => {
      expect(isNewerVersion('2.0.0', '1.0.0')).toBe(false)
      expect(isNewerVersion('1.0.1', '1.0.0')).toBe(false)
      expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false)
    })
  })

  describe('getLatestVersion', () => {
    it('应该返回 null 当数组为空', () => {
      expect(getLatestVersion([])).toBeNull()
    })

    it('应该返回单个版本', () => {
      expect(getLatestVersion(['1.0.0'])).toBe('1.0.0')
    })

    it('应该从多个版本中找出最新版', () => {
      expect(getLatestVersion(['1.0.0', '2.0.0', '1.5.0'])).toBe('2.0.0')
      expect(getLatestVersion(['1.0.0', '1.0.1', '1.0.2'])).toBe('1.0.2')
    })

    it('应该正确处理 Minecraft 版本前缀', () => {
      expect(getLatestVersion(['1.20-1.0.0', '1.20-2.0.0', '1.21-1.0.0']))
        .toBe('1.20-2.0.0')
    })
  })

  describe('formatVersion', () => {
    it('应该格式化普通版本', () => {
      expect(formatVersion('1.0.0')).toBe('1.0.0')
      expect(formatVersion('2.5.3')).toBe('2.5.3')
    })

    it('应该去掉 build 信息', () => {
      expect(formatVersion('1.0.0+build.1')).toBe('1.0.0')
      expect(formatVersion('1.20.1+build.1')).toBe('1.20.1')
    })

    it('应该提取纯 mod 版本（去掉 Minecraft 前缀）', () => {
      expect(formatVersion('1.21.1-6.0.9')).toBe('6.0.9')
      expect(formatVersion('1.20-2.0.0')).toBe('2.0.0')
      expect(formatVersion('mc1.20-1.2.3')).toBe('1.2.3')
    })

    it('应该去掉 v 前缀', () => {
      expect(formatVersion('v1.0.0')).toBe('1.0.0')
      expect(formatVersion('V1.0.0')).toBe('1.0.0')
    })

    it('应该处理空值', () => {
      expect(formatVersion('')).toBe('')
    })
  })
})
