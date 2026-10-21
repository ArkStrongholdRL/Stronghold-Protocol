// A declared LLM source is distinct from the engine's isBot / autoplay state.
import { html } from './components.js';
import { t } from '../../../shared/i18n.js';

/** @param {{ player?: any }} props */
export function PlayerControllerMark({ player }) {
  if (!player || player.isBot || (player.controller?.kind !== 'llm' && !player.llmUsed)) return null;
  const client = { 'dsh-plugin': 'DSH', 'codex-mcp': 'Codex' }[player.controller?.client];
  const title = player.controller?.kind === 'llm' ? t('LLM 控制（客户端声明）') : t('本局曾由 LLM 控制');
  return html`<span class="player-controller" title=${title} aria-label=${title}>LLM${client ? ` · ${client}` : ''}</span>`;
}
