<template>
  <div class="max-w-4xl mx-auto p-6 space-y-8">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-[var(--theme-text-primary)] mb-2">Usage Progress Bars Demo</h1>
      <p class="text-[var(--theme-text-secondary)]">WCAG 2.1 AA Compliant Progress Indicators</p>
    </div>

    <!-- Demo Controls -->
    <div class="bg-[var(--theme-bg-primary)] border border-[var(--theme-primary)]/20 rounded-lg p-4">
      <h2 class="text-lg font-semibold text-[var(--theme-text-primary)] mb-4">Demo Controls</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
            Cost Usage: {{ demoValues.cost.toFixed(1) }}%
          </label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            v-model="demoValues.cost"
            class="w-full h-2 bg-[var(--theme-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
            Token Usage: {{ demoValues.tokens.toFixed(1) }}%
          </label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            v-model="demoValues.tokens"
            class="w-full h-2 bg-[var(--theme-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--theme-text-primary)] mb-2">
            Messages: {{ demoValues.messages.toFixed(1) }}%
          </label>
          <input 
            type="range" 
            min="0" 
            max="100" 
            v-model="demoValues.messages"
            class="w-full h-2 bg-[var(--theme-bg-secondary)] rounded-lg appearance-none cursor-pointer slider"
          >
        </div>
      </div>
      
      <div class="flex flex-wrap gap-2 mt-4">
        <button 
          @click="setPreset('safe')"
          class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
        >
          Safe Levels
        </button>
        <button 
          @click="setPreset('warning')"
          class="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition-colors"
        >
          Warning Levels
        </button>
        <button 
          @click="setPreset('critical')"
          class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
        >
          Critical Levels
        </button>
        <button 
          @click="setPreset('mixed')"
          class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
        >
          Mixed Levels
        </button>
      </div>
    </div>

    <!-- Progress Bars Component -->
    <div class="bg-[var(--theme-bg-primary)] border border-[var(--theme-primary)]/20 rounded-lg shadow-lg">
      <UsageProgressBars 
        :cost-usage="computedCostUsage"
        :token-usage="computedTokenUsage"
        :messages-usage="computedMessagesUsage"
        :time-to-reset="timeToReset"
        :reset-date="resetDate"
      />
    </div>

    <!-- Accessibility Features -->
    <div class="bg-[var(--theme-bg-primary)] border border-[var(--theme-primary)]/20 rounded-lg p-6">
      <h2 class="text-lg font-semibold text-[var(--theme-text-primary)] mb-4">Accessibility Features</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-[var(--theme-text-secondary)]">
        <div>
          <h3 class="font-medium text-[var(--theme-text-primary)] mb-2">WCAG 2.1 AA Compliance</h3>
          <ul class="space-y-1">
            <li>✅ Proper ARIA labels and roles</li>
            <li>✅ Screen reader announcements</li>
            <li>✅ High contrast color ratios</li>
            <li>✅ Keyboard navigation support</li>
            <li>✅ Reduced motion preferences</li>
          </ul>
        </div>
        <div>
          <h3 class="font-medium text-[var(--theme-text-primary)] mb-2">Interactive Features</h3>
          <ul class="space-y-1">
            <li>🎯 Live progress announcements</li>
            <li>📊 Percentage overlays</li>
            <li>🚨 Critical level alerts</li>
            <li>⏱️ Real-time countdown</li>
            <li>🎨 Visual status indicators</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Testing Instructions -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 class="font-medium text-blue-800 mb-2">Screen Reader Testing</h3>
      <p class="text-sm text-blue-700 mb-2">
        To test accessibility, try the following with a screen reader:
      </p>
      <ol class="text-sm text-blue-700 space-y-1 ml-4">
        <li>1. Navigate through the progress bars using Tab key</li>
        <li>2. Listen for percentage announcements and status messages</li>
        <li>3. Adjust the sliders above to hear live updates</li>
        <li>4. Notice how critical levels trigger assertive announcements</li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import UsageProgressBars from './UsageProgressBars.vue'

// Demo state
const demoValues = ref({
  cost: 63.0,
  tokens: 62.7,
  messages: 56.5
})

// Demo data
const timeToReset = ref(7 * 24 * 60 * 60) // 7 days in seconds
const resetDate = ref(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

// Computed usage data
const computedCostUsage = computed(() => ({
  current: (demoValues.value.cost / 100) * 25.00,
  limit: 25.00,
  percentage: demoValues.value.cost
}))

const computedTokenUsage = computed(() => ({
  current: Math.round((demoValues.value.tokens / 100) * 200000),
  limit: 200000,
  percentage: demoValues.value.tokens
}))

const computedMessagesUsage = computed(() => ({
  current: Math.round((demoValues.value.messages / 100) * 1500),
  limit: 1500,
  percentage: demoValues.value.messages
}))

// Preset functions
const setPreset = (preset: string) => {
  switch (preset) {
    case 'safe':
      demoValues.value = { cost: 35, tokens: 28, messages: 42 }
      break
    case 'warning':
      demoValues.value = { cost: 72, tokens: 68, messages: 75 }
      break
    case 'critical':
      demoValues.value = { cost: 91, tokens: 94, messages: 87 }
      break
    case 'mixed':
      demoValues.value = { cost: 45, tokens: 78, messages: 92 }
      break
  }
}
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