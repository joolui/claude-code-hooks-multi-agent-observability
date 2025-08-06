<template>
  <div class="max-h-96 overflow-y-auto bg-gradient-to-r from-[var(--theme-bg-primary)] to-[var(--theme-bg-secondary)] border-b-2 border-[var(--theme-primary)] px-4 py-6 shadow-lg">
    <h2 class="text-xl font-bold text-[var(--theme-primary)] mb-6 drop-shadow-sm">
      Usage Configuration
    </h2>
    
    <form @submit.prevent="saveConfig" class="space-y-6">
      <!-- Plan Selection -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-base font-bold text-[var(--theme-primary)] mb-3">
            Plan Selection
          </label>
          <div class="space-y-2">
            <label v-for="plan in planOptions" :key="plan.value" 
                   class="flex items-center space-x-3 cursor-pointer">
              <input 
                type="radio" 
                v-model="config.plan" 
                :value="plan.value"
                class="w-4 h-4 text-[var(--theme-primary)] border-2 border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/30"
              >
              <span class="text-[var(--theme-text-primary)] font-medium">{{ plan.label }}</span>
              <span v-if="plan.tokens" class="text-sm text-[var(--theme-text-secondary)]">({{ plan.tokens }})</span>
            </label>
          </div>
          
          <!-- Custom token limit input -->
          <div v-if="config.plan === 'custom'" class="mt-3 space-y-3">
            <div>
              <label class="block text-sm font-medium text-[var(--theme-text-primary)] mb-1">
                Custom Token Limit
              </label>
              <input 
                type="number"
                v-model.number="config.customTokenLimit"
                :min="1000"
                :max="1000000"
                step="1000"
                class="w-full px-3 py-2 border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)]"
                placeholder="Enter token limit"
                required
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--theme-text-primary)] mb-1">
                Custom Message Limit
              </label>
              <input 
                type="number"
                v-model.number="config.customMessageLimit"
                :min="100"
                :max="100000"
                step="100"
                class="w-full px-3 py-2 border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)]"
                placeholder="Enter message limit"
                required
              >
            </div>
            <div>
              <label class="block text-sm font-medium text-[var(--theme-text-primary)] mb-1">
                Custom Cost Limit ($)
              </label>
              <input 
                type="number"
                v-model.number="config.customCostLimit"
                :min="1"
                :max="1000"
                step="0.01"
                class="w-full px-3 py-2 border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)]"
                placeholder="Enter cost limit"
                required
              >
            </div>
          </div>
        </div>

        <!-- View Mode Buttons -->
        <div>
          <label class="block text-base font-bold text-[var(--theme-primary)] mb-3">
            View Mode
          </label>
          <div class="flex flex-wrap gap-2">
            <button 
              v-for="mode in viewModes" :key="mode.value"
              type="button"
              @click="config.viewMode = mode.value"
              :class="[
                'px-4 py-2 rounded-lg font-medium transition-all duration-200',
                config.viewMode === mode.value 
                  ? 'bg-[var(--theme-primary)] text-white shadow-md' 
                  : 'bg-[var(--theme-bg-secondary)] text-[var(--theme-text-primary)] hover:bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/20'
              ]"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Timezone and Time Format -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-base font-bold text-[var(--theme-primary)] mb-2">
            Timezone
          </label>
          <select 
            v-model="config.timezone"
            class="w-full px-3 py-2 border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)]"
          >
            <option value="auto">Auto-detect</option>
            <option v-for="tz in timezones" :key="tz.value" :value="tz.value">
              {{ tz.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-base font-bold text-[var(--theme-primary)] mb-2">
            Time Format
          </label>
          <select 
            v-model="config.timeFormat"
            class="w-full px-3 py-2 border border-[var(--theme-primary)] rounded-lg focus:ring-2 focus:ring-[var(--theme-primary)]/30 focus:border-[var(--theme-primary-dark)] bg-[var(--theme-bg-primary)] text-[var(--theme-text-primary)]"
          >
            <option value="12h">12-hour (AM/PM)</option>
            <option value="24h">24-hour</option>
          </select>
        </div>
      </div>

      <!-- Refresh Rate Slider -->
      <div>
        <label class="block text-base font-bold text-[var(--theme-primary)] mb-2">
          Refresh Rate: {{ config.refreshRate }}s
        </label>
        <div class="relative">
          <input 
            type="range"
            v-model.number="config.refreshRate"
            :min="1"
            :max="60"
            step="1"
            class="w-full h-2 bg-[var(--theme-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
            @input="onRefreshRateChange"
          >
          <div class="flex justify-between text-xs text-[var(--theme-text-secondary)] mt-1">
            <span>1s (Real-time)</span>
            <span>{{ config.refreshRate }}s</span>
            <span>60s (Slow)</span>
          </div>
        </div>
        <div class="mt-2 text-sm text-[var(--theme-text-secondary)]">
          {{ getRefreshRateDescription(config.refreshRate) }}
        </div>
      </div>

      <!-- Daily Reset Hour -->
      <div>
        <label class="block text-base font-bold text-[var(--theme-primary)] mb-2">
          Daily Reset Hour: {{ formatResetTime(config.dailyResetHour) }}
        </label>
        <input 
          type="range"
          v-model.number="config.dailyResetHour"
          :min="0"
          :max="23"
          step="1"
          class="w-full h-2 bg-[var(--theme-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
        >
        <div class="flex justify-between text-xs text-[var(--theme-text-secondary)] mt-1">
          <span>12:00 AM</span>
          <span>12:00 PM</span>
          <span>11:00 PM</span>
        </div>
        <div class="mt-2 text-sm text-[var(--theme-text-secondary)]">
          Daily usage statistics will reset at {{ formatResetTime(config.dailyResetHour) }}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-3 pt-4 border-t border-[var(--theme-primary)]/20">
        <button 
          type="submit"
          :disabled="!isFormValid || saving"
          class="px-6 py-2 bg-[var(--theme-primary)] text-white rounded-lg font-medium hover:bg-[var(--theme-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
        >
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
        
        <button 
          type="button"
          @click="resetToDefaults"
          class="px-6 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-all duration-200"
        >
          Reset to Defaults
        </button>

        <button 
          type="button"
          @click="exportConfig"
          class="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-all duration-200"
        >
          Export Config
        </button>
      </div>

      <!-- Validation Messages -->
      <div v-if="validationErrors.length > 0" class="bg-red-50 border border-red-200 rounded-lg p-3">
        <h4 class="text-red-800 font-medium mb-2">Validation Errors:</h4>
        <ul class="text-red-700 text-sm space-y-1">
          <li v-for="error in validationErrors" :key="error">• {{ error }}</li>
        </ul>
      </div>

      <!-- Success Message -->
      <div v-if="showSuccessMessage" class="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
        Configuration saved successfully!
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUsageConfig } from '../composables/useUsageConfig'

interface Config {
  plan: 'pro' | 'max5' | 'max20' | 'custom'
  customTokenLimit: number
  customMessageLimit: number
  customCostLimit: number
  viewMode: 'realtime' | 'daily' | 'monthly'
  timezone: string
  timeFormat: '12h' | '24h'
  refreshRate: number
  dailyResetHour: number
}

// Use the usage config composable
const usageConfig = useUsageConfig()

// Create a reactive config that mirrors the composable
const config = ref<Config>({
  plan: 'custom',
  customTokenLimit: 200000,
  customMessageLimit: 1500,
  customCostLimit: 25.00,
  viewMode: 'realtime',
  timezone: 'auto',
  timeFormat: '24h',
  refreshRate: 10,
  dailyResetHour: 0
})

// Initialize config from composable
onMounted(() => {
  config.value = {
    plan: usageConfig.config.value.plan,
    customTokenLimit: usageConfig.config.value.customTokenLimit,
    customMessageLimit: usageConfig.config.value.customMessageLimit,
    customCostLimit: usageConfig.config.value.customCostLimit,
    viewMode: usageConfig.config.value.viewMode,
    timezone: usageConfig.config.value.timezone,
    timeFormat: usageConfig.config.value.timeFormat,
    refreshRate: usageConfig.config.value.refreshRate / 1000, // Convert from ms to seconds for UI
    dailyResetHour: usageConfig.config.value.dailyResetHour
  }
})

const saving = ref(false)
const showSuccessMessage = ref(false)

// Use plan options from the composable
const planOptions = computed(() => 
  usageConfig.planOptions.value.map(option => ({
    value: option.value,
    label: option.label,
    tokens: option.value === 'custom' ? null : `${(option.tokens / 1000).toFixed(0)}K tokens`
  }))
)

const viewModes = computed(() => usageConfig.viewModeOptions.value)
const timezones = computed(() => usageConfig.timezoneOptions.value)

// Use validation from the composable
const validationErrors = computed(() => 
  usageConfig.validationErrors.value.map(error => error.message)
)

const isFormValid = computed(() => usageConfig.isValid.value)

const getRefreshRateDescription = (rate: number): string => {
  if (rate <= 2) return 'Very fast updates, high resource usage'
  if (rate <= 5) return 'Fast updates, moderate resource usage'
  if (rate <= 15) return 'Balanced updates, optimal for most cases'
  if (rate <= 30) return 'Slower updates, lower resource usage'
  return 'Very slow updates, minimal resource usage'
}

const formatResetTime = (hour: number): string => {
  if (config.value.timeFormat === '12h') {
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    const period = hour < 12 ? 'AM' : 'PM'
    return `${displayHour}:00 ${period}`
  }
  return `${hour.toString().padStart(2, '0')}:00`
}

const onRefreshRateChange = () => {
  // Provide immediate feedback on refresh rate changes
  console.log(`Refresh rate changed to ${config.value.refreshRate}s`)
}

const saveConfig = async () => {
  if (!isFormValid.value) return
  
  saving.value = true
  showSuccessMessage.value = false
  
  try {
    // Update the composable with current form values
    usageConfig.updateConfig({
      plan: config.value.plan,
      customTokenLimit: config.value.customTokenLimit,
      customMessageLimit: config.value.customMessageLimit,
      customCostLimit: config.value.customCostLimit,
      viewMode: config.value.viewMode,
      timezone: config.value.timezone,
      timeFormat: config.value.timeFormat,
      refreshRate: config.value.refreshRate * 1000, // Convert from seconds to ms
      dailyResetHour: config.value.dailyResetHour
    })
    
    // Use the composable's save method
    const success = usageConfig.validateAndSave()
    
    if (success) {
      showSuccessMessage.value = true
      setTimeout(() => {
        showSuccessMessage.value = false
      }, 3000)
    }
    
  } catch (error) {
    console.error('Failed to save configuration:', error)
  } finally {
    saving.value = false
  }
}

const resetToDefaults = () => {
  config.value = {
    plan: 'custom',
    customTokenLimit: 200000,
    customMessageLimit: 1500,
    customCostLimit: 25.00,
    viewMode: 'realtime',
    timezone: 'auto',
    timeFormat: '24h',
    refreshRate: 10,
    dailyResetHour: 0
  }
}

const exportConfig = () => {
  const configJson = JSON.stringify(config.value, null, 2)
  const blob = new Blob([configJson], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'usage-config.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const loadConfig = () => {
  try {
    const saved = localStorage.getItem('usageConfig')
    if (saved) {
      const parsed = JSON.parse(saved)
      config.value = { ...config.value, ...parsed }
    }
  } catch (error) {
    console.error('Failed to load configuration:', error)
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.slider::-webkit-slider-thumb {
  appearance: none;
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: var(--theme-primary);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.slider::-moz-range-thumb {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background: var(--theme-primary);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.slider::-webkit-slider-track {
  background: var(--theme-bg-secondary);
  height: 8px;
  border-radius: 4px;
}

.slider::-moz-range-track {
  background: var(--theme-bg-secondary);
  height: 8px;
  border-radius: 4px;
  border: none;
}
</style>