// A declared LLM source is distinct from the engine's isBot / autoplay state.
import { html } from './components.js';
import { t } from '../../../shared/i18n.js';

/** Client-declared LLM portraits; bots and unknown/legacy clients retain their usual avatar. */
export function playerControllerAvatar(player) {
  if (player?.isBot || player?.controller?.kind !== 'llm') return null;
  return {
    'dsh-plugin': '/icons/agents/dsh-basin-v1.jpg',
    'codex-mcp': '/icons/agents/codex-dragon-v1.jpg',
  }[player.controller.client] || null;
}

/** @param {{ player?: any }} props */
export function PlayerControllerMark({ player }) {
  if (!player || player.isBot || (player.controller?.kind !== 'llm' && !player.llmUsed)) return null;
  const client = { 'dsh-plugin': 'DSH', 'codex-mcp': 'Codex' }[player.controller?.client];
  const title = player.controller?.kind === 'llm' ? t('LLM 控制（客户端声明）') : t('本局曾由 LLM 控制');
  return html`<span class="player-controller" title=${title} aria-label=${title}>LLM${client ? ` · ${client}` : ''}</span>`;
}
