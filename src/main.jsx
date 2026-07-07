import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', padding: 40, fontFamily: 'monospace', fontSize: 14, background: '#0d0d0d', minHeight: '100vh' }}>
          <h1 style={{ color: '#f06548' }}>⚠️ 渲染错误</h1>
          <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ marginTop: 16, color: '#9d9d9d', whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
