import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('应该正确渲染按钮', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('应该应用默认变体样式', () => {
    const { container } = render(<Button>Default</Button>)
    const button = container.querySelector('[data-variant="default"]')
    expect(button).toBeInTheDocument()
  })

  it('应该应用不同变体样式', () => {
    const { rerender, container } = render(<Button variant="destructive">Destructive</Button>)
    expect(container.querySelector('[data-variant="destructive"]')).toBeInTheDocument()

    rerender(<Button variant="outline">Outline</Button>)
    expect(container.querySelector('[data-variant="outline"]')).toBeInTheDocument()

    rerender(<Button variant="ghost">Ghost</Button>)
    expect(container.querySelector('[data-variant="ghost"]')).toBeInTheDocument()

    rerender(<Button variant="link">Link</Button>)
    expect(container.querySelector('[data-variant="link"]')).toBeInTheDocument()
  })

  it('应该应用不同尺寸', () => {
    const { container, rerender } = render(<Button size="sm">Small</Button>)
    expect(container.querySelector('[data-size="sm"]')).toBeInTheDocument()

    rerender(<Button size="lg">Large</Button>)
    expect(container.querySelector('[data-size="lg"]')).toBeInTheDocument()

    rerender(<Button size="icon">Icon</Button>)
    expect(container.querySelector('[data-size="icon"]')).toBeInTheDocument()
  })

  it('应该支持 disabled 状态', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled()
  })

  it('应该响应点击事件', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('应该支持 asChild 属性', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )
    
    const link = screen.getByRole('link', { name: 'Link Button' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })

  it('应该合并自定义类名', () => {
    const { container } = render(<Button className="custom-class">Custom</Button>)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
