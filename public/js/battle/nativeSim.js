// Built-in engine only. Plugin/script/trait content retains its verified source-module graph.
export async function loadNativeSim() {
  const [spec, simdata, support, bounds, rehearsal] = await Promise.all([
    import('/sim/spec.js'), import('/sim/simdata.js'), import('/sim/content/support/index.js'),
    import('../../../shared/plugins/officialBounds.js'), import('/sim/rehearsal.js'),
  ]);
  return { spec, simdata, support, bounds, rehearsal };
}
