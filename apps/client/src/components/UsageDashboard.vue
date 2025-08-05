<template>
  <div class="space-y-6 p-4">
    <!-- Header with Connection Status -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-[var(--theme-text-primary)]">Usage Monitor</h2>
      <div class="flex items-center space-x-2">
        <div :class="[
          'h-2 w-2 rounded-full transition-colors duration-200',
          isConnected ? 'bg-green-500' : 'bg-red-500'
        ]"></div>
        <span class="text-sm text-[var(--theme-text-secondary)]">
          {{ isConnected ? 'Connected' : 'Disconnected' }}
        </span>
        <span class="text-lg">📡</span>
      </div>
    </div>

    <!-- Real-time Usage Metrics Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="metric in usageMetrics" :key="metric.id" 
           class="bg-[var(--theme-bg-primary)] border border-[var(--theme-primary)]/20 rounded-lg p-4 shadow-md hover:shadow-lg transition-all duration-200">
        <!-- Metric Header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center space-x-2">
            <span :class="[
              'text-lg',
              metric.icon
            ]">{{ metric.emoji }}</span>
            <h3 class="text-sm font-medium text-[var(--theme-text-primary)]">{{ metric.label }}</h3>
          </div>
          <div :class="[
            'flex items-center space-x-1 text-xs px-2 py-1 rounded',
            getTrendClasses(metric.trend)
          ]">
            <span>{{ getTrendIcon(metric.trend) }}</span>
            <span>{{ metric.trend }}</span>
          </div>
        </div>

        <!-- Metric Value -->
        <div class="mb-3">
          <span class="text-2xl font-bold text-[var(--theme-text-primary)]">
            {{ formatMetricValue(metric.value) }}
          </span>
          <span class="text-sm text-[var(--theme-text-secondary)] ml-1">{{ metric.unit }}</span>
        </div>

        <!-- Progress Bar -->
        <div class="w-full bg-[var(--theme-bg-secondary)] rounded-full h-2 mb-2">
          <div 
            :class="[
              'h-2 rounded-fill transition-all duration-300',
              getProgressColor(metric.percentage)
            ]"
            :style="{ width: `${Math.min(100, metric.percentage)}%` }"
          ></div>
        </div>

        <!-- Additional Info -->
        <div class="text-xs text-[var(--theme-text-secondary)] flex justify-between">
          <span>{{ metric.subtitle }}</span>
          <span>{{ metric.percentage.toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <!-- Summary Statistics -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-[var(--theme-bg-primary)] border border-[var(--theme-primary)]/20 rounded-lg p-6 shadow-md">
        <div class="flex items-center space-x-3 mb-2">
          <span class="text-2xl">👥</span>
          <h3 class="text-sm font-medium text-[var(--theme-text-primary)]">Active Sessions</h3>
        </div>
        <div class="text-3xl font-bold text-[var(--theme-text-primary)] mb-1">
          {{ summaryStats.activeSessions.toLocaleString() }}
        </div>
        <p class="text-sm text-[var(--theme-text-secondary)]">Currently active</p>
      </div>

      <div class="bg-[var(--theme-bg-primary)] border border-[var(--theme-primary)]/20 rounded-lg p-6 shadow-md">
        <div class="flex items-center space-x-3 mb-2">
          <span class="text-2xl">📊</span>
          <h3 class="text-sm font-medium text-[var(--theme-text-primary)]">Total Requests</h3>
        </div>
        <div class="text-3xl font-bold text-[var(--theme-text-primary)] mb-1">
          {{ summaryStats.totalRequests.toLocaleString() }}
        </div>
        <p class="text-sm text-[var(--theme-text-secondary)]">Today</p>
      </div>

      <div class="bg-[var(--theme-bg-primary)] border border-[var(--theme-primary)]/20 rounded-lg p-6 shadow-md">
        <div class="flex items-center space-x-3 mb-2">
          <span class="text-2xl">⏱️</span>
          <h3 class="text-sm font-medium text-[var(--theme-text-primary)]">Uptime</h3>
        </div>
        <div class="text-3xl font-bold text-[var(--theme-text-primary)] mb-1">
          {{ summaryStats.uptime }}
        </div>
        <p class="text-sm text-[var(--theme-text-secondary)]">Last 30 days</p>
      </div>
    </div>

    <!-- Usage Progress Bars -->
    <div class="bg-[var(--theme-bg-primary)] border border-[var(--theme-primary)]/20 rounded-lg shadow-md">
      <UsageProgressBars 
        :cost-usage="costUsageData"
        :token-usage="tokenUsageData"
        :messages-usage="messagesUsageData"
        :time-to-reset="timeToResetData"
        :reset-date="resetDateData"
      />
    </div>

    <!-- Error State -->
    <div v-if="error" 
         class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
      <div class="flex items-center space-x-2 mb-2">
        <span class="text-lg">⚠️</span>
        <span class="font-medium">Connection Error</span>
      </div>
      <p class="text-sm">{{ error }}</p>
      <button 
        @click="handleReconnect"
        class="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm font-medium transition-colors"
      >
        Retry Connection
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" 
         class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800">
      <div class="flex items-center space-x-2">
        <div class="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
        <span class="text-sm">Loading usage data...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useUsageWebSocket } from '../composables/useUsageWebSocket'
import { useUsageData } from '../composables/useUsageData'
import { useUsageConfig } from '../composables/useUsageConfig'
import UsageProgressBars from './UsageProgressBars.vue'

interface UsageMetric {
  id: string
  label: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  percentage: number
  emoji: string
  subtitle: string
}

interface SummaryStats {
  activeSessions: number
  totalRequests: number
  uptime: string
}

interface PlanInfo {
  planName: string
  tokensUsed: number
  tokenLimit: number
  tokenUsagePercentage: number
  daysRemaining: number
  billingProgress: number
  resetDate: string
}

// Composables for usage data and configuration
const usageDataComposable = useUsageData()
const usageConfig = useUsageConfig()

// Legacy WebSocket composable for compatibility
const { 
  usageData: legacyUsageData, 
  isConnected: legacyIsConnected, 
  error: legacyError, 
  loading: legacyLoading, 
  reconnect: legacyReconnect 
} = useUsageWebSocket('ws://localhost:4000/usage/stream')

// Use new composable data where available, fallback to legacy
const isConnected = computed(() => usageDataComposable.isConnected.value || legacyIsConnected.value)
const error = computed(() => usageDataComposable.error.value || legacyError.value)
const loading = computed(() => usageDataComposable.isLoading.value || legacyLoading.value)

// Reactive data
const usageMetrics = ref<UsageMetric[]>([
  {
    id: 'tokens',
    label: 'Token Usage',
    value: 15420,
    unit: 'tokens',
    trend: 'up',
    percentage: 65,
    emoji: '🔤',
    subtitle: 'This hour'
  },
  {
    id: 'requests',
    label: 'API Requests',
    value: 1247,
    unit: 'req/min',
    trend: 'stable',
    percentage: 42,
    emoji: '📡',
    subtitle: 'Current rate'
  },
  {
    id: 'sessions',
    label: 'Active Sessions',
    value: 23,
    unit: 'sessions',
    trend: 'down',
    percentage: 23,
    emoji: '👥',
    subtitle: 'Right now'
  },
  {
    id: 'response_time',
    label: 'Response Time',
    value: 145,
    unit: 'ms',
    trend: 'stable',
    percentage: 14,
    emoji: '⚡',
    subtitle: 'Average'
  }
])

const summaryStats = ref<SummaryStats>({
  activeSessions: 23,
  totalRequests: 45632,
  uptime: '99.9%'
})

const planInfo = ref<PlanInfo>({
  planName: 'Pro Plan',
  tokensUsed: 65420,
  tokenLimit: 200000,
  tokenUsagePercentage: 32.7,
  daysRemaining: 18,
  billingProgress: 40,
  resetDate: 'Dec 1, 2024'
})

// Computed data for progress bars using new composables
const costUsageData = computed(() => {
  const currentStats = usageDataComposable.currentStats.value
  const currentPlan = usageConfig.currentPlan.value
  
  if (currentStats) {
    return {
      current: currentStats.costUsed,
      limit: currentStats.costLimit,
      percentage: currentStats.costPercentage
    }
  }
  
  // Fallback to demo data
  return {
    current: 15.75,
    limit: currentPlan.cost,
    percentage: 63.0
  }
})

const tokenUsageData = computed(() => {
  const currentStats = usageDataComposable.currentStats.value
  const currentPlan = usageConfig.currentPlan.value
  
  if (currentStats) {
    return {
      current: currentStats.tokensUsed,
      limit: currentStats.tokenLimit,
      percentage: currentStats.tokensPercentage
    }
  }
  
  // Fallback to plan info or demo data
  return {
    current: planInfo.value.tokensUsed,
    limit: currentPlan.tokens,
    percentage: planInfo.value.tokenUsagePercentage
  }
})

const messagesUsageData = computed(() => {
  const currentStats = usageDataComposable.currentStats.value
  const currentPlan = usageConfig.currentPlan.value
  
  if (currentStats) {
    return {
      current: currentStats.messagesUsed,
      limit: currentStats.messageLimit,
      percentage: currentStats.messagesPercentage
    }
  }
  
  // Fallback to demo data
  return {
    current: 847,
    limit: currentPlan.messages,
    percentage: 56.5
  }
})

const timeToResetData = computed(() => {
  const currentStats = usageDataComposable.currentStats.value
  
  if (currentStats) {
    return currentStats.daysRemaining * 24 * 60 * 60
  }
  
  // Fallback to plan info
  return planInfo.value.daysRemaining * 24 * 60 * 60
})

const resetDateData = computed(() => {
  const currentStats = usageDataComposable.currentStats.value
  
  if (currentStats) {
    return currentStats.resetDate
  }
  
  // Fallback to plan info
  return new Date(planInfo.value.resetDate)
})

// Computed properties
const formatMetricValue = (value: number): string => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M'
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'K'
  }
  return value.toString()
}

const getTrendIcon = (trend: string): string => {
  switch (trend) {
    case 'up': return '↗️'
    case 'down': return '↘️' 
    default: return '➡️'
  }
}

const getTrendClasses = (trend: string): string => {
  switch (trend) {
    case 'up': return 'bg-red-100 text-red-700'
    case 'down': return 'bg-green-100 text-green-700'
    default: return 'bg-blue-100 text-blue-700'
  }
}

const getProgressColor = (percentage: number): string => {
  if (percentage > 80) return 'bg-red-500'
  if (percentage > 60) return 'bg-yellow-500'
  return 'bg-green-500'
}

// Connection management
const handleReconnect = () => {
  // Try both reconnection methods
  usageDataComposable.connect()
  if (legacyReconnect.value) {
    legacyReconnect.value()
  }
}

// Simulate real-time data updates for demo metrics
let updateInterval: NodeJS.Timeout | null = null

const startRealTimeUpdates = () => {
  updateInterval = setInterval(() => {
    if (isConnected.value) {
      // Update metrics with simulated data
      usageMetrics.value = usageMetrics.value.map(metric => ({
        ...metric,
        value: Math.max(0, metric.value + (Math.random() - 0.5) * metric.value * 0.1),
        percentage: Math.max(0, Math.min(100, metric.percentage + (Math.random() - 0.5) * 10)),
        trend: Math.random() > 0.7 ? (Math.random() > 0.5 ? 'up' : 'down') : metric.trend
      }))

      // Update summary stats
      summaryStats.value = {
        ...summaryStats.value,
        activeSessions: Math.max(0, summaryStats.value.activeSessions + Math.floor((Math.random() - 0.5) * 5)),
        totalRequests: summaryStats.value.totalRequests + Math.floor(Math.random() * 10)
      }

      // Update plan info
      planInfo.value = {
        ...planInfo.value,
        tokensUsed: Math.min(planInfo.value.tokenLimit, planInfo.value.tokensUsed + Math.floor(Math.random() * 50)),
        tokenUsagePercentage: (planInfo.value.tokensUsed / planInfo.value.tokenLimit) * 100
      }
    }
  }, usageConfig.config.refreshRate || 3000) // Use configured refresh rate
}

// Lifecycle hooks
onMounted(() => {
  startRealTimeUpdates()
})

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})
</script>

<style scoped>
.space-y-6 > * + * {
  margin-top: 1.5rem;
}

.space-y-4 > * + * {
  margin-top: 1rem;
}
</style>