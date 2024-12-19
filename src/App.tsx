import { useState, useEffect } from 'react'
import axios from 'axios'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Filler,
  Legend
} from 'chart.js'
import './App.css'
import annotationPlugin from 'chartjs-plugin-annotation';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Filler,
  Legend,
  annotationPlugin
)

interface StockDataPoint {
  time: number;
  price: number;
  isNewTrend?: boolean;
  hidden?: boolean;
}

interface StockAnalysis {
  trend: string;
  reason: string;
  technicalIndicators: string[];
  keyPoints: {
    support: number;
    resistance: number;
    volume: string;
    momentum: string;
    recommendation: string;
    macd: {
      value: number | null;
      signal: number | null;
      histogram: number | null;
    };
    bollinger: {
      upper: number | null;
      middle: number | null;
      lower: number | null;
    };
  };
}

interface BollingerBands {
  upper: (number | null)[];
  lower: (number | null)[];
}

interface MacdData {
  values: (number | null)[];
  signals: (number | null)[];
  histogram: (number | null)[];
}

interface MacdResult {
  value: number | null;
  signal: number | null;
  histogram: number | null;
}

interface BollingerResult {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

interface ChartDataset {
  label: string;
  data: (number | null)[];
  borderColor: string;
  backgroundColor: string | string[];
  fill: boolean;
  yAxisID: string;
  pointRadius?: number | number[];
  pointBackgroundColor?: string | string[];
  pointBorderColor?: string | string[];
  segment?: any;
  borderDash?: number[];
  type?: 'line' | 'bar';
}

interface ChartDataType {
  labels: string[];
  datasets: ChartDataset[];
}

function App() {
  const [stockData, setStockData] = useState<StockDataPoint[]>([])
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [prediction, setPrediction] = useState<string | null>(null)
  const [symbol, setSymbol] = useState('AAPL')
  const [feedback, setFeedback] = useState<string>('')
  const [canPredict, setCanPredict] = useState(true)
  const [timer, setTimer] = useState(0)
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null)
  const [fullStockData, setFullStockData] = useState<StockDataPoint[]>([])
  const [showFullGraph, setShowFullGraph] = useState(false)
  const [showNextButton, setShowNextButton] = useState(false)
  const [predictionResult, setPredictionResult] = useState<'correct' | 'wrong' | null>(null)
  const [bollingerBands, setBollingerBands] = useState<BollingerBands>({ 
    upper: [], 
    lower: [] 
  });
  const [macdData, setMacdData] = useState<MacdData>({
    values: [],
    signals: [],
    histogram: []
  });

  const fetchRandomStockData = async () => {
    const randomSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NFLX', 'NVDA']
    const randomSymbol = randomSymbols[Math.floor(Math.random() * randomSymbols.length)]
    setSymbol(randomSymbol)
    setCanPredict(true)
    setShowFullGraph(false)

    try {
      const response = await axios.get(
        `https://cors-proxy.fringe.zone/https://query1.finance.yahoo.com/v8/finance/chart/${randomSymbol}?range=2wk&interval=1d`
      )
      const timeSeries = response.data.chart.result[0].indicators.quote[0]
      const timestamps = response.data.chart.result[0].timestamp

      const fullData = timestamps.map((time: number, index: number) => ({
        time: time * 1000,
        price: timeSeries.close[index],
        isNewTrend: false,
        hidden: index > timestamps.length / 2
      })).filter((dataPoint: StockDataPoint) => dataPoint.price !== null)

      const prices = fullData.map((d: StockDataPoint) => d.price);
      const bb = calculateBollingerBands(prices, 20);
      const macd = calculateMACD(prices);

      setBollingerBands({
        upper: bb.map(b => b.upper),
        lower: bb.map(b => b.lower)
      });

      setMacdData({
        values: macd.map(m => m.value),
        signals: macd.map(m => m.signal),
        histogram: macd.map(m => m.histogram)
      });

      setFullStockData(fullData)
      setStockData(fullData.filter((point: StockDataPoint) => !point.hidden));
      analyzeStockMovement(fullData)
    } catch (error) {
      console.error('Error fetching stock data:', error)
    }
  }

  const handlePrediction = (userPrediction: string) => {
    if (!canPredict) return
    setPrediction(userPrediction)
    setCanPredict(false)
    setTimer(3)

    setTimeout(() => {
      setShowFullGraph(true)
      setStockData(fullStockData)
      setShowNextButton(true)
    }, 500)
  }

  const handleNextStock = () => {
    setShowNextButton(false)
    setShowFullGraph(false)
    setPredictionResult(null)
    fetchRandomStockData()
  }

  useEffect(() => {
    fetchRandomStockData()
  }, [])

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer(t => t - 1)
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setCanPredict(true)
    }
  }, [timer])

  useEffect(() => {
    if (prediction !== null && stockData.length > 0) {
      const lastPrice = stockData[stockData.length - 1].price
      const previousPrice = stockData[stockData.length - 2]?.price || lastPrice
      const percentageChange = ((lastPrice - previousPrice) / previousPrice) * 100
      const points = Math.ceil(Math.abs(percentageChange) * 10)

      const isCorrect = (prediction === 'up' && lastPrice > previousPrice) || 
                       (prediction === 'down' && lastPrice < previousPrice);

      setPredictionResult(isCorrect ? 'correct' : 'wrong');

      if (isCorrect) {
        setScore(prevScore => prevScore + points)
        setStreak(prevStreak => prevStreak + 1)
        setFeedback(`Correct! +${points} points (${percentageChange.toFixed(2)}% change)`)
      } else {
        setScore(prevScore => prevScore - points)
        setStreak(0)
        setFeedback(`Wrong! -${points} points (${percentageChange.toFixed(2)}% change)`)
      }
      setPrediction(null)
    }
  }, [stockData, prediction])

  const calculateMACD = (prices: number[]): MacdResult[] => {
    const ema12Array = calculateEMAArray(prices, 12);
    const ema26Array = calculateEMAArray(prices, 26);
    
    const macdLine = ema12Array.map((ema12, i) => 
      ema12 !== null && ema26Array[i] !== null ? ema12 - ema26Array[i] : null
    );
    
    const signalLine = calculateEMAArray(macdLine.filter(v => v !== null) as number[], 9);
    const paddedSignalLine = [...Array(macdLine.length - signalLine.length).fill(null), ...signalLine];
    
    return macdLine.map((macd, i) => ({
      value: macd,
      signal: paddedSignalLine[i],
      histogram: macd !== null && paddedSignalLine[i] !== null ? macd - paddedSignalLine[i] : null
    }));
  };

  const calculateEMAArray = (prices: number[], period: number) => {
    if (prices.length < period) return Array(prices.length).fill(null);
    
    const multiplier = 2 / (period + 1);
    const emaArray: (number | null)[] = [];
    
    // Fill initial values with null until we have enough data
    for (let i = 0; i < period - 1; i++) {
      emaArray.push(null);
    }
    
    // Calculate first SMA
    const firstSMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    emaArray.push(firstSMA);
    let ema = firstSMA;
    
    // Calculate EMA for remaining prices
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
      emaArray.push(ema);
    }
    
    return emaArray;
  };

  const calculateBollingerBands = (prices: number[], period = 20): BollingerResult[] => {
    if (prices.length === 0) return [];
    
    return prices.map((_, index) => {
      const slice = prices.slice(Math.max(0, index - period + 1), index + 1);
      if (slice.length < period) return { upper: null, middle: null, lower: null };
      
      const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
      const squaredDiffs = slice.map(p => Math.pow(p - sma, 2));
      const standardDeviation = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / slice.length);
      
      return {
        upper: sma + (standardDeviation * 2),
        middle: sma,
        lower: sma - (standardDeviation * 2)
      };
    });
  };

  const getTradeRecommendation = (data: StockDataPoint[]): StockAnalysis['keyPoints'] => {
    if (data.length === 0) return {
      support: 0,
      resistance: 0,
      volume: "No Data",
      momentum: "Neutral",
      recommendation: "Insufficient data",
      macd: { value: null, signal: null, histogram: null },
      bollinger: { upper: null, middle: null, lower: null }
    };
    
    const prices = data.map(d => d.price);
    const lastPrice = prices[prices.length - 1];
    
    const support = Math.min(...prices.slice(-10));
    const resistance = Math.max(...prices.slice(-10));
    
    const sma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / Math.min(prices.length, 5);
    const sma10 = prices.slice(-10).reduce((a, b) => a + b, 0) / Math.min(prices.length, 10);
    
    const macdResults = calculateMACD(prices);
    const bollingerResults = calculateBollingerBands(prices);
    
    // Get the latest values
    const latestMacd = macdResults[macdResults.length - 1] || { value: null, signal: null, histogram: null };
    const latestBollinger = bollingerResults[bollingerResults.length - 1] || { upper: null, middle: null, lower: null };

    // RSI calculation
    const gains = prices.slice(-14).map((price, i, arr) => 
      i > 0 ? Math.max(price - arr[i-1], 0) : 0
    );
    const losses = prices.slice(-14).map((price, i, arr) => 
      i > 0 ? Math.max(arr[i-1] - price, 0) : 0
    );
    const avgGain = gains.reduce((a, b) => a + b) / 14;
    const avgLoss = losses.reduce((a, b) => a + b) / 14;
    const rsi = 100 - (100 / (1 + avgGain / avgLoss));

    let momentum = "Neutral";
    if (rsi > 70) momentum = "Overbought";
    else if (rsi < 30) momentum = "Oversold";
    
    // Enhanced recommendation logic
    let recommendation = "";
    const signals = [];

    // Collect all signals
    if (latestBollinger.lower !== null && lastPrice < latestBollinger.lower) {
      signals.push("Price below lower Bollinger Band (Oversold)");
    }
    if (latestBollinger.upper !== null && lastPrice > latestBollinger.upper) {
      signals.push("Price above upper Bollinger Band (Overbought)");
    }
    if (latestMacd.histogram && latestMacd.histogram > 0) signals.push("Positive MACD (Bullish)");
    if (latestMacd.histogram && latestMacd.histogram < 0) signals.push("Negative MACD (Bearish)");
    if (sma5 > sma10) signals.push("Short-term MA above long-term MA (Bullish)");
    if (sma5 < sma10) signals.push("Short-term MA below long-term MA (Bearish)");
    if (rsi < 30) signals.push("RSI shows oversold conditions");
    if (rsi > 70) signals.push("RSI shows overbought conditions");
    
    // Generate recommendation based on combined signals
    const bullishSignals = signals.filter(s => s.includes("Bullish") || s.includes("Oversold")).length;
    const bearishSignals = signals.filter(s => s.includes("Bearish") || s.includes("Overbought")).length;
    
    if (bullishSignals > bearishSignals) {
      recommendation = `Strong Buy Signal: ${signals.slice(0, 3).join(", ")}`;
    } else if (bearishSignals > bullishSignals) {
      recommendation = `Consider Selling: ${signals.slice(0, 3).join(", ")}`;
    } else {
      recommendation = `Market Mixed: Watch for ${signals.slice(0, 2).join(" and ")}`;
    }

    return {
      support,
      resistance,
      volume: "Average",
      momentum,
      recommendation,
      macd: latestMacd,
      bollinger: latestBollinger
    };
  };

  const analyzeStockMovement = (data: StockDataPoint[]) => {
    if (data.length < 10) return;

    const prices = data.map(d => d.price);
    const lastPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    
    const sma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / Math.min(prices.length, 5);
    const sma10 = prices.slice(-10).reduce((a, b) => a + b, 0) / Math.min(prices.length, 10);
    const momentum = ((lastPrice - prices[0]) / prices[0]) * 100;
    
    const technicalIndicators = [];
    if (sma5 > sma10) technicalIndicators.push("🟢 Short-term moving average above long-term → Bullish signal");
    if (sma5 < sma10) technicalIndicators.push("🔴 Short-term moving average below long-term → Bearish signal");
    if (momentum > 1) technicalIndicators.push(`📈 Strong upward momentum (${momentum.toFixed(2)}%)`);
    if (momentum < -1) technicalIndicators.push(`📉 Strong downward momentum (${momentum.toFixed(2)}%)`);

    const keyPoints = getTradeRecommendation(data);
    let trend = lastPrice > prevPrice ? "Upward" : "Downward";
    
    const reason = keyPoints ? `Current price ($${lastPrice.toFixed(2)}) is ${
      lastPrice > keyPoints.support ? 'above' : 'below'
    } support ($${keyPoints.support.toFixed(2)}) and ${
      lastPrice > keyPoints.resistance ? 'above' : 'below'
    } resistance ($${keyPoints.resistance.toFixed(2)}).` : '';

    setAnalysis({
      trend,
      reason,
      technicalIndicators,
      keyPoints
    });
  };

  const chartData: ChartDataType = {
    labels: stockData.map(data => {
      const date = new Date(data.time);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }),
    datasets: [
      {
        label: `Price of ${symbol}`,
        data: stockData.map(data => data.price),
        type: 'line',
        borderColor: showFullGraph 
          ? (predictionResult === 'correct' ? 'rgba(0, 128, 255, 1)' : 'rgba(255, 99, 132, 1)')
          : 'rgba(75, 192, 192, 1)',
        backgroundColor: showFullGraph
          ? (predictionResult === 'correct' ? 'rgba(0, 128, 255, 0.2)' : 'rgba(255, 99, 132, 0.2)')
          : 'rgba(75, 192, 192, 0.2)',
        fill: true,
        yAxisID: 'y',
        pointRadius: stockData.map(data => data.isNewTrend ? 8 : 3),
        pointBackgroundColor: stockData.map(data => 
          data.isNewTrend ? '#ff6b6b' : (
            showFullGraph 
              ? (predictionResult === 'correct' ? 'rgba(0, 128, 255, 1)' : 'rgba(255, 99, 132, 1)')
              : 'rgba(75, 192, 192, 1)'
          )
        ),
        pointBorderColor: stockData.map(data => 
          data.isNewTrend ? '#ff6b6b' : (
            showFullGraph 
              ? (predictionResult === 'correct' ? 'rgba(0, 128, 255, 1)' : 'rgba(255, 99, 132, 1)')
              : 'rgba(75, 192, 192, 1)'
          )
        ),
        segment: {
          borderColor: (_ctx: any) => {
            if (!showFullGraph) return 'rgba(75, 192, 192, 1)';
            return predictionResult === 'correct' ? 'rgba(0, 128, 255, 1)' : 'rgba(255, 99, 132, 1)';
          },
          backgroundColor: (_ctx: any) => {
            if (!showFullGraph) return 'rgba(75, 192, 192, 0.2)';
            return predictionResult === 'correct' ? 'rgba(0, 128, 255, 0.2)' : 'rgba(255, 99, 132, 0.2)';
          }
        }
      },
      {
        label: 'Upper Bollinger Band',
        data: bollingerBands.upper.slice(0, stockData.length),
        borderColor: 'rgba(169, 169, 169, 0.6)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        yAxisID: 'y',
      },
      {
        label: 'Lower Bollinger Band',
        data: bollingerBands.lower.slice(0, stockData.length),
        borderColor: 'rgba(169, 169, 169, 0.6)',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        yAxisID: 'y',
      },
      {
        label: 'MACD',
        data: macdData.values.slice(0, stockData.length),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'transparent',
        fill: false,
        pointRadius: 0,
        yAxisID: 'y1',
      },
      {
        label: 'Signal Line',
        data: macdData.signals.slice(0, stockData.length),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'transparent',
        fill: false,
        pointRadius: 0,
        yAxisID: 'y1',
      },
      {
        label: 'MACD Histogram',
        data: macdData.histogram.slice(0, stockData.length),
        type: 'bar',
        borderColor: 'transparent',
        fill: true,
        backgroundColor: macdData.histogram.map(h => 
          (h || 0) > 0 ? 'rgba(75, 192, 192, 0.5)' : 'rgba(255, 99, 132, 0.5)'
        ).slice(0, stockData.length),
        yAxisID: 'y1',
      }
    ],
  }

  const chartOptions: {
    plugins: any;
    scales: any;
    animation: any;
    transitions: any;
    maintainAspectRatio: boolean;
    responsive: boolean;
  } = {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const dataPoint = stockData[context.dataIndex];
            let label = `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
            if (dataPoint?.isNewTrend) {
              label += ' (Prediction Point)';
            }
            return label;
          }
        }
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          padding: 20,
          font: {
            size: 14
          }
        }
      },
      annotation: {
        annotations: {
          predictionLine: {
            type: 'line',
            xMin: stockData.length / 2,
            xMax: stockData.length / 2,
            borderColor: 'rgba(255, 99, 132, 0.8)',
            borderWidth: 2,
            borderDash: [5, 5],
            display: showFullGraph,
            label: {
              display: showFullGraph,
              content: 'Prediction Time',
              position: 'top'
            }
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Price ($)'
        },
        ticks: {
          callback: (value: number) => `$${value.toFixed(2)}`,
          font: {
            size: 12
          }
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'MACD'
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: {
            size: 12
          }
        }
      },
      x: {
        ticks: {
          font: {
            size: 12
          },
          maxRotation: 45,
          minRotation: 45,
          callback: (_value: any, index: number) => {
            const date = new Date(stockData[index].time);
            return date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            });
          }
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart'
    },
    transitions: {
      show: {
        animations: {
          x: { from: 0 },
          y: { from: 0 }
        }
      }
    },
    maintainAspectRatio: false,
    responsive: true,
  }

  return (
    <div className="App">
      <h1>Stock Prediction Challenge</h1>
      <h2>Current Stock: {symbol}</h2>
      <div className="stats">
        <h3>Score: {score}</h3>
        <h3>Streak: {streak}🔥</h3>
      </div>
      {feedback && <div className={`feedback ${feedback.includes('Correct') ? 'correct' : 'wrong'}`}>
        {feedback}
      </div>}
      {analysis && (
        <div className="analysis-container">
          <h3>Market Analysis</h3>
          <div className="analysis-grid">
            <div className="analysis-section">
              <h4>Current Trend</h4>
              <p className={`trend ${analysis.trend.toLowerCase()}`}>
                {analysis.trend}
              </p>
              <p className="reason">{analysis.reason}</p>
            </div>
            
            <div className="analysis-section">
              <h4>Key Levels</h4>
              <ul>
                <li>Support: ${analysis.keyPoints.support.toFixed(2)}</li>
                <li>Resistance: ${analysis.keyPoints.resistance.toFixed(2)}</li>
                <li>Momentum: {analysis.keyPoints.momentum}</li>
              </ul>
            </div>

            <div className="analysis-section">
              <h4>Technical Indicators</h4>
              <ul>
                {analysis.technicalIndicators.map((indicator, index) => (
                  <li key={index}>{indicator}</li>
                ))}
              </ul>
            </div>

            <div className="analysis-section recommendation">
              <h4>Trading Recommendation</h4>
              <p>{analysis.keyPoints.recommendation}</p>
            </div>
          </div>
        </div>
      )}
      <div>
        <h2>Will the stock price go up or down?</h2>
        {timer > 0 ? (
          <div className="timer">Next prediction in: {timer}s</div>
        ) : (
          <div className="buttons">
            {!showNextButton ? (
              <>
                <button 
                  onClick={() => handlePrediction('up')} 
                  disabled={!canPredict}
                  className="up-button"
                >
                  ⬆️ Up
                </button>
                <button 
                  onClick={() => handlePrediction('down')} 
                  disabled={!canPredict}
                  className="down-button"
                >
                  ⬇️ Down
                </button>
              </>
            ) : (
              <button 
                onClick={handleNextStock}
                className="next-button"
              >
                Next Stock ➡️
              </button>
            )}
          </div>
        )}
      </div>
      <div className={`chart-container ${showFullGraph ? 'reveal' : ''}`}>
        <Line 
          data={chartData as any} 
          options={chartOptions}
          key={`${symbol}-${showFullGraph}`}
        />
      </div>
    </div>
  )
}

export default App
