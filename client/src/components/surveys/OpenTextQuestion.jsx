function OpenTextQuestion({ question, value, onChange, index }) {
  const textareaId = `question-${question.id}`
  return (
    <div className="question open-text-question">
      <label htmlFor={textareaId} className="question-label">
        <span className="question-number">{index + 1}.</span>
        <span className="question-text">{question.question_text}</span>
        {question.is_required && <span className="required-marker" aria-label="required">*</span>}
      </label>

      <textarea
        id={textareaId}
        className="text-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your response..."
        rows={4}
        required={question.is_required}
        aria-required={question.is_required}
      />
    </div>
  )
}

export default OpenTextQuestion
