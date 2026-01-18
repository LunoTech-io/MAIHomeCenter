function QuestionEditor({ question, index, totalQuestions, onChange, onRemove, onMoveUp, onMoveDown }) {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    onChange({ [name]: type === 'checkbox' ? checked : value })
  }

  const handleTypeChange = (e) => {
    const type = e.target.value
    const updates = { type }

    // Initialize options for radio type
    if (type === 'radio' && (!question.options || question.options.length === 0)) {
      updates.options = [{ value: '', label: '' }]
    }

    onChange(updates)
  }

  const addOption = () => {
    onChange({
      options: [...(question.options || []), { value: '', label: '' }]
    })
  }

  const updateOption = (optionIndex, field, value) => {
    const newOptions = [...(question.options || [])]
    newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value }
    onChange({ options: newOptions })
  }

  const removeOption = (optionIndex) => {
    const newOptions = (question.options || []).filter((_, i) => i !== optionIndex)
    onChange({ options: newOptions })
  }

  return (
    <div className="question-editor">
      <div className="question-header">
        <span className="question-number">Question {index + 1}</span>
        <div className="question-controls">
          <button
            type="button"
            className="control-btn"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
          >
            Up
          </button>
          <button
            type="button"
            className="control-btn"
            onClick={onMoveDown}
            disabled={index === totalQuestions - 1}
            title="Move down"
          >
            Down
          </button>
          <button
            type="button"
            className="control-btn delete"
            onClick={onRemove}
            title="Remove question"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="question-body">
        <div className="form-row">
          <div className="form-group">
            <label>Identifier</label>
            <input
              type="text"
              name="identifier"
              value={question.identifier}
              onChange={handleChange}
              placeholder="e.g., q1, satisfaction"
            />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select name="type" value={question.type} onChange={handleTypeChange}>
              <option value="radio">Radio Buttons</option>
              <option value="open_text">Open Text</option>
              <option value="display">Display Text</option>
            </select>
          </div>

          <div className="form-group checkbox-single">
            <label>
              <input
                type="checkbox"
                name="isRequired"
                checked={question.isRequired}
                onChange={handleChange}
              />
              Required
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>
            {question.type === 'display' ? 'Display Text (HTML supported)' : 'Question Text'}
          </label>
          <textarea
            name="questionText"
            value={question.questionText}
            onChange={handleChange}
            placeholder={question.type === 'display' ? 'Enter text or HTML to display' : 'Enter your question'}
            rows={question.type === 'display' ? 4 : 2}
          />
        </div>

        {question.type === 'radio' && (
          <div className="options-section">
            <label>Options</label>
            {(question.options || []).map((option, optIndex) => (
              <div key={optIndex} className="option-row">
                <input
                  type="text"
                  value={option.value}
                  onChange={(e) => updateOption(optIndex, 'value', e.target.value)}
                  placeholder="Value"
                />
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(optIndex, 'label', e.target.value)}
                  placeholder="Label"
                />
                <button
                  type="button"
                  className="option-remove-btn"
                  onClick={() => removeOption(optIndex)}
                  disabled={(question.options || []).length <= 1}
                >
                  X
                </button>
              </div>
            ))}
            <button type="button" className="add-option-btn" onClick={addOption}>
              + Add Option
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuestionEditor
