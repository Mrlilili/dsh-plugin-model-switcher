/**
 * DSH Plugin: Model Switcher — Client
 *
 * Keyboard shortcuts:
 * - Ctrl/Cmd+Shift+M: cycle through models in the current provider
 * - Ctrl/Cmd+Shift+R: cycle through reasoning efforts (off → model levels)
 *
 * Reads the model catalog from the ModelDirectory store and submits
 * selections through directory.select() — the same path the built-in
 * model selector uses. No Host plugin required.
 *
 * @module dsh-plugin-model-switcher/client
 */

export const inject = ['timer']

export function apply(ctx) {
  const slots = ctx.get('slots')
  const modelDirectories = ctx.get('modelDirectories')

  // ── Toast ────────────────────────────────────────────────────────

  let toastTimer = null
  let showToast = null

  function Toast() {
    const [msg, setMsg] = React.useState(null)
    React.useEffect(() => {
      showToast = (message) => {
        if (toastTimer !== null) toastTimer()
        setMsg(message)
        toastTimer = ctx.timeout(() => { toastTimer = null; setMsg(null) }, 2000)
      }
      return () => {
        showToast = null
        if (toastTimer !== null) { toastTimer(); toastTimer = null }
      }
    }, [])
    if (msg === null) return null
    return React.createElement('div', {
      style: {
        position: 'fixed', bottom: '24px', right: '24px',
        background: 'var(--dsw-surface-raised, rgba(30,30,30,0.92))',
        color: 'var(--dsw-text-primary, #eee)',
        padding: '10px 20px', borderRadius: '10px',
        fontSize: '14px', fontFamily: 'system-ui, sans-serif',
        zIndex: 99999, pointerEvents: 'none',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        transition: 'opacity 0.15s ease',
      },
    }, msg)
  }

  if (slots !== undefined) {
    slots.inject('shell.overlay', () =>
      slots.register(
        { name: 'shell.overlay', id: 'model-switcher-toast', order: 100 },
        () => React.createElement(Toast),
      ),
    )
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────

  /**
   * Find the next model in the current provider's model list, wrapping
   * around. Carries over the current reasoning effort when the next
   * model supports it.
   * @param state - the directory snapshot.
   * @returns the next selection, or null when nothing to cycle.
   */
  function nextModelSelection(state) {
    const { current, groups } = state
    if (current === null) return null
    const group = groups.find(g => g.id === current.provider)
    if (group === undefined) return null
    const models = group.models
    if (models.length <= 1) return null
    const idx = models.findIndex(m => m.id === current.model)
    const next = models[(idx + 1) % models.length]
    const selection = { provider: current.provider, model: next.id }
    const nextEffortIds = (next.reasoning?.efforts ?? []).map(e => String(e.id))
    if (current.reasoningEffort !== undefined && nextEffortIds.includes(String(current.reasoningEffort))) {
      selection.reasoningEffort = String(current.reasoningEffort)
    }
    return { selection, modelName: next.name }
  }

  /**
   * Find the next reasoning effort for the current model, cycling
   * through the full list including 'off'.
   * @param state - the directory snapshot.
   * @returns the next selection, or null when nothing to cycle.
   */
  function nextEffortSelection(state) {
    const { current, groups } = state
    if (current === null) return null
    const group = groups.find(g => g.id === current.provider)
    if (group === undefined) return null
    const model = group.models.find(m => m.id === current.model)
    if (model === undefined) return null
    const efforts = model.reasoning?.efforts ?? []
    const effortIds = ['off', ...efforts.map(e => String(e.id))]
    const effortNames = ['off', ...efforts.map(e => e.name)]
    if (effortIds.length <= 1) return null
    const currentEffort = current.reasoningEffort !== undefined ? String(current.reasoningEffort) : 'off'
    const idx = effortIds.indexOf(currentEffort)
    const nextIdx = (idx + 1) % effortIds.length
    const selection = { provider: current.provider, model: current.model }
    if (effortIds[nextIdx] !== 'off') selection.reasoningEffort = effortIds[nextIdx]
    return { selection, effortName: effortNames[nextIdx] }
  }

  if (slots !== undefined) {
    slots.inject('conversation.input.dock', () =>
      slots.register(
        { name: 'conversation.input.dock', id: 'model-switcher-kb', order: 100 },
        (props) => {
          const sessionId = props.sessionId
          const busyRef = React.useRef(false)

          function finishWithError(err) {
            if (showToast) showToast('\u274C ' + String(err))
            busyRef.current = false
          }

          React.useEffect(() => {
            function onKeyDown(event) {
              const mod = event.ctrlKey || event.metaKey
              if (!mod || !event.shiftKey) return

              if (!modelDirectories || !sessionId) return
              let directory
              try { directory = modelDirectories.directoryFor(sessionId) } catch { return }
              const state = directory.store.getSnapshot()

              if (event.code === 'KeyM') {
                event.preventDefault()
                event.stopPropagation()
                if (busyRef.current) return
                const result = nextModelSelection(state)
                if (result === null) return
                busyRef.current = true
                directory.select(result.selection).then(() => {
                  if (showToast) showToast('\uD83E\uDD16 ' + result.modelName)
                  busyRef.current = false
                }, () => {
                  if (showToast) showToast('\uD83E\uDD16 ' + result.modelName)
                  busyRef.current = false
                })
              }

              if (event.code === 'KeyR') {
                event.preventDefault()
                event.stopPropagation()
                if (busyRef.current) return
                const result = nextEffortSelection(state)
                if (result === null) return
                busyRef.current = true
                directory.select(result.selection).then(() => {
                  if (showToast) showToast('\uD83E\uDDE0 Reasoning: ' + result.effortName)
                  busyRef.current = false
                }, () => {
                  if (showToast) showToast('\uD83E\uDDE0 Reasoning: ' + result.effortName)
                  busyRef.current = false
                })
              }
            }

            document.addEventListener('keydown', onKeyDown, true)
            return () => document.removeEventListener('keydown', onKeyDown, true)
          }, [sessionId])

          return null
        },
      ),
    )
  }
}