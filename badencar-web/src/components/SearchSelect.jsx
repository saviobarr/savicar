import { useState, useEffect, useRef } from 'react'

/**
 * Searchable combobox. options: [{ value, label }]
 * onChange receives the selected value (or '' when cleared).
 */
export default function SearchSelect({ options = [], value, onChange, placeholder = 'Buscar...', required = false }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Sync display text whenever value or options change
  useEffect(() => {
    if (value === '' || value == null) {
      setQuery('')
      return
    }
    const found = options.find(o => String(o.value) === String(value))
    if (found) setQuery(found.label)
  }, [value, options])

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function handleInput(e) {
    setQuery(e.target.value)
    setOpen(true)
    onChange('')
  }

  function handleSelect(opt) {
    setQuery(opt.label)
    onChange(opt.value)
    setOpen(false)
  }

  return (
    <div className="search-select" ref={ref}>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {/* Hidden input so native form validation works for required */}
      {required && (
        <input
          type="text"
          required
          value={value ?? ''}
          onChange={() => {}}
          tabIndex={-1}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        />
      )}
      {open && filtered.length > 0 && (
        <ul className="search-select__dropdown">
          {filtered.map(opt => (
            <li key={opt.value} onMouseDown={() => handleSelect(opt)}>
              {opt.label}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="search-select__empty">Nenhum resultado</div>
      )}
    </div>
  )
}
