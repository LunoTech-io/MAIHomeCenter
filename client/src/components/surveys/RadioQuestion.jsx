function RadioQuestion({ question, value, onChange, index }) {
  const options = question.options || []
  const groupId = `question-${question.id}`
  const selectedOption = options.find(o => o.value === value)
  const selectedDetail = selectedOption && selectedOption.detail ? selectedOption.detail.trim() : ''

  return (
    <div className="question radio-question">
      <div className="question-label" id={`${groupId}-label`}>
        <span className="question-number">{index + 1}.</span>
        <span className="question-text">{question.question_text}</span>
        {question.is_required && <span className="required-marker" aria-label="required">*</span>}
      </div>

      <div
        className="radio-options"
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        aria-required={question.is_required}
      >
        {options.map((option, optIndex) => (
          <button
            key={optIndex}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={`radio-option ${value === option.value ? 'selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {selectedDetail && (
        <div key={value} className="radio-option-detail" role="status" aria-live="polite">
          <span className="radio-option-detail-icon" aria-hidden="true">💡</span>
          <span>{selectedDetail}</span>
        </div>
      )}
    </div>
  )
}

export default RadioQuestion
