import { ref, onUnmounted, reactive } from 'vue'

interface UsageData {
  tokensUsed: number
  requestCount: number
  activeSessions: number
  responseTime: number
  timestamp: number
}

interface UsagePlanInfo {
  plan: string
  tokensUsed: number
  tokenLimit: number
  billingPeriodStart: string
  billingPeriodEnd: string
}

interface WebSocketMessage {
  type: 'usage_update' | 'plan_info' | 'error' | 'connection_status'
  data: any
  timestamp: number
}

export function useUsageWebSocket(url: string) {
  const ws = ref<WebSocket | null>(null)
  const isConnected = ref(false)
  const error = ref<string | null>(null)
  const loading = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = ref(1000) // Start with 1 second
  
  // Usage data state
  const usageData = ref<UsageData | null>(null)
  const planInfo = ref<UsagePlanInfo | null>(null)
  
  // Connection statistics
  const connectionStats = reactive({
    connectedAt: null as Date | null,
    disconnectedAt: null as Date | null,
    messagesReceived: 0,
    lastMessageAt: null as Date | null,
    reconnectCount: 0
  })

  const connect = () => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    loading.value = true
    error.value = null

    try {
      ws.value = new WebSocket(url)
      
      ws.value.onopen = () => {
        console.log('Usage WebSocket connected')
        isConnected.value = true
        loading.value = false
        error.value = null
        reconnectAttempts.value = 0
        reconnectDelay.value = 1000 // Reset delay
        
        connectionStats.connectedAt = new Date()
        connectionStats.disconnectedAt = null
        
        // Send initial connection message
        sendMessage({
          type: 'connection_status',
          data: { status: 'connected', clientId: generateClientId() },
          timestamp: Date.now()
        })
      }

      ws.value.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          handleMessage(message)
          
          connectionStats.messagesReceived++
          connectionStats.lastMessageAt = new Date()
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
          error.value = 'Failed to parse server message'
        }
      }

      ws.value.onclose = (event) => {
        console.log('Usage WebSocket disconnected:', event.code, event.reason)
        isConnected.value = false
        loading.value = false
        connectionStats.disconnectedAt = new Date()
        
        if (event.code !== 1000) { // Not a normal closure
          error.value = `Connection closed: ${event.reason || 'Unknown reason'}`
          attemptReconnect()
        }
      }

      ws.value.onerror = (event) => {
        console.error('Usage WebSocket error:', event)
        error.value = 'WebSocket connection error'
        loading.value = false
        isConnected.value = false
      }

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err)
      error.value = 'Failed to establish connection'
      loading.value = false
    }
  }

  const disconnect = () => {
    if (ws.value) {
      ws.value.close(1000, 'Client disconnect')
      ws.value = null
    }
    isConnected.value = false
    loading.value = false
  }

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected, cannot send message')
    }
  }

  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'usage_update':
        usageData.value = message.data
        break
        
      case 'plan_info':
        planInfo.value = message.data
        break
        
      case 'error':
        error.value = message.data.message || 'Server error'
        break
        
      case 'connection_status':
        // Handle server connection status updates
        if (message.data.status === 'acknowledged') {
          console.log('Connection acknowledged by server')
        }
        break
        
      default:
        console.warn('Unknown message type:', message.type)
    }
  }

  const attemptReconnect = () => {
    if (reconnectAttempts.value >= maxReconnectAttempts) {
      error.value = `Failed to reconnect after ${maxReconnectAttempts} attempts`
      return
    }

    reconnectAttempts.value++
    connectionStats.reconnectCount++
    
    console.log(`Attempting to reconnect (${reconnectAttempts.value}/${maxReconnectAttempts})`)
    
    setTimeout(() => {
      connect()
      reconnectDelay.value = Math.min(reconnectDelay.value * 2, 30000) // Exponential backoff, max 30s
    }, reconnectDelay.value)
  }

  const reconnect = () => {
    disconnect()
    reconnectAttempts.value = 0
    reconnectDelay.value = 1000
    connect()
  }

  const generateClientId = (): string => {
    return 'usage-client-' + Math.random().toString(36).substr(2, 9)
  }

  // Request specific data
  const requestUsageUpdate = () => {
    sendMessage({
      type: 'usage_update',
      data: { request: 'current_usage' },
      timestamp: Date.now()
    })
  }

  const requestPlanInfo = () => {
    sendMessage({
      type: 'plan_info', 
      data: { request: 'plan_details' },
      timestamp: Date.now()
    })
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
  })

  // Auto-connect on creation
  connect()

  return {
    // Connection state
    isConnected,
    error,
    loading,
    connectionStats,
    
    // Data
    usageData,
    planInfo,
    
    // Methods
    connect,
    disconnect,
    reconnect,
    sendMessage,
    requestUsageUpdate,
    requestPlanInfo
  }
}