import { ref, computed, watch, onMounted } from 'vue'

export interface UsageConfig {
  // Plan Configuration
  plan: 'pro' | 'max5' | 'max20' | 'custom'
  customTokenLimit: number
  customMessageLimit: number
  customCostLimit: number
  
  // View Configuration
  viewMode: 'realtime' | 'daily' | 'monthly'
  timezone: string
  timeFormat: '12h' | '24h'
  
  // Refresh Configuration  
  refreshRate: number // milliseconds
  autoRefresh: boolean
  
  // Daily Reset Configuration
  dailyResetHour: number // 0-23
  
  // Display Configuration
  showPercentages: boolean
  showProgressBars: boolean
  compactMode: boolean
  
  // Notification Configuration
  enableWarnings: boolean
  warningThreshold: number // percentage
  enableCriticalAlerts: boolean
  criticalThreshold: number // percentage
  
  // Advanced Configuration
  enableHistoricalData: boolean
  historicalDataDays: number
  enableRealTimeMetrics: boolean
  
  // Integration Configuration
  enableWebSocketConnection: boolean
  webSocketUrl: string
  enablePersistence: boolean
}

interface ValidationError {
  field: string
  message: string
}

const DEFAULT_CONFIG: UsageConfig = {
  // Plan Configuration
  plan: 'custom',
  customTokenLimit: 200000,
  customMessageLimit: 1500,
  customCostLimit: 25.00,
  
  // View Configuration
  viewMode: 'realtime',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  timeFormat: '24h',
  
  // Refresh Configuration
  refreshRate: 5000, // 5 seconds
  autoRefresh: true,
  
  // Daily Reset Configuration
  dailyResetHour: 0, // Midnight
  
  // Display Configuration
  showPercentages: true,
  showProgressBars: true,
  compactMode: false,
  
  // Notification Configuration
  enableWarnings: true,
  warningThreshold: 80,
  enableCriticalAlerts: true,
  criticalThreshold: 95,
  
  // Advanced Configuration
  enableHistoricalData: true,
  historicalDataDays: 30,
  enableRealTimeMetrics: true,
  
  // Integration Configuration
  enableWebSocketConnection: true,
  webSocketUrl: 'ws://localhost:4000/usage/stream',
  enablePersistence: true
}

const STORAGE_KEY = 'usage-monitor-config'

export function useUsageConfig() {
  // Reactive configuration state
  const config = ref<UsageConfig>({ ...DEFAULT_CONFIG })
  const validationErrors = ref<ValidationError[]>([])
  const isDirty = ref(false)
  const lastSaved = ref<Date | null>(null)

  // Plan options for UI
  const planOptions = computed(() => [
    { value: 'pro', label: 'Pro Plan', tokens: 500000, messages: 10000, cost: 20.00 },
    { value: 'max5', label: 'Max 5', tokens: 1000000, messages: 20000, cost: 50.00 },
    { value: 'max20', label: 'Max 20', tokens: 5000000, messages: 100000, cost: 200.00 },
    { value: 'custom', label: 'Custom', tokens: config.value.customTokenLimit, messages: config.value.customMessageLimit, cost: config.value.customCostLimit }
  ])

  // Current plan info
  const currentPlan = computed(() => {
    return planOptions.value.find(plan => plan.value === config.value.plan) || planOptions.value[3]
  })

  // View mode options
  const viewModeOptions = computed(() => [
    { value: 'realtime', label: 'Real-time', description: 'Live updates every few seconds' },
    { value: 'daily', label: 'Daily', description: 'Updated once per day' },
    { value: 'monthly', label: 'Monthly', description: 'Updated once per month' }
  ])

  // Timezone options
  const timezoneOptions = computed(() => {
    const zones = [
      'UTC',
      'America/New_York',
      'America/Chicago', 
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney'
    ]
    
    return zones.map(zone => ({
      value: zone,
      label: zone.replace('_', ' '),
      offset: new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find(part => part.type === 'timeZoneName')?.value || ''
    }))
  })

  // Refresh rate options
  const refreshRateOptions = computed(() => [
    { value: 1000, label: '1 second', description: 'Very fast (high CPU usage)' },
    { value: 2000, label: '2 seconds', description: 'Fast' },
    { value: 5000, label: '5 seconds', description: 'Normal (recommended)' },
    { value: 10000, label: '10 seconds', description: 'Slow' },
    { value: 30000, label: '30 seconds', description: 'Very slow' },
    { value: 60000, label: '1 minute', description: 'Minimal updates' }
  ])

  // Validation
  const validateConfig = (): ValidationError[] => {
    const errors: ValidationError[] = []

    // Plan validation
    if (config.value.plan === 'custom') {
      if (config.value.customTokenLimit <= 0) {
        errors.push({ field: 'customTokenLimit', message: 'Token limit must be greater than 0' })
      }
      if (config.value.customMessageLimit <= 0) {
        errors.push({ field: 'customMessageLimit', message: 'Message limit must be greater than 0' })
      }
      if (config.value.customCostLimit <= 0) {
        errors.push({ field: 'customCostLimit', message: 'Cost limit must be greater than 0' })
      }
    }

    // Refresh rate validation
    if (config.value.refreshRate < 1000) {
      errors.push({ field: 'refreshRate', message: 'Refresh rate cannot be less than 1 second' })
    }
    if (config.value.refreshRate > 300000) { // 5 minutes
      errors.push({ field: 'refreshRate', message: 'Refresh rate cannot be more than 5 minutes' })
    }

    // Daily reset hour validation
    if (config.value.dailyResetHour < 0 || config.value.dailyResetHour > 23) {
      errors.push({ field: 'dailyResetHour', message: 'Daily reset hour must be between 0-23' })
    }

    // Threshold validation
    if (config.value.warningThreshold < 1 || config.value.warningThreshold > 100) {
      errors.push({ field: 'warningThreshold', message: 'Warning threshold must be between 1-100%' })
    }
    if (config.value.criticalThreshold < 1 || config.value.criticalThreshold > 100) {
      errors.push({ field: 'criticalThreshold', message: 'Critical threshold must be between 1-100%' })
    }
    if (config.value.criticalThreshold <= config.value.warningThreshold) {
      errors.push({ field: 'criticalThreshold', message: 'Critical threshold must be higher than warning threshold' })
    }

    // Historical data validation
    if (config.value.historicalDataDays < 1 || config.value.historicalDataDays > 365) {
      errors.push({ field: 'historicalDataDays', message: 'Historical data days must be between 1-365' })
    }

    // WebSocket URL validation
    if (config.value.enableWebSocketConnection) {
      try {
        new URL(config.value.webSocketUrl)
      } catch {
        errors.push({ field: 'webSocketUrl', message: 'Invalid WebSocket URL format' })
      }
    }

    return errors
  }

  // Configuration methods
  const updateConfig = (updates: Partial<UsageConfig>) => {
    Object.keys(updates).forEach(key => {
      if (key in config.value) {
        ;(config.value as any)[key] = (updates as any)[key]
      }
    })
    isDirty.value = true
  }

  const resetToDefaults = () => {
    config.value = { ...DEFAULT_CONFIG }
    isDirty.value = true
    validationErrors.value = []
  }

  const validateAndSave = (): boolean => {
    const errors = validateConfig()
    validationErrors.value = errors

    if (errors.length === 0) {
      saveConfig()
      return true
    }
    return false
  }

  const saveConfig = () => {
    if (config.value.enablePersistence) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value))
        lastSaved.value = new Date()
        isDirty.value = false
        console.log('Usage configuration saved successfully')
      } catch (error) {
        console.error('Failed to save usage configuration:', error)
      }
    }
  }

  const loadConfig = () => {
    if (typeof window === 'undefined') return // SSR safety

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsedConfig = JSON.parse(saved)
        // Merge with defaults to handle new fields
        config.value = { ...DEFAULT_CONFIG, ...parsedConfig }
        lastSaved.value = new Date()
        console.log('Usage configuration loaded successfully')
      }
    } catch (error) {
      console.error('Failed to load usage configuration:', error)
      config.value = { ...DEFAULT_CONFIG }
    }
  }

  const exportConfig = (): string => {
    return JSON.stringify(config.value, null, 2)
  }

  const importConfig = (configString: string): boolean => {
    try {
      const importedConfig = JSON.parse(configString)
      
      // Validate imported config has required fields
      const requiredFields = Object.keys(DEFAULT_CONFIG)
      const hasAllFields = requiredFields.every(field => field in importedConfig)
      
      if (!hasAllFields) {
        throw new Error('Invalid configuration format')
      }

      config.value = { ...DEFAULT_CONFIG, ...importedConfig }
      const errors = validateConfig()
      
      if (errors.length === 0) {
        isDirty.value = true
        return true
      } else {
        console.error('Imported configuration has validation errors:', errors)
        return false
      }
    } catch (error) {
      console.error('Failed to import configuration:', error)
      return false
    }
  }

  // Computed properties for UI
  const isValid = computed(() => validationErrors.value.length === 0)
  
  const hasUnsavedChanges = computed(() => isDirty.value)

  const configSummary = computed(() => ({
    plan: currentPlan.value.label,
    viewMode: config.value.viewMode,
    refreshRate: `${config.value.refreshRate / 1000}s`,
    autoRefresh: config.value.autoRefresh ? 'Enabled' : 'Disabled',
    timezone: config.value.timezone,
    notifications: config.value.enableWarnings ? 'Enabled' : 'Disabled'
  }))

  // Auto-save functionality
  const enableAutoSave = (interval: number = 10000) => {
    let autoSaveInterval: NodeJS.Timeout

    const startAutoSave = () => {
      autoSaveInterval = setInterval(() => {
        if (isDirty.value && isValid.value) {
          saveConfig()
        }
      }, interval)
    }

    const stopAutoSave = () => {
      if (autoSaveInterval) {
        clearInterval(autoSaveInterval)
      }
    }

    startAutoSave()

    // Return cleanup function
    return stopAutoSave
  }

  // Watch for changes to mark as dirty
  watch(
    config,
    () => {
      isDirty.value = true
      // Re-validate on changes
      validationErrors.value = validateConfig()
    },
    { deep: true }
  )

  // Load configuration on mount
  onMounted(() => {
    loadConfig()
  })

  return {
    // State
    config,
    validationErrors,
    isDirty,
    lastSaved,

    // Computed
    planOptions,
    currentPlan,
    viewModeOptions,
    timezoneOptions,
    refreshRateOptions,
    isValid,
    hasUnsavedChanges,
    configSummary,

    // Methods
    updateConfig,
    resetToDefaults,
    validateAndSave,
    saveConfig,
    loadConfig,
    exportConfig,
    importConfig,
    validateConfig,
    enableAutoSave
  }
}