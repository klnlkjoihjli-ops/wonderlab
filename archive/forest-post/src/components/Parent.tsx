import { useEffect, useState } from 'react';
import { RECIPIENTS, describeBridge, type Episode, type ExplorationEvent, type Progress } from '../../shared/game';
import { speechSupported } from '../recognizer';
import { checkAi, fetchHealth, type Health } from '../tutorClient';
import { CloseIcon } from './Icons';
import { setOnlineVoice, speak, unlockAudio } from '../audio';
import { DECKS } from '../../shared/lab';
import { describeBuild } from '../../shared/build';

type Tab = 'guide' | 'record' | 'paper' | 'feedback' | 'settings';
const TABS: [Tab, string][] = [['guide', '陪伴说明'], ['record', '探索记录'], ['paper', '纸桥活动'], ['feedback', '三个问题'], ['settings', '设置与隐私']];

const GUIDE: Record<Episode, { goal: string; tips: string[] }> = {
  1: { goal: '第一封邀请卡：观察小车为什么过不去，选材料搭桥，试车，失败后修改。', tips: ['让孩子自己拖材料、按出发。想帮忙时，先问“你觉得哪里不对？”', '失败是这段体验的一部分，不用急着给答案。小诺会先指一个观察点。', '孩子说出自己的猜测时，可以复述一遍：“你觉得是木板太短了？”'] },
  2: { goal: '再送一封信：桥还是上次那座，只多了一份礼物。看看旧办法还管不管用。', tips: ['开始前可以问：“上次的桥这次还能过吗？”先让孩子猜。', '如果桥弯了，请孩子指一指“哪里弯了”，再想办法。', '两种办法都可以成功：长木板加桥墩，或两块短木板加桥墩。'] },
  3: { goal: '自己的小邮局：选收信人、装饰小桥，再用话或动作讲出自己的办法。', tips: ['尽量记录孩子原话，不需要标准答案。', '孩子可以“演示给你看”：拖一拖、指一指都算表达。', '结束后可以一起准备纸桥活动。'] }
};

const TYPE_LABEL: Partial<Record<ExplorationEvent['type'], string>> = {
  start: '开始', outfit: '选装备', place: '放材料', remove: '拿回材料', undo: '撤销', test: '试车', hint: '小诺提示', question: '孩子提问', reply: '小诺回答',
  complete: '送达', recipient: '选收信人', decorate: '装饰', explain: '孩子的办法', activity: '纸桥活动', feedback: '家长反馈', pause: '暂停', lab: '小桥实验室', workshop: '搭桥工坊'
};
const MATERIAL: Record<string, string> = { short: '短木板', long: '长木板', pier: '石桥墩', left: '左半边', right: '右半边' };
const SLOT: Record<string, string> = { left: '左半边', right: '右半边', span: '横跨两岸', pier: '小溪中间的石头上' };
const RESULT: Record<string, string> = { gap: '没有桥面，车停在岸边', half: '只盖住一半', tip: '短板中间没支撑，翘下去', sag: '长板被压弯', success: '成功过桥' };

function readable(e: ExplorationEvent) {
  if (e.type === 'place') { const [m, s] = e.detail.split('→'); return `${MATERIAL[m] ?? m} 放在${SLOT[s] ?? s}`; }
  if (e.type === 'reply' || e.type === 'hint') return e.detail.replace(/^online: /, '【在线模型】').replace(/^guided: /, '【基础提示】');
  if (e.type === 'remove') return MATERIAL[e.detail] ?? e.detail;
  if (e.type === 'test') { try { const [b, r] = e.detail.split(' → '); return `${describeBridge(JSON.parse(b))}：${RESULT[r] ?? r}`; } catch { return e.detail; } }
  return e.detail;
}

export function ParentPanel({ progress, episode, initialTab, update, log, onExport, onDelete, onClose }: {
  progress: Progress; episode: Episode; initialTab?: Tab;
  update: (fn: (p: Progress) => void) => void; log: (ep: Episode, type: ExplorationEvent['type'], d: string) => void;
  onExport: () => void; onDelete: () => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'guide');
  const [health, setHealth] = useState<Health | undefined>(undefined);
  const [check, setCheck] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fb, setFb] = useState({ joy: '', help: '', idea: '' });
  const [fbEp, setFbEp] = useState<Episode>(episode);
  const [saved, setSaved] = useState('');
  useEffect(() => { void fetchHealth().then(setHealth); }, []);

  const lastReply = [...progress.events].reverse().find(e => e.type === 'reply');
  const aiStatus = !progress.consent.ai ? '未开启：小诺使用基础故事提示'
    : health === undefined ? '正在检查……'
      : !health ? '连不上本机服务：小诺使用基础故事提示'
        : !health.aiConfigured ? '服务端没有配置 DeepSeek 密钥：小诺使用基础故事提示'
          : `已配置 DeepSeek（${health.model}）。${lastReply ? (lastReply.detail.startsWith('online') ? '最近一次回答来自真实模型。' : '最近一次回答用了基础提示（模型超时或不可用）。') : '还没有提问。'}`;

  return (
    <div className="parent" role="dialog" aria-label="家长页面">
      <aside className="parent-nav">
        <h2>家长页面</h2>
        {TABS.map(([id, label]) => <button key={id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{label}</button>)}
        <button className="parent-close" onClick={onClose}><CloseIcon />回到游戏</button>
      </aside>
      <section className="parent-body">
        {tab === 'guide' && (
          <>
            <h3>怎样陪孩子玩</h3>
            <p className="lead">您是共同探索的搭档，不是讲解员。孩子能自己做的，尽量让他自己做。</p>
            {([1, 2, 3] as Episode[]).map(ep => (
              <div key={ep} className={`guide-card ${ep === episode ? 'is-current' : ''}`}>
                <h4>第 {ep} 次{progress.chapters[ep].completed ? '（已完成）' : ''}</h4>
                <p>{GUIDE[ep].goal}</p>
                <ul>{GUIDE[ep].tips.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
            ))}
            <div className="guide-card">
              <h4>现实活动准备（纸桥）</h4>
              <ul><li>两本一样厚的书、两张一样的 A4 纸、一块积木（或几枚硬币）。</li><li>书的间距、纸张、放上去的东西尽量每次一样，这样才好比较。</li><li>先猜，再试，再说说看到了什么。记录孩子原话即可，不需要标准答案。</li></ul>
            </div>
          </>
        )}

        {tab === 'record' && (
          <>
            <h3>真实的探索记录</h3>
            <p className="lead">这里只显示孩子在这台设备上实际做过的操作。不评分，不排名。</p>
            {([1, 2, 3] as Episode[]).map(ep => {
              const evs = progress.events.filter(e => e.episode === ep && e.type !== 'feedback' && e.type !== 'lab' && e.type !== 'workshop');
              if (!evs.length) return null;
              const tests = evs.filter(e => e.type === 'test').length, hints = evs.filter(e => e.type === 'hint').length;
              return (
                <div key={ep} className="record">
                  <h4>第 {ep} 次</h4>
                  <p className="record-sum">试车 {tests} 次，请小诺帮忙 {hints} 次；现在的作品：{describeBridge(progress.chapters[ep].bridge)}{progress.chapters[ep].completed ? '，已送达' : ''}{ep === 3 && progress.party.recipient ? `，送给${RECIPIENTS[progress.party.recipient]}` : ''}</p>
                  {ep === 3 && progress.party.explanation && <p className="quote">孩子的办法：“{progress.party.explanation}”</p>}
                  <ol className="timeline">
                    {evs.slice(-60).map((e, i) => (
                      <li key={i}><time>{new Date(e.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time><b>{TYPE_LABEL[e.type]}</b><span>{readable(e)}</span></li>
                    ))}
                  </ol>
                </div>
              );
            })}
            {progress.lab.records.length > 0 && (
              <div className="record">
                <h4>小桥实验室</h4>
                <p className="record-sum">共试了 {progress.lab.records.length} 次（最多保留最近 12 次）。留意孩子是不是开始“一次只换一样”，以及猜测和结果是否越来越接近。</p>
                <ol className="timeline">
                  {progress.lab.records.map((r, i) => {
                    const lv = { green: '绿（稳稳过去）', yellow: '黄（晃但能过）', red: '红（过不去）' };
                    return <li key={i}><time>{new Date(r.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time><b>{DECKS[r.setup.deck].name}</b><span>{r.setup.pier ? '有桥墩，' : ''}{r.setup.boxes} 个礼物盒 → {lv[r.level]}{r.guess ? `；孩子猜：${lv[r.guess]}` : '；没有猜'}</span></li>;
                  })}
                </ol>
              </div>
            )}
            {(() => {
              const ws = progress.events.filter(e => e.type === 'workshop');
              if (!ws.length) return null;
              const tests = ws.filter(e => e.detail.startsWith('试车')).length, picks = ws.filter(e => e.detail.startsWith('拿起')).length;
              return (
                <div className="record">
                  <h4>搭桥工坊</h4>
                  <p className="record-sum">试车 {tests} 次，从桥上拿下零件重搭 {picks} 次；现在的桥：{describeBuild(progress.workshop)}。留意孩子失败后是只改出问题的那一块，还是全部推倒重来。</p>
                  <ol className="timeline">
                    {ws.slice(-60).map((e, i) => <li key={i}><time>{new Date(e.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</time><b>搭桥工坊</b><span>{e.detail}</span></li>)}
                  </ol>
                </div>
              );
            })()}
            <h4>以后想探索的事</h4>
            {progress.questions.length ? <ul className="questions">{progress.questions.map((q, i) => <li key={i}>“{q.text}”</li>)}</ul> : <p className="muted">还没有收进来的问题。</p>}
          </>
        )}

        {tab === 'paper' && (
          <>
            <h3>纸桥活动记录</h3>
            <p className="lead">用两本书、一张纸、一块积木。先比较平纸，再比较折成扇子的纸。屏幕里的小桥是简化游戏，不能预测真实纸桥能承受多重。</p>
            <label className="field"><span>开始前，孩子猜：</span><textarea value={progress.activity.guess} onChange={e => update(p => { p.activity.guess = e.target.value.slice(0, 300); })} placeholder="例如：“纸会掉下去”" /></label>
            <label className="field"><span>平平的纸放上积木后：</span><textarea value={progress.activity.flat} onChange={e => update(p => { p.activity.flat = e.target.value.slice(0, 300); })} /></label>
            <label className="field"><span>折成扇子后：</span><textarea value={progress.activity.folded} onChange={e => update(p => { p.activity.folded = e.target.value.slice(0, 300); })} /></label>
            <label className="field"><span>孩子的原话、新办法或新问题：</span><textarea value={progress.activity.words} onChange={e => update(p => { p.activity.words = e.target.value.slice(0, 800); })} /></label>
            <label className="check"><input type="checkbox" checked={progress.activity.done} onChange={e => { const v = e.target.checked; update(p => { p.activity.done = v; }); log(episode, 'activity', v ? '完成纸桥活动' : '取消完成'); }} />我们已经做过这个实验</label>
          </>
        )}

        {tab === 'feedback' && (
          <>
            <h3>结束后的三个问题</h3>
            <p className="lead">每次玩完花一分钟写几句，帮助我们看到哪里讲解或操作不清楚。</p>
            <div className="seg">{([1, 2, 3] as Episode[]).map(ep => <button key={ep} className={fbEp === ep ? 'is-on' : ''} onClick={() => setFbEp(ep)}>第 {ep} 次</button>)}</div>
            <label className="field"><span>他最投入的是哪一段？</span><textarea value={fb.joy} onChange={e => setFb({ ...fb, joy: e.target.value })} /></label>
            <label className="field"><span>哪里需要您解释或代操作？为什么？</span><textarea value={fb.help} onChange={e => setFb({ ...fb, help: e.target.value })} /></label>
            <label className="field"><span>他有没有提出新的办法或问题？</span><textarea value={fb.idea} onChange={e => setFb({ ...fb, idea: e.target.value })} /></label>
            <button className="pill" disabled={!fb.joy && !fb.help && !fb.idea} onClick={() => {
              update(p => { p.feedback.push({ at: new Date().toISOString(), episode: fbEp, joy: fb.joy.slice(0, 500), help: fb.help.slice(0, 500), idea: fb.idea.slice(0, 500) }); if (p.feedback.length > 60) p.feedback.shift(); });
              log(fbEp, 'feedback', '保存了家长反馈'); setFb({ joy: '', help: '', idea: '' }); setSaved('已保存');
            }}>保存这次反馈</button> <span className="muted">{saved}</span>
            {progress.feedback.length > 0 && <div className="past">{[...progress.feedback].reverse().map((f, i) => (
              <div key={i} className="guide-card"><h4>第 {f.episode} 次 · {new Date(f.at).toLocaleDateString('zh-CN')}</h4>{f.joy && <p>最投入：{f.joy}</p>}{f.help && <p>需要帮忙：{f.help}</p>}{f.idea && <p>新办法/问题：{f.idea}</p>}</div>
            ))}</div>}
          </>
        )}

        {tab === 'settings' && (
          <>
            <h3>设置与隐私</h3>
            <div className="setting">
              <label className="check"><input type="checkbox" checked={progress.consent.ai} onChange={e => { const v = e.target.checked; update(p => { p.consent.ai = v; }); }} />让小诺使用在线模型（DeepSeek）回答</label>
              <p>开启后，孩子的问题文字、当前桥的搭法和试车结果会经本机服务发送给 DeepSeek，用来生成一两句回答。不会发送姓名、录音或家长记录。实验结果始终由程序规则决定，模型不能改变。关闭时，小诺使用预先写好的故事提示。</p>
              <p className={`status ${progress.consent.ai && health?.aiConfigured ? 'ok' : ''}`}>当前状态：{aiStatus}</p>
              <button className="pill ghost" disabled={!progress.consent.ai} onClick={async () => { setCheck('正在测试……'); const r = await checkAi(); setCheck(r.ok ? `连接成功，用时 ${(r.latencyMs / 1000).toFixed(1)} 秒` : r.status === 'unconfigured' ? '服务端没有配置密钥（在 .env 中填写 WONDERLAB_AI_KEY）' : '连接失败：小诺会使用基础提示'); }}>测试连接</button> <span className="muted">{check}</span>
            </div>
            <div className="setting">
              <label className="check"><input type="checkbox" checked={progress.consent.speech} onChange={e => { const v = e.target.checked; update(p => { p.consent.speech = v; }); }} />允许孩子用说话提问（语音识别）</label>
              <p>{speechSupported() ? '这台设备的浏览器支持语音识别。' : '这台设备的浏览器不支持语音识别，可以改用打字。'}本应用不录音、不保存原始声音；但浏览器会把声音交给系统的识别服务（例如 Apple 或 Google）转成文字。第一次使用时浏览器会询问麦克风权限，拒绝也能完成整个故事。</p>
            </div>
            <div className="setting">
              <label className="check"><input type="checkbox" checked={!progress.muted} onChange={e => { const v = !e.target.checked; update(p => { p.muted = v; }); }} />朗读与音效</label>
              <p>默认使用设备自带的中文语音朗读。</p>
              <label className="check sub"><input type="checkbox" checked={progress.consent.voice} disabled={progress.muted} onChange={e => { const v = e.target.checked; update(p => { p.consent.voice = v; }); setOnlineVoice(v); }} />小诺使用在线配音（火山引擎）</label>
              <p>开启后，小诺要说的话会以文字形式发送给火山引擎生成声音（小诺的回答有时会复述孩子的问题）。不会发送录音、姓名或家长记录。同一句话只生成一次并保存在这台电脑上，之后直接播放。网络不好或服务出错时，会自动改回设备朗读。</p>
              <p className={`status ${health?.ttsConfigured ? 'ok' : ''}`}>当前状态：{health === undefined ? '正在检查……' : !health ? '连不上本机服务，会使用设备朗读' : health.ttsConfigured ? `已配置在线配音（音色 ${health.ttsVoice}）` : '服务端没有配置火山引擎密钥，会使用设备朗读'}</p>
              <button className="pill ghost" disabled={progress.muted} onClick={() => { unlockAudio(); speak('你好，我是小诺。今天你是小小邮差，我们一起去送信吧！'); }}>试听小诺的声音</button>
            </div>
            <div className="setting">
              <h4>本机记录</h4>
              <p>作品、进度、操作记录、问题和反馈只保存在这台设备的浏览器里，不上传。</p>
              <div className="row">
                <button className="pill ghost" onClick={onExport}>导出记录（JSON）</button>
                {!confirmDelete
                  ? <button className="pill danger" onClick={() => setConfirmDelete(true)}>删除本机记录</button>
                  : <><button className="pill danger" onClick={onDelete}>确认删除，无法恢复</button><button className="pill ghost" onClick={() => setConfirmDelete(false)}>取消</button></>}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
