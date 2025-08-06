import { ref, computed, reactive, onUnmounted, readonly } from 'vue'

export interface UsageStats {
  tokensUsed: number
  tokenLimit: number  
  tokensPercentage: number
  messagesUsed: number
  messageLimit: number
  messagesPercentage: number
  costUsed: number
  costLimit: number
  costPercentage: number
  resetDate: Date
  daysRemaining: number
}

export interface UsageSnapshot {
  id: string
  sessionId: string
  timestamp: number
  stats: UsageStats
}

export interface RealTimeMetrics {
  requestsPerMinute: number
  averageResponseTime: number
  activeSessions: number
  errorRate: number
  uptime: string
}

export interface PlanInfo {
  planName: string
  planType: 'pro' | 'max5' | 'max20' | 'custom'
  tokenLimit: number
  messageLimit: number
  costLimit: number
  billingCycle: 'monthly' | 'daily' | 'weekly'
  resetTime: string
}

interface UsageDataState {
  currentStats: UsageStats | null
  historicalData: UsageSnapshot[]
  realTimeMetrics: RealTimeMetrics | null
  planInfo: PlanInfo | null
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useUsageData() {
  // Reactive state
  const state = reactive<UsageDataState>({
    currentStats: null,
    historicalData: [],
    realTimeMetrics: null,
    planInfo: null,
    isLoading: false,
    error: null,
    lastUpdated: null
  })

  // Connection state
  const isConnected = ref(false)
  const connectionError = ref<string | null>(null)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5

  // WebSocket connection
  let ws: WebSocket | null = null
  let reconnectTimeout: NodeJS.Timeout | null = null
  let heartbeatInterval: NodeJS.Timeout | null = null

  // Computed properties
  const hasValidData = computed(() => {
    return state.currentStats !== null && !state.isLoading
  })

  const overallUsageStatus = computed(() => {
    if (!state.currentStats) return 'unknown'
    
    const maxPercentage = Math.max(
      state.currentStats.tokensPercentage,
      state.currentStats.messagesPercentage,
      state.currentStats.costPercentage
    )

    if (maxPercentage > 90) return 'critical'
    if (maxPercentage > 80) return 'warning'
    if (maxPercentage > 60) return 'caution'
    return 'safe'
  })

  const formattedLastUpdated = computed(() => {
    if (!state.lastUpdated) return 'Never'
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(state.lastUpdated)
  })

  // WebSocket connection management
  const connect = (url: string = 'ws://localhost:4000/stream') => {
    if (ws?.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    state.isLoading = true
    connectionError.value = null

    try {
      ws = new WebSocket(url)

      ws.onopen = () => {
        console.log('Usage WebSocket connected')
        isConnected.value = true
        state.isLoading = false
        connectionError.value = null
        reconnectAttempts.value = 0

        // Start heartbeat
        startHeartbeat()

        // Request initial data
        requestUsageUpdate()
        requestPlanInfo()
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleMessage(message)
          state.lastUpdated = new Date()
        } catch (err) {
          console.error('Failed to parse usage WebSocket message:', err)
          state.error = 'Failed to parse server message'
        }
      }

      ws.onclose = (event) => {
        console.log('Usage WebSocket disconnected:', event.code, event.reason)
        isConnected.value = false
        state.isLoading = false
        stopHeartbeat()

        if (event.code !== 1000) { // Not a normal closure
          connectionError.value = `Connection closed: ${event.reason || 'Unknown reason'}`
          attemptReconnect()
        }
      }

      ws.onerror = (event) => {
        console.error('Usage WebSocket error:', event)
        connectionError.value = 'WebSocket connection error'
        state.isLoading = false
        isConnected.value = false
      }

    } catch (err) {
      console.error('Failed to create usage WebSocket connection:', err)
      connectionError.value = 'Failed to establish connection'
      state.isLoading = false
    }
  }

  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }

    stopHeartbeat()

    if (ws) {
      ws.close(1000, 'Client disconnect')
      ws = null
    }

    isConnected.value = false
    state.isLoading = false
  }

  const attemptReconnect = () => {
    if (reconnectAttempts.value >= maxReconnectAttempts) {
      connectionError.value = `Failed to reconnect after ${maxReconnectAttempts} attempts`
      return
    }

    reconnectAttempts.value++
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 30000) // Exponential backoff, max 30s

    console.log(`Attempting to reconnect (${reconnectAttempts.value}/${maxReconnectAttempts}) in ${delay}ms`)

    reconnectTimeout = setTimeout(() => {
      connect()
    }, delay)
  }

  const startHeartbeat = () => {
    heartbeatInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        sendMessage({
          type: 'ping',
          timestamp: Date.now()
        })
      }
    }, 30000) // Ping every 30 seconds
  }

  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  // Message handling
  const sendMessage = (message: any) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected, cannot send message')
    }
  }

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'usage_stats':
      case 'usage_update':
        updateUsageStats(message.data)
        break

      case 'usage_snapshot':
        addHistoricalSnapshot(message.data)
        break

      case 'real_time_metrics':
        updateRealTimeMetrics(message.data)
        break

      case 'plan_info':
        updatePlanInfo(message.data)
        break

      case 'initial':
        // Handle initial data from server
        if (message.data.usage) {
          updateUsageStats(message.data.usage)
        }
        break

      case 'error':
        state.error = message.data.message || 'Server error'
        break

      case 'pong':
        // Heartbeat response, connection is alive
        break

      default:
        console.warn('Unknown usage message type:', message.type)
    }
  }

  // Data update methods
  const updateUsageStats = (data: any) => {
    // Handle bridge service format with structured data
    if (data.totals && (data.current_session || data.recent_sessions)) {
      const currentSession = data.current_session;
      const totals = data.totals;
      const burnRate = data.burn_rate || {};
      
      // Use CURRENT SESSION only (like Claude Monitor CLI)
      const tokenCounts = currentSession?.token_counts || {}
      const currentTokens = (tokenCounts.input_tokens || 0) + (tokenCounts.output_tokens || 0)
      const currentCost = currentSession?.cost_usd || 0
      const currentMessages = currentSession?.sent_messages_count || 0
      
      // Set reasonable limits and calculate percentages
      const tokenLimit = 200000
      const costLimit = 25.00
      const messageLimit = 1500
      
      const tokensPercentage = Math.min(100, (currentTokens / tokenLimit) * 100)
      const costPercentage = Math.min(100, (currentCost / costLimit) * 100)
      const messagesPercentage = Math.min(100, (currentMessages / messageLimit) * 100)
      
      state.currentStats = {
        tokensUsed: currentTokens,
        tokenLimit: tokenLimit,
        tokensPercentage: tokensPercentage,
        messagesUsed: currentMessages,
        messageLimit: messageLimit,
        messagesPercentage: messagesPercentage,
        costUsed: currentCost,
        costLimit: costLimit,
        costPercentage: costPercentage,
        resetDate: data.predictions?.limit_resets_at ? new Date(data.predictions.limit_resets_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        daysRemaining: 30
      }
      
      // Update real-time metrics from current session and burn rate
      if (currentSession || burnRate.tokens_per_minute) {
        state.realTimeMetrics = {
          requestsPerMinute: burnRate.tokens_per_minute ? Math.round(burnRate.tokens_per_minute / 100) : 0, // Rough estimate
          averageResponseTime: 850, // Estimate based on typical Claude response times
          activeSessions: currentSession?.is_active ? 1 : 0,
          errorRate: 0.1, // Low error rate estimate
          uptime: '99.9%' // High uptime estimate
        }
      }
    } else {
      // Handle simple format (legacy or direct format)
      state.currentStats = {
        tokensUsed: data.tokensUsed || 0,
        tokenLimit: data.tokenLimit || 200000,
        tokensPercentage: data.tokensPercentage || 0,
        messagesUsed: data.messagesUsed || 0,
        messageLimit: data.messageLimit || 1500,
        messagesPercentage: data.messagesPercentage || 0,
        costUsed: data.costUsed || 0,
        costLimit: data.costLimit || 25.00,
        costPercentage: data.costPercentage || 0,
        resetDate: new Date(data.resetDate || Date.now() + 30 * 24 * 60 * 60 * 1000),
        daysRemaining: data.daysRemaining || 30
      }
    }
    state.error = null
  }

  const addHistoricalSnapshot = (data: any) => {
    const snapshot: UsageSnapshot = {
      id: data.id || `snapshot-${Date.now()}`,
      sessionId: data.sessionId || 'unknown',
      timestamp: data.timestamp || Date.now(),
      stats: data.stats
    }

    state.historicalData.push(snapshot)

    // Keep only the last 100 snapshots
    if (state.historicalData.length > 100) {
      state.historicalData = state.historicalData.slice(-100)
    }
  }

  const updateRealTimeMetrics = (data: any) => {
    state.realTimeMetrics = {
      requestsPerMinute: data.requestsPerMinute || 0,
      averageResponseTime: data.averageResponseTime || 0,
      activeSessions: data.activeSessions || 0,
      errorRate: data.errorRate || 0,
      uptime: data.uptime || '0%'
    }
  }

  const updatePlanInfo = (data: any) => {
    state.planInfo = {
      planName: data.planName || 'Unknown Plan',
      planType: data.planType || 'custom',
      tokenLimit: data.tokenLimit || 200000,
      messageLimit: data.messageLimit || 1500,
      costLimit: data.costLimit || 25.00,
      billingCycle: data.billingCycle || 'monthly',
      resetTime: data.resetTime || '00:00'
    }
  }

  // Request methods
  const requestUsageUpdate = () => {
    sendMessage({
      type: 'request_usage_stats',
      timestamp: Date.now()
    })
  }

  const requestPlanInfo = () => {
    sendMessage({
      type: 'request_plan_info',
      timestamp: Date.now()
    })
  }

  const requestHistoricalData = (sessionId?: string, hours: number = 24) => {
    sendMessage({
      type: 'request_historical',
      data: {
        sessionId,
        hours
      },
      timestamp: Date.now()
    })
  }

  // Utility methods
  const refreshData = () => {
    requestUsageUpdate()
    requestPlanInfo()
  }

  const clearHistoricalData = () => {
    state.historicalData = []
  }

  const clearError = () => {
    state.error = null
    connectionError.value = null
  }

  // Cleanup
  onUnmounted(() => {
    disconnect()
  })

  // Auto-connect on creation
  connect()

  return {
    // State
    state: readonly(state),
    isConnected: readonly(isConnected),
    connectionError: readonly(connectionError),
    reconnectAttempts: readonly(reconnectAttempts),

    // Computed
    hasValidData,
    overallUsageStatus,
    formattedLastUpdated,

    // Methods
    connect,
    disconnect,
    refreshData,
    requestUsageUpdate,
    requestPlanInfo,
    requestHistoricalData,
    clearHistoricalData,
    clearError,

    // Individual data accessors for convenience
    currentStats: computed(() => state.currentStats),
    historicalData: computed(() => state.historicalData),
    realTimeMetrics: computed(() => state.realTimeMetrics),
    planInfo: computed(() => state.planInfo),
    isLoading: computed(() => state.isLoading),
    error: computed(() => state.error),
    lastUpdated: computed(() => state.lastUpdated)
  }
}