import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("This page crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page-container">
        <div className="card">
          <h2>Something went wrong</h2>
          <p className="muted">This page hit an error. Your data is safe. Try reloading, or go back home.</p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
            <a className="btn btn-outline" href="/">Go home</a>
          </div>
        </div>
      </div>
    );
  }
}