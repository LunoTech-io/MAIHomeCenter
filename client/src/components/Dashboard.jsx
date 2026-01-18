import NotificationButton from './NotificationButton'

const widgets = [
  { icon: '🌡️', value: '23°C', label: 'Temperature', color: 'green' },
  { icon: '💧', value: '45%', label: 'Humidity', color: 'blue' },
  { icon: '💡', value: '3/8', label: 'Lights On', color: 'yellow' },
  { icon: '🔒', value: 'Locked', label: 'Security', color: 'green' }
]

const quickActions = [
  { icon: '💡', label: 'Lights' },
  { icon: '🌡️', label: 'Climate' },
  { icon: '🔒', label: 'Locks' },
  { icon: '📹', label: 'Cameras' },
  { icon: '🚪', label: 'Doors' },
  { icon: '⚡', label: 'Energy' }
]

function Dashboard() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>MAIHomeCenter</h1>
        <p>Welcome home! Everything is running smoothly.</p>
      </header>

      <div className="widget-grid">
        {widgets.map((widget, index) => (
          <div key={index} className="widget">
            <div className={`widget-icon ${widget.color}`}>
              {widget.icon}
            </div>
            <div className="widget-value">{widget.value}</div>
            <div className="widget-label">{widget.label}</div>
          </div>
        ))}
      </div>

      <div className="notification-section">
        <h2>Notifications</h2>
        <NotificationButton />
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          {quickActions.map((action, index) => (
            <button key={index} className="action-btn">
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
