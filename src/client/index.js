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

window.__ModuleLoader__.load({
  id: "dsh-plugin-model-switcher",
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })

    var React = require("react")

    exports.inject = ["timer"]

    exports.apply = function apply(ctx) {
      var slots = ctx.get("slots")
      var modelDirectories = ctx.get("modelDirectories")

      // ── Toast ────────────────────────────────────────────────────

      var toastTimer = null
      var showToast = null

      function Toast() {
        var state = React.useState(null)
        var msg = state[0]
        var setMsg = state[1]
        React.useEffect(function () {
          showToast = function (message) {
            if (toastTimer !== null) toastTimer()
            setMsg(message)
            toastTimer = ctx.timeout(function () { toastTimer = null; setMsg(null) }, 2000)
          }
          return function () {
            showToast = null
            if (toastTimer !== null) { toastTimer(); toastTimer = null }
          }
        }, [])
        if (msg === null) return null
        return React.createElement("div", {
          style: {
            position: "fixed", bottom: "24px", right: "24px",
            background: "var(--dsw-surface-raised, rgba(30,30,30,0.92))",
            color: "var(--dsw-text-primary, #eee)",
            padding: "10px 20px", borderRadius: "10px",
            fontSize: "14px", fontFamily: "system-ui, sans-serif",
            zIndex: 99999, pointerEvents: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            transition: "opacity 0.15s ease",
          },
        }, msg)
      }

      if (slots !== undefined) {
        slots.inject("shell.overlay", function () {
          return slots.register(
            { name: "shell.overlay", id: "model-switcher-toast", order: 100 },
            function () { return React.createElement(Toast) },
          )
        })
      }

      // ── Keyboard shortcuts ───────────────────────────────────────

      function nextModelSelection(state) {
        var current = state.current, groups = state.groups
        if (current === null) return null
        var group = groups.find(function (g) { return g.id === current.provider })
        if (group === undefined) return null
        var models = group.models
        if (models.length <= 1) return null
        var idx = models.findIndex(function (m) { return m.id === current.model })
        var next = models[(idx + 1) % models.length]
        var selection = { provider: current.provider, model: next.id }
        var nextEffortIds = (next.reasoning?.efforts ?? []).map(function (e) { return String(e.id) })
        if (current.reasoningEffort !== undefined && nextEffortIds.includes(String(current.reasoningEffort))) {
          selection.reasoningEffort = String(current.reasoningEffort)
        }
        return { selection: selection, modelName: next.name }
      }

      function nextEffortSelection(state) {
        var current = state.current, groups = state.groups
        if (current === null) return null
        var group = groups.find(function (g) { return g.id === current.provider })
        if (group === undefined) return null
        var model = group.models.find(function (m) { return m.id === current.model })
        if (model === undefined) return null
        var efforts = model.reasoning?.efforts ?? []
        var effortIds = ["off"].concat(efforts.map(function (e) { return String(e.id) }))
        var effortNames = ["off"].concat(efforts.map(function (e) { return e.name }))
        if (effortIds.length <= 1) return null
        var currentEffort = current.reasoningEffort !== undefined ? String(current.reasoningEffort) : "off"
        var idx = effortIds.indexOf(currentEffort)
        var nextIdx = (idx + 1) % effortIds.length
        var selection = { provider: current.provider, model: current.model }
        if (effortIds[nextIdx] !== "off") selection.reasoningEffort = effortIds[nextIdx]
        return { selection: selection, effortName: effortNames[nextIdx] }
      }

      if (slots !== undefined) {
        slots.inject("conversation.input.dock", function () {
          return slots.register(
            { name: "conversation.input.dock", id: "model-switcher-kb", order: 100 },
            function (props) {
              var sessionId = props.sessionId
              var busyRef = React.useRef(false)

              React.useEffect(function () {
                function onKeyDown(event) {
                  var mod = event.ctrlKey || event.metaKey
                  if (!mod || !event.shiftKey) return

                  if (!modelDirectories || !sessionId) return
                  var directory
                  try { directory = modelDirectories.directoryFor(sessionId) } catch (e) { return }
                  var state = directory.store.getSnapshot()

                  if (event.code === "KeyM") {
                    event.preventDefault()
                    event.stopPropagation()
                    if (busyRef.current) return
                    var result = nextModelSelection(state)
                    if (result === null) return
                    busyRef.current = true
                    directory.select(result.selection).then(function () {
                      if (showToast) showToast("\uD83E\uDD16 " + result.modelName)
                      busyRef.current = false
                    }, function () {
                      if (showToast) showToast("\uD83E\uDD16 " + result.modelName)
                      busyRef.current = false
                    })
                  }

                  if (event.code === "KeyR") {
                    event.preventDefault()
                    event.stopPropagation()
                    if (busyRef.current) return
                    var result2 = nextEffortSelection(state)
                    if (result2 === null) return
                    busyRef.current = true
                    directory.select(result2.selection).then(function () {
                      if (showToast) showToast("\uD83E\uDDE0 Reasoning: " + result2.effortName)
                      busyRef.current = false
                    }, function () {
                      if (showToast) showToast("\uD83E\uDDE0 Reasoning: " + result2.effortName)
                      busyRef.current = false
                    })
                  }
                }

                document.addEventListener("keydown", onKeyDown, true)
                return function () { document.removeEventListener("keydown", onKeyDown, true) }
              }, [sessionId])

              return null
            },
          )
        })
      }
    }

    return module.exports
  },
})