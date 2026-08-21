/**
 * DSH Plugin: Model Switcher — Client half
 *
 * Keyboard shortcuts:
 * - Ctrl/Cmd+Shift+M: cycle through models in the current provider
 * - Ctrl/Cmd+Shift+R: cycle through reasoning efforts (off → model levels)
 *
 * A toast notification confirms each switch in the bottom-right corner.
 * The model selector UI is updated via ModelDirectory.select() so both
 * the built-in selector and the /model command reflect the change.
 *
 * @module dsh-plugin-model-switcher/client
 */

return {
  inject: ['timer'],

  apply(ctx) {
    const slots = ctx.get('slots')
    const modelDirectories = ctx.get('modelDirectories')

    // ── Toast ──────────────────────────────────────────────────────

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

    // ── Keyboard shortcuts ─────────────────────────────────────────

    if (slots !== undefined) {
      slots.inject('conversation.input.dock', () =>
        slots.register(
          { name: 'conversation.input.dock', id: 'model-switcher-kb', order: 100 },
          (props) => {
            const sessionId = props.sessionId
            const busyRef = React.useRef(false)

            /** Reject the current operation and show the error as a toast. */
            function finishWithError(err) {
              if (showToast) showToast('\u274C ' + String(err))
              busyRef.current = false
            }

            React.useEffect(() => {
              function onKeyDown(event) {
                const mod = event.ctrlKey || event.metaKey
                if (!mod || !event.shiftKey) return

                if (event.code === 'KeyM') {
                  event.preventDefault()
                  event.stopPropagation()
                  if (busyRef.current) return
                  busyRef.current = true
                  host.call('switchModel', { direction: 'next' }).then(result => {
                    if (result.error) { finishWithError(result.error); return }
                    const selection = { provider: result.provider, model: result.model }
                    if (result.reasoningEffort) selection.reasoningEffort = result.reasoningEffort
                    const done = () => {
                      if (showToast) showToast('\uD83E\uDD16 ' + (result.modelName || result.model))
                      busyRef.current = false
                    }
                    if (modelDirectories && sessionId) {
                      modelDirectories.directoryFor(sessionId).select(selection).then(done, done)
                    } else {
                      done()
                    }
                  }, finishWithError)
                }

                if (event.code === 'KeyR') {
                  event.preventDefault()
                  event.stopPropagation()
                  if (busyRef.current) return
                  busyRef.current = true
                  host.call('switchReasoning', { direction: 'next' }).then(result => {
                    if (result.error) { finishWithError(result.error); return }
                    const selection = { provider: result.provider, model: result.model }
                    if (result.reasoningEffort) selection.reasoningEffort = result.reasoningEffort
                    const done = () => {
                      const label = result.effortName || result.reasoningEffort || 'off'
                      if (showToast) showToast('\uD83E\uDDE0 Reasoning: ' + label)
                      busyRef.current = false
                    }
                    if (modelDirectories && sessionId) {
                      modelDirectories.directoryFor(sessionId).select(selection).then(done, done)
                    } else {
                      done()
                    }
                  }, finishWithError)
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
  },
}