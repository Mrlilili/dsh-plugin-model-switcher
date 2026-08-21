/**
 * DSH Plugin: Model Switcher — Host half
 *
 * Handles `switchModel` and `switchReasoning` RPC calls from the client.
 * Reads the current model selection from agentDefaultModel, cycles through
 * the available models or reasoning efforts, and persists the new selection.
 *
 * @module dsh-plugin-model-switcher
 */

return {
  apply(ctx) {
    harness.handle('switchModel', async (args) => {
      const svc = ctx.get('agentDefaultModel')
      if (svc === undefined) return { error: 'agentDefaultModel unavailable' }

      const current = svc.currentSelection()
      const llm = ctx.get('llm')
      if (llm === undefined) return { error: 'llm service unavailable' }

      let models
      try {
        models = await llm.listModels(current.provider)
      } catch {
        return { error: 'Failed to list models' }
      }

      if (models.length === 0) {
        return {
          provider: current.provider,
          model: current.model,
          modelName: current.model,
          notice: 'No other models available',
        }
      }

      const currentIdx = models.findIndex(m => m.id === current.model)
      const direction = args.direction === 'prev' ? -1 : 1
      const nextIdx = ((currentIdx + direction) % models.length + models.length) % models.length
      const nextModel = models[nextIdx]

      // Carry over the current reasoning effort if the next model supports it.
      let info
      try {
        info = await llm.resolveModelInfo(current.provider, nextModel.id)
      } catch {
        info = null
      }
      const nextEffortIds = (info?.reasoning?.efforts ?? []).map(e => String(e.id))
      const selection = { provider: current.provider, model: nextModel.id }
      if (
        current.reasoningEffort !== undefined &&
        nextEffortIds.includes(String(current.reasoningEffort))
      ) {
        selection.reasoningEffort = String(current.reasoningEffort)
      }

      await svc.saveSelection(selection)
      return { ...selection, modelName: nextModel.name }
    })

    harness.handle('switchReasoning', async (args) => {
      const svc = ctx.get('agentDefaultModel')
      if (svc === undefined) return { error: 'agentDefaultModel unavailable' }

      const current = svc.currentSelection()
      const llm = ctx.get('llm')
      if (llm === undefined) return { error: 'llm service unavailable' }

      let info
      try {
        info = await llm.resolveModelInfo(current.provider, current.model)
      } catch {
        info = null
      }
      const efforts = info?.reasoning?.efforts ?? []
      const effortIds = ['off', ...efforts.map(e => String(e.id))]
      const effortNames = ['off', ...efforts.map(e => e.name)]

      const currentEffort =
        current.reasoningEffort !== undefined ? String(current.reasoningEffort) : 'off'
      const currentIdx = effortIds.indexOf(currentEffort)
      const direction = args.direction === 'prev' ? -1 : 1
      const nextIdx =
        ((currentIdx + direction) % effortIds.length + effortIds.length) % effortIds.length

      const selection = { provider: current.provider, model: current.model }
      if (effortIds[nextIdx] !== 'off') selection.reasoningEffort = effortIds[nextIdx]

      await svc.saveSelection(selection)
      return { ...selection, effortName: effortNames[nextIdx] }
    })
  },
}