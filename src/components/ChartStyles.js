export const chartColors = {
  background: '#181f2a',
  primary: '#4b42d9',
  secondary: '#bf9002',
  tertiary: '#66BB6A',
  text: '#ffffff',
  grid: '#282f3b',
  tooltipText: '#fff',
  // Sentiment band colors (use light transparency, aligned with tags)
  veryPositiveBg: 'rgba(56, 118, 29, 0.2)',
  positiveBg: 'rgba(56, 118, 29, 0.1)',
  neutralBg: 'rgba(128, 128, 128, 0.1)',
  negativeBg: 'rgba(180, 95, 6, 0.1)',
  veryNegativeBg: 'rgba(153, 0, 0, 0.2)'
};

export const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      align: 'end',
      labels: {
        boxWidth: 12,
        padding: 15,
        color: chartColors.text
      }
    },
    tooltip: {
      backgroundColor: 'rgba(30, 35, 43, 0.9)',
      titleColor: chartColors.text,
      bodyColor: chartColors.text,
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 4,
      displayColors: true,
    }
  },
  scales: {
    x: {
      grid: {
        color: chartColors.grid,
        borderColor: chartColors.grid,
        tickColor: chartColors.grid
      },
      ticks: {
        color: chartColors.text,
        padding: 8
      }
    },
    y: {
      beginAtZero: true,
      grid: {
        color: chartColors.grid,
        borderColor: chartColors.grid,
        tickColor: chartColors.grid
      },
      ticks: {
        color: chartColors.text,
        padding: 8
      }
    }
  }
};

export const chartContainer = {
  background: chartColors.background,
  borderRadius: '8px',
  padding: '16px',
  position: 'relative',
  width: '100%',
  height: '300px'
}; 