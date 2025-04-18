import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// --- Chart.js Setup ---
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  TimeScale,
  TimeSeriesScale
} from 'chart.js';
import 'chartjs-adapter-dayjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  TimeScale,
  TimeSeriesScale
);
// --- End Chart.js Setup ---

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
