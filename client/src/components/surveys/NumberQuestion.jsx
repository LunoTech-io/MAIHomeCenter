function NumberQuestion({ question, value, onChange, index }) {
  const inputId = `question-${question.id}`
  return (
    <div className="question number-question">
      <label htmlFor={inputId} className="question-label">
        <span className="question-number">{index + 1}.</span>
        <span className="question-text">{question.question_text}</span>
        {question.is_required && <span className="required-marker" aria-label="required">*</span>}
      </label>

      <input
        id={inputId}
        className="text-input"
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter a number..."
        step="any"
        required={question.is_required}
        aria-required={question.is_required}
      />
    </div>
  )
}

export default NumberQuestion
