export default function CompactFilterSelect({ label, value, options, onChange, className='' }) {
  return (
    <label className={`compact-filter-control ${value ? 'is-active' : ''} ${className}`}>
      <span className="compact-filter-label">{label}</span>
      <select aria-label={label} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => (
          <option key={option.id || 'all'} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
