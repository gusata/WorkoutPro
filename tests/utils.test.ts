import { describe, expect, it } from 'vitest'
import { formatDecimal, parseDecimal, readableOn } from '@/lib/utils'
import { parseCallbackUrl } from '@/lib/authFlow'

describe('parseDecimal', () => {
  it('aceita virgula do teclado pt-BR e ponto', () => {
    expect(parseDecimal('22,5')).toBe(22.5)
    expect(parseDecimal('22.5')).toBe(22.5)
    expect(parseDecimal(' 80 ')).toBe(80)
  })

  it('retorna null para vazio ou invalido em vez de zerar a carga', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal(',')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
  })
})

describe('formatDecimal', () => {
  it('formata com virgula e sem casas desnecessarias', () => {
    expect(formatDecimal(102.5)).toBe('102,5')
    expect(formatDecimal(80)).toBe('80')
    expect(formatDecimal(null)).toBe('')
  })
})

describe('readableOn', () => {
  it('usa texto escuro em cores claras e branco em cores escuras', () => {
    expect(readableOn('#eab308')).toBe('#111114')
    expect(readableOn('#84cc16')).toBe('#111114')
    expect(readableOn('#6366f1')).toBe('#ffffff')
    expect(readableOn('#f43f5e')).toBe('#ffffff')
  })
})

describe('parseCallbackUrl', () => {
  it('reconhece o code do fluxo PKCE', () => {
    expect(parseCallbackUrl('workoutpro://auth/callback?code=abc123')).toEqual({ type: 'code', code: 'abc123' })
  })

  it('mantem compatibilidade com tokens do fluxo implicito', () => {
    expect(parseCallbackUrl('workoutpro://auth/callback#access_token=a&refresh_token=r')).toEqual({
      type: 'tokens', access_token: 'a', refresh_token: 'r',
    })
  })

  it('expõe erro do provedor e ignora URLs sem dados de login', () => {
    expect(parseCallbackUrl('workoutpro://auth/callback?error_description=negado')).toEqual({ type: 'error', message: 'negado' })
    expect(parseCallbackUrl('workoutpro://outra/rota')).toBeNull()
  })
})
