// Local recording disclosure. Acknowledgement is local UI state, not server-enforced consent.
import { useEffect, useState } from '../../vendor/hooks.module.js';
import { html, Modal, Button } from './components.js';
import { useLang } from './lang.js';
import { t } from '../../../shared/i18n.js';

export function TrajectoryNotice() {
  useLang();
  const [policy, setPolicy] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let live = true;
    fetch('/trajectory-policy', { cache: 'no-store', signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Recording status unavailable');
        return response.json();
      }).then(value => {
        if (typeof value.enabled !== 'boolean' || typeof value.noticeVersion !== 'string') throw new Error('Invalid recording status');
        if (!live) return;
        setPolicy(value);
        let seen = false;
        try { seen = sessionStorage.getItem('sp.trajectory-notice') === value.noticeVersion; } catch { /* memory only */ }
        setOpen(value.enabled && !seen);
      }).catch(() => { if (live) setFailed(true); })
      .finally(() => clearTimeout(timer));
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, []);
  const acknowledge = () => {
    try { sessionStorage.setItem('sp.trajectory-notice', policy.noticeVersion); } catch { /* memory only */ }
    setOpen(false);
  };
  if (failed) return html`<${Modal} open=${true} title=${t('对局数据采集提示')}>
    <p>${t('无法读取采集状态，请刷新页面后重试。')}</p>
  <//>`;
  if (!policy?.enabled) return null;
  return html`<div class="trajectory-notice">
    <button type="button" class="trajectory-notice-entry tapx" onClick=${() => setOpen(true)}>${t('采集与隐私')}</button>
    <${Modal} open=${open} title=${t('对局数据采集提示')} micro="DATA COLLECTION" closeOnBackdrop=${false}
      actions=${html`<${Button} onClick=${() => location.assign('about:blank')}>${t('离开本站')}<//>
        <${Button} variant="primary" onClick=${acknowledge}>${t('已知悉，继续')}<//>`}>
      <p>${t('本站正在采集对局轨迹，用于策略分析与智能体训练。')}</p>
      <p>${t('记录局面、商店与资金、购买及升本等操作、站位、结算，以及代号和局内玩家标识。')}</p>
      <p>${t('轨迹可能含队友的公开代号与阵容；请勿在代号中填写真实姓名或联系方式。')}</p>
      <p>${t('轨迹不保存登录令牌、IP 地址或浏览器指纹；服务器运行日志与浏览器本地记录另行处理。')}</p>
      <p>${t('文件仅供服务器管理员通过受控方式取回，当前没有公开下载入口，也没有自动删除期限。')}</p>
      <p>${t('不愿参与请勿开始对局。主动离开对局会停止此席位的新增轨迹；断线重连期间可能保留托管状态。')}</p>
      <p>${t('删除请求请联系服务器管理员，并提供代号和大致对局时间；不要提供登录令牌。')}</p>
    <//>
  </div>`;
}
