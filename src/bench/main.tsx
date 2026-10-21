import { createRoot } from 'react-dom/client';
import { Bench } from './Bench';
import { LightsBench } from './LightsBench';
import { FlowerGame } from './FlowerGame';
import { NODES } from '../../shared/platform';
import '../styles.css';

// 按关卡用到的模块，摆上不同的工作台
const id = new URLSearchParams(location.search).get('node') ?? 'v3';
const mod = NODES.find(n => n.id === id)?.module;
createRoot(document.getElementById('root')!).render(mod === 'lights' ? <LightsBench nodeId={id} /> : mod === 'flowers' ? <FlowerGame nodeId={id} /> : <Bench />);
