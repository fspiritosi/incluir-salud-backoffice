"use client"

import * as React from "react"
import { useState } from "react"
import { ChevronDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface ComboboxOption {
  value: string
  label: string
  searchText?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  onSearchChange?: (q: string) => void
  externalSearch?: boolean
  loading?: boolean
  selectedLabel?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar opción...",
  searchPlaceholder = "Buscar...",
  emptyText = "No se encontraron resultados.",
  disabled = false,
  className,
  onSearchChange,
  externalSearch = false,
  loading = false,
  selectedLabel,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const selectedOption = options.find((option) => option.value === value)
  
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .replace(/[^a-z0-9 ]+/g, ' ') // strip punctuation/symbols
      .replace(/\s+/g, ' ') // collapse spaces
      .trim()
  const onlyDigits = (s: string) => (s.match(/\d+/g)?.join('') || '')

  const filteredOptions = externalSearch
    ? options
    : options.filter((option) => {
        const raw = option.searchText || option.label
        const haystack = normalize(raw)
        const digits = onlyDigits(raw)
        const q = normalize(searchTerm)
        if (!q) return true
        const tokens = q.split(' ').filter(Boolean)
        const qDigits = onlyDigits(searchTerm)
        const tokensMatch = tokens.every(t => haystack.includes(t))
        const dniMatch = qDigits ? digits.includes(qDigits) : false
        return tokensMatch || dniMatch
      })

  const handleSelect = (optionValue: string) => {
    onValueChange?.(optionValue)
    setOpen(false)
    setSearchTerm("")
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange?.("")
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : (value && selectedLabel ? selectedLabel : placeholder)}
        </span>
        <div className="flex items-center gap-2">
          {selectedOption && (
            <X
              className="h-4 w-4 opacity-50 hover:opacity-100"
              onClick={handleClear}
            />
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </Button>
      
      {open && (
        <div className="absolute top-full z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  onSearchChange?.(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                  }
                }}
                className="pl-8"
                autoFocus
              />
            </div>
          </div>
          
          <div className="max-h-[200px] overflow-y-auto">
            {loading && (
              <div className="p-3 text-sm text-gray-500 text-center">Buscando...</div>
            )}
            {!loading && filteredOptions.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "px-4 py-2 text-sm cursor-pointer hover:bg-gray-100",
                    value === option.value && "bg-gray-100 font-medium"
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {open && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  )
}
