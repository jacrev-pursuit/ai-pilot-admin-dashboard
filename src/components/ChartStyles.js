export const chartColors = {
  primary: '#4f46e5',
  primaryLight: 'rgba(79, 70, 229, 0.2)',
  secondary: '#dc3545',
  secondaryLight: 'rgba(220, 53, 69, 0.2)',
  tertiary: '#ffc107',
  tertiaryLight: 'rgba(255, 193, 7, 0.2)',
  text: '#495057',
  grid: 'rgba(0, 0, 0, 0.1)',
  background: '#ffffff',
  tooltipText: '#212529',
  // Sentiment band colors (use light transparency)
  veryPositiveBg: 'rgba(34, 139, 34, 0.1)',  // Light green (based on 'green' tag)
  positiveBg: 'rgba(0, 191, 255, 0.1)',     // Light cyan (based on 'cyan' tag)
  neutralBg: 'rgba(108, 117, 125, 0.08)', // Light grey (based on 'default' tag)
  negativeBg: 'rgba(255, 165, 0, 0.1)',    // Light orange (based on 'orange' tag)
  veryNegativeBg: 'rgba(220, 53, 69, 0.1)'   // Light red (based on 'red' tag)
};

export const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        color: chartColors.text,
        font: {
          size: 12
        }
      }
    },
    tooltip: {
      backgroundColor: chartColors.background,
      titleColor: chartColors.tooltipText,
      bodyColor: chartColors.tooltipText,
      borderColor: chartColors.grid,
      borderWidth: 1,
      padding: 10,
      displayColors: true,
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
  background: '#ffffff',
  padding: '20px',
  borderRadius: '8px',
  border: '1px solid #dee2e6',
  marginBottom: '20px',
  height: '300px'
}; 