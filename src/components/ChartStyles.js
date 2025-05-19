export const chartColors = {
  primary: '#4b42d9',
  primaryLight: 'rgba(75, 66, 217, 0.2)',
  secondary: '#dc3545',
  secondaryLight: 'rgba(220, 53, 69, 0.2)',
  tertiary: '#ffc107',
  tertiaryLight: 'rgba(255, 193, 7, 0.2)',
  text: '#ffffff',
  grid: '#232b3b',
  background: '#181f2a',
  tooltipText: '#fff',
  // Sentiment band colors (use light transparency, aligned with tags)
  veryPositiveBg: 'rgba(30, 77, 40, 0.2)',
  positiveBg: 'rgba(56, 118, 29, 0.2)',
  neutralBg: 'rgba(128, 128, 128, 0.2)',
  negativeBg: 'rgba(180, 95, 6, 0.2)',
  veryNegativeBg: 'rgba(153, 0, 0, 0.2)'
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
  background: chartColors.background,
  padding: '20px',
  borderRadius: '8px',
  marginBottom: '20px',
  height: '300px'
}; 