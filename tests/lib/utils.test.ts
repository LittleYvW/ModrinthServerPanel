import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('utils', () => {
  describe('cn', () => {
    it('应该合并类名', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('应该处理条件类名', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
      expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz')
    })

    it('应该合并 Tailwind 冲突类名（保留后者）', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
      expect(cn('text-sm', 'text-lg')).toBe('text-lg')
    })

    it('应该处理对象形式', () => {
      expect(cn({ 'foo': true, 'bar': false })).toBe('foo')
      expect(cn({ 'foo': true, 'bar': true })).toBe('foo bar')
    })

    it('应该处理数组形式', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar')
      expect(cn(['foo'], ['bar', 'baz'])).toBe('foo bar baz')
    })

    it('应该处理复杂嵌套', () => {
      expect(cn('base', ['conditional', false && 'hidden'], { active: true }))
        .toBe('base conditional active')
    })
  })
})
