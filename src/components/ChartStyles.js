export const chartColors = {
  primary: '#4f46e5',
  primaryLight: 'rgba(79, 70, 229, 0.2)',
  secondary: '#10b981',
  secondaryLight: 'rgba(16, 185, 129, 0.2)',
  tertiary: '#f59e0b',
  tertiaryLight: 'rgba(245, 158, 11, 0.2)',
  text: '#e5e7eb',
  grid: 'rgba(255, 255, 255, 0.1)',
  background: '#1f2937'
};

export const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: chartColors.text,
        font: {
          size: 12
        }
      }
    },
    tooltip: {
      backgroundColor: chartColors.background,
      titleColor: chartColors.text,
      bodyColor: chartColors.text,
      borderColor: chartColors.grid,
      borderWidth: 1,
      padding: 10,
      displayColors: true,
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          if (context.parsed.y !== null) {
            label += context.parsed.y.toFixed(1) + '%';
          }
          return label;
        }
      }
    }
  },
  scales: {
    y: {
      grid: {
        color: chartColors.grid
      },
      ticks: {
        color: chartColors.text
      }
    },
    x: {
      grid: {
        color: chartColors.grid
      },
      ticks: {
        color: chartColors.text
      }
    }
  }
};

export const chartContainer = {
  background: '#2f2f2f',
  padding: '20px',
  borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  marginBottom: '20px'
}; 