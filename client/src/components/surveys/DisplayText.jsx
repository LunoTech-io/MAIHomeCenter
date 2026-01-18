function DisplayText({ question }) {
  return (
    <div className="question display-text">
      <div
        className="display-content"
        dangerouslySetInnerHTML={{ __html: question.question_text }}
      />
    </div>
  )
}

export default DisplayText
