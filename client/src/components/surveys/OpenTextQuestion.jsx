function OpenTextQuestion({ question, value, onChange, index }) {
  return (
    <div className="question open-text-question">
      <div className="question-label">
        <span className="question-number">{index + 1}.</span>
        <span className="question-text">{question.question_text}</span>
        {question.is_required && <span className="required-marker">*</span>}
      </div>

      <textarea
        className="text-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your response..."
        rows={4}
      />
    </div>
  )
}

export default OpenTextQuestion
