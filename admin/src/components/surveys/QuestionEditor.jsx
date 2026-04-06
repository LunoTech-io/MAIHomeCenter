import { useLanguage } from '../../contexts/LanguageContext'

function QuestionEditor({ question, index, totalQuestions, onChange, onRemove, onMoveUp, onMoveDown }) {
  const { t } = useLanguage()

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
        <div className="question-header-left">
          <div className="question-reorder">
            <button
              type="button"
              className="reorder-btn"
              onClick={onMoveUp}
              disabled={index === 0}
              title={t('questions.moveUp')}
            >
              &#9650;
            </button>
            <button
              type="button"
              className="reorder-btn"
              onClick={onMoveDown}
              disabled={index === totalQuestions - 1}
              title={t('questions.moveDown')}
            >
              &#9660;
            </button>
          </div>
          <span className="question-number">{t('questions.question')} {index + 1}</span>
        </div>
        <button
          type="button"
          className="question-remove-btn"
          onClick={onRemove}
          title={t('questions.remove')}
        >
          &#10005;
        </button>
      </div>

      <div className="question-body">
        <div className="form-row">
          <div className="form-group">
            <label>{t('questions.identifier')}</label>
            <input
              type="text"
              name="identifier"
              value={question.identifier}
              onChange={handleChange}
              placeholder={t('questions.identifierPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label>{t('questions.type')}</label>
            <select name="type" value={question.type} onChange={handleTypeChange}>
              <option value="radio">{t('questions.typeRadio')}</option>
              <option value="open_text">{t('questions.typeOpenText')}</option>
              <option value="display">{t('questions.typeDisplay')}</option>
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
              {t('questions.required')}
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>
            {question.type === 'display' ? t('questions.displayTextLabel') : t('questions.questionText')}
          </label>
          <textarea
            name="questionText"
            value={question.questionText}
            onChange={handleChange}
            placeholder={question.type === 'display' ? t('questions.displayPlaceholder') : t('questions.questionPlaceholder')}
            rows={question.type === 'display' ? 4 : 2}
          />
        </div>

        {question.type === 'radio' && (
          <div className="options-section">
            <label>{t('questions.options')}</label>
            {(question.options || []).map((option, optIndex) => (
              <div key={optIndex} className="option-row">
                <input
                  type="text"
                  value={option.value}
                  onChange={(e) => updateOption(optIndex, 'value', e.target.value)}
                  placeholder={t('questions.valuePlaceholder')}
                />
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => updateOption(optIndex, 'label', e.target.value)}
                  placeholder={t('questions.labelPlaceholder')}
                />
                <button
                  type="button"
                  className="option-remove-btn"
                  onClick={() => removeOption(optIndex)}
                  disabled={(question.options || []).length <= 1}
                >
                  &#10005;
                </button>
              </div>
            ))}
            <button type="button" className="add-option-btn" onClick={addOption}>
              {t('questions.addOption')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuestionEditor
