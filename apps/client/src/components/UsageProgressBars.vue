<template>
  <div class="space-y-6 p-4" role="region" aria-labelledby="usage-progress-heading">
    <h2 id="usage-progress-heading" class="text-xl font-bold text-[var(--theme-text-primary)] mb-4">
      Usage Progress
    </h2>

    <!-- Cost Usage Progress Bar -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label 
          :id="`cost-usage-label-${componentId}`"
          class="text-sm font-medium text-[var(--theme-text-primary)]"
        >
          Cost Usage
        </label>
        <span 
          :id="`cost-usage-value-${componentId}`"
          class="text-sm font-medium text-[var(--theme-text-secondary)]"
          :aria-describedby="`cost-usage-status-${componentId}`"
        >
          ${{ costUsage.current.toFixed(2) }} / ${{ costUsage.limit.toFixed(2) }}
        </span>
      </div>
      
      <div class="relative">
        <!-- Progress Bar Track -->
        <div 
          class="w-full bg-[var(--theme-bg-secondary)] rounded-full h-4 border border-[var(--theme-primary)]/20 shadow-inner"
          role="progressbar"
          :aria-valuenow="costUsage.percentage"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-labelledby="`cost-usage-label-${componentId}`"
          :aria-describedby="`cost-usage-status-${componentId} cost-usage-value-${componentId}`"
        >
          <!-- Progress Bar Fill -->
          <div 
            :class="[
              'h-4 rounded-full transition-all duration-500 ease-out relative overflow-hidden',
              getCostProgressColor(costUsage.percentage),
              'shadow-sm'
            ]"
            :style="{ width: `${Math.min(100, Math.max(0, costUsage.percentage))}%` }"
          >
            <!-- Animated shine effect for visual appeal -->
            <div 
              class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
              :style="{ animationDuration: costUsage.percentage > 80 ? '1s' : '2s' }"
            ></div>
          </div>
        </div>
        
        <!-- Percentage overlay -->
        <div class="absolute inset-0 flex items-center justify-center">
          <span 
            class="text-xs font-bold text-white drop-shadow-sm"
            :style="{ 
              color: costUsage.percentage > 50 ? 'white' : 'var(--theme-text-primary)',
              textShadow: costUsage.percentage > 50 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'
            }"
          >
            {{ costUsage.percentage.toFixed(1) }}%
          </span>
        </div>
      </div>

      <!-- Status message with ARIA live region -->
      <div 
        :id="`cost-usage-status-${componentId}`"
        :aria-live="costUsage.percentage > 80 ? 'assertive' : 'polite'"
        class="text-xs"
        :class="getCostStatusTextColor(costUsage.percentage)"
      >
        {{ getCostStatusMessage(costUsage.percentage) }}
      </div>
    </div>

    <!-- Token Usage Progress Bar -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label 
          :id="`token-usage-label-${componentId}`"
          class="text-sm font-medium text-[var(--theme-text-primary)]"
        >
          Token Usage
        </label>
        <span 
          :id="`token-usage-value-${componentId}`"
          class="text-sm font-medium text-[var(--theme-text-secondary)]"
          :aria-describedby="`token-usage-status-${componentId}`"
        >
          {{ formatTokens(tokenUsage.current) }} / {{ formatTokens(tokenUsage.limit) }}
        </span>
      </div>
      
      <div class="relative">
        <div 
          class="w-full bg-[var(--theme-bg-secondary)] rounded-full h-4 border border-[var(--theme-primary)]/20 shadow-inner"
          role="progressbar"
          :aria-valuenow="tokenUsage.percentage"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-labelledby="`token-usage-label-${componentId}`"
          :aria-describedby="`token-usage-status-${componentId} token-usage-value-${componentId}`"
        >
          <div 
            :class="[
              'h-4 rounded-full transition-all duration-500 ease-out relative overflow-hidden',
              getTokenProgressColor(tokenUsage.percentage),
              'shadow-sm'
            ]"
            :style="{ width: `${Math.min(100, Math.max(0, tokenUsage.percentage))}%` }"
          >
            <div 
              class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
              :style="{ animationDuration: tokenUsage.percentage > 80 ? '1s' : '2s' }"
            ></div>
          </div>
        </div>
        
        <div class="absolute inset-0 flex items-center justify-center">
          <span 
            class="text-xs font-bold drop-shadow-sm"
            :style="{ 
              color: tokenUsage.percentage > 50 ? 'white' : 'var(--theme-text-primary)',
              textShadow: tokenUsage.percentage > 50 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'
            }"
          >
            {{ tokenUsage.percentage.toFixed(1) }}%
          </span>
        </div>
      </div>

      <div 
        :id="`token-usage-status-${componentId}`"
        :aria-live="tokenUsage.percentage > 80 ? 'assertive' : 'polite'"
        class="text-xs"
        :class="getTokenStatusTextColor(tokenUsage.percentage)"
      >
        {{ getTokenStatusMessage(tokenUsage.percentage) }}
      </div>
    </div>

    <!-- Messages Usage Progress Bar -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label 
          :id="`messages-usage-label-${componentId}`"
          class="text-sm font-medium text-[var(--theme-text-primary)]"
        >
          Messages Usage
        </label>
        <span 
          :id="`messages-usage-value-${componentId}`"
          class="text-sm font-medium text-[var(--theme-text-secondary)]"
          :aria-describedby="`messages-usage-status-${componentId}`"
        >
          {{ messagesUsage.current.toLocaleString() }} / {{ messagesUsage.limit.toLocaleString() }}
        </span>
      </div>
      
      <div class="relative">
        <div 
          class="w-full bg-[var(--theme-bg-secondary)] rounded-full h-4 border border-[var(--theme-primary)]/20 shadow-inner"
          role="progressbar"
          :aria-valuenow="messagesUsage.percentage"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-labelledby="`messages-usage-label-${componentId}`"
          :aria-describedby="`messages-usage-status-${componentId} messages-usage-value-${componentId}`"
        >
          <div 
            :class="[
              'h-4 rounded-full transition-all duration-500 ease-out relative overflow-hidden',
              getMessagesProgressColor(messagesUsage.percentage),
              'shadow-sm'
            ]"
            :style="{ width: `${Math.min(100, Math.max(0, messagesUsage.percentage))}%` }"
          >
            <div 
              class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"
              :style="{ animationDuration: messagesUsage.percentage > 80 ? '1s' : '2s' }"
            ></div>
          </div>
        </div>
        
        <div class="absolute inset-0 flex items-center justify-center">
          <span 
            class="text-xs font-bold drop-shadow-sm"
            :style="{ 
              color: messagesUsage.percentage > 50 ? 'white' : 'var(--theme-text-primary)',
              textShadow: messagesUsage.percentage > 50 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'
            }"
          >
            {{ messagesUsage.percentage.toFixed(1) }}%
          </span>
        </div>
      </div>

      <div 
        :id="`messages-usage-status-${componentId}`"
        :aria-live="messagesUsage.percentage > 80 ? 'assertive' : 'polite'"
        class="text-xs"
        :class="getMessagesStatusTextColor(messagesUsage.percentage)"
      >
        {{ getMessagesStatusMessage(messagesUsage.percentage) }}
      </div>
    </div>

    <!-- Time to Reset Countdown -->
    <div class="space-y-2 pt-4 border-t border-[var(--theme-primary)]/20">
      <div class="flex items-center justify-between">
        <label 
          :id="`reset-countdown-label-${componentId}`"
          class="text-sm font-medium text-[var(--theme-text-primary)] flex items-center space-x-2"
        >
          <span>⏱️</span>
          <span>Time to Reset</span>
        </label>
        <span 
          :id="`reset-countdown-value-${componentId}`"
          class="text-sm font-medium text-[var(--theme-text-secondary)]"
          :aria-describedby="`reset-countdown-status-${componentId}`"
        >
          {{ formatTimeToReset(timeToReset) }}
        </span>
      </div>
      
      <div class="relative">
        <div 
          class="w-full bg-[var(--theme-bg-secondary)] rounded-full h-3 border border-[var(--theme-primary)]/20 shadow-inner"
          role="progressbar"
          :aria-valuenow="resetProgress"
          :aria-valuemin="0"
          :aria-valuemax="100"
          :aria-labelledby="`reset-countdown-label-${componentId}`"
          :aria-describedby="`reset-countdown-status-${componentId} reset-countdown-value-${componentId}`"
        >
          <div 
            class="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000 ease-linear shadow-sm relative overflow-hidden"
            :style="{ width: `${Math.min(100, Math.max(0, resetProgress))}%` }"
          >
            <!-- Pulsing animation for countdown -->
            <div 
              class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"
              style="animation-duration: 2s;"
            ></div>
          </div>
        </div>
      </div>

      <div 
        :id="`reset-countdown-status-${componentId}`"
        aria-live="polite"
        class="text-xs text-[var(--theme-text-secondary)] flex items-center justify-between"
      >
        <span>{{ getResetStatusMessage() }}</span>
        <span class="font-mono">{{ formatTimeToReset(timeToReset, true) }}</span>
      </div>
    </div>

    <!-- Legend for color coding (accessibility) -->
    <div class="pt-4 border-t border-[var(--theme-primary)]/10">
      <h3 class="text-sm font-medium text-[var(--theme-text-primary)] mb-2">Status Legend</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-green-500 rounded-full border border-green-600"></div>
          <span class="text-[var(--theme-text-secondary)]">Safe (&lt; 60%)</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-yellow-500 rounded-full border border-yellow-600"></div>
          <span class="text-[var(--theme-text-secondary)]">Warning (60-80%)</span>
        </div>
        <div class="flex items-center space-x-2">
          <div class="w-3 h-3 bg-red-500 rounded-full border border-red-600"></div>
          <span class="text-[var(--theme-text-secondary)]">Critical (&gt; 80%)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface UsageData {
  current: number
  limit: number
  percentage: number
}

// Props with default values
const props = withDefaults(defineProps<{
  costUsage?: UsageData
  tokenUsage?: UsageData
  messagesUsage?: UsageData
  timeToReset?: number // seconds until reset
  resetDate?: Date
}>(), {
  costUsage: () => ({ current: 15.75, limit: 25.00, percentage: 63.0 }),
  tokenUsage: () => ({ current: 125420, limit: 200000, percentage: 62.7 }),
  messagesUsage: () => ({ current: 847, limit: 1500, percentage: 56.5 }),
  timeToReset: () => 7 * 24 * 60 * 60, // 7 days in seconds
  resetDate: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
})

// Generate unique component ID for accessibility
const componentId = ref(`usage-progress-${Math.random().toString(36).substr(2, 9)}`)

// Real-time countdown
const currentTime = ref(Date.now())
let countdownInterval: NodeJS.Timeout | null = null

// Computed properties
const resetProgress = computed(() => {
  const totalPeriod = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
  const elapsed = currentTime.value - (props.resetDate!.getTime() - totalPeriod)
  return Math.min(100, Math.max(0, (elapsed / totalPeriod) * 100))
})

// Color coding functions with WCAG AA contrast compliance
const getCostProgressColor = (percentage: number): string => {
  if (percentage > 80) return 'bg-gradient-to-r from-red-500 to-red-600'
  if (percentage > 60) return 'bg-gradient-to-r from-yellow-500 to-yellow-600'
  return 'bg-gradient-to-r from-green-500 to-green-600'
}

const getTokenProgressColor = (percentage: number): string => {
  if (percentage > 80) return 'bg-gradient-to-r from-red-500 to-red-600'
  if (percentage > 60) return 'bg-gradient-to-r from-yellow-500 to-yellow-600'
  return 'bg-gradient-to-r from-green-500 to-green-600'
}

const getMessagesProgressColor = (percentage: number): string => {
  if (percentage > 80) return 'bg-gradient-to-r from-red-500 to-red-600'
  if (percentage > 60) return 'bg-gradient-to-r from-yellow-500 to-yellow-600'
  return 'bg-gradient-to-r from-green-500 to-green-600'
}

// Status text colors with proper contrast
const getCostStatusTextColor = (percentage: number): string => {
  if (percentage > 80) return 'text-red-700'
  if (percentage > 60) return 'text-yellow-700'
  return 'text-green-700'
}

const getTokenStatusTextColor = (percentage: number): string => {
  if (percentage > 80) return 'text-red-700'
  if (percentage > 60) return 'text-yellow-700'
  return 'text-green-700'
}

const getMessagesStatusTextColor = (percentage: number): string => {
  if (percentage > 80) return 'text-red-700'
  if (percentage > 60) return 'text-yellow-700'
  return 'text-green-700'
}

// Status messages for screen readers
const getCostStatusMessage = (percentage: number): string => {
  if (percentage > 90) return 'Critical: Cost usage is very high. Consider upgrading your plan.'
  if (percentage > 80) return 'Warning: Cost usage is high. Monitor closely.'
  if (percentage > 60) return 'Caution: Cost usage is moderate. Track carefully.'
  return 'Safe: Cost usage is within normal limits.'
}

const getTokenStatusMessage = (percentage: number): string => {
  if (percentage > 90) return 'Critical: Token usage is very high. Consider upgrading your plan.'
  if (percentage > 80) return 'Warning: Token usage is high. Monitor closely.'
  if (percentage > 60) return 'Caution: Token usage is moderate. Track carefully.'
  return 'Safe: Token usage is within normal limits.'
}

const getMessagesStatusMessage = (percentage: number): string => {
  if (percentage > 90) return 'Critical: Message usage is very high. Consider upgrading your plan.'
  if (percentage > 80) return 'Warning: Message usage is high. Monitor closely.'
  if (percentage > 60) return 'Caution: Message usage is moderate. Track carefully.'
  return 'Safe: Message usage is within normal limits.'
}

const getResetStatusMessage = (): string => {
  const days = Math.floor(props.timeToReset / (24 * 60 * 60))
  if (days <= 1) return 'Usage will reset very soon'
  if (days <= 7) return 'Usage will reset soon'
  return 'Usage reset is approaching'
}

// Utility functions
const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`
  return tokens.toLocaleString()
}

const formatTimeToReset = (seconds: number, precise = false): string => {
  const days = Math.floor(seconds / (24 * 60 * 60))
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((seconds % (60 * 60)) / 60)

  if (precise) {
    return `${days}d ${hours}h ${minutes}m`
  }

  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`
}

// Lifecycle
onMounted(() => {
  countdownInterval = setInterval(() => {
    currentTime.value = Date.now()
  }, 60000) // Update every minute
})

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
})
</script>

<style scoped>
/* Custom progress bar animations */
@keyframes progress-fill {
  from {
    width: 0%;
  }
  to {
    width: var(--progress-width);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .bg-gradient-to-r {
    border: 2px solid currentColor;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .transition-all,
  .animate-pulse {
    animation: none !important;
    transition: none !important;
  }
}

/* Focus styles for keyboard navigation */
[role="progressbar"]:focus-visible {
  outline: 2px solid var(--theme-primary);
  outline-offset: 2px;
}

/* Ensure proper spacing */
.space-y-6 > * + * {
  margin-top: 1.5rem;
}

.space-y-2 > * + * {
  margin-top: 0.5rem;
}
</style>