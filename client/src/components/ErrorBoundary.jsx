import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console (or send to remote logging)
    console.error('ErrorBoundary caught error', error, info);
  }

  render(){
    if(this.state.hasError){
      return (
        <div style={{ padding: 20, fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong.</h2>
          <p>The app encountered an unexpected error. Check the browser console for details.</p>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'crimson' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div style={{ marginTop: 12 }}>
            <button onClick={() => window.location.reload()} style={{ padding: '8px 12px', borderRadius: 6 }}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
