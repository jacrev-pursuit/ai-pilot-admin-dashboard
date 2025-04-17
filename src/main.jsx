import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('Starting React application...');

const root = document.getElementById('root');
console.log('Found root element:', root);

try {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('React mounted successfully');
} catch (error) {
  console.error('Failed to mount React:', error);
}
