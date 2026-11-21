import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

const base = import.meta.env.BASE_URL;
const Router = base === '/' ? BrowserRouter : HashRouter;
createRoot(document.getElementById('root')!).render(
  <Router basename={base === '/' ? base : '/'}><App /></Router>,
);
