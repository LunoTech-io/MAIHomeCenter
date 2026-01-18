function RadioQuestion({ question, value, onChange, index }) {
  const options = question.options || []

  return (
    <div className="question radio-question">
      <div className="question-label">
        <span className="question-number">{index + 1}.</span>
        <span className="question-text">{question.question_text}</span>
        {question.is_required && <span className="required-marker">*</span>}
      </div>

      <div className="radio-options">
        {options.map((option, optIndex) => (
          <button
            key={optIndex}
            type="button"
            className={`radio-option ${value === option.value ? 'selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default RadioQuestion
